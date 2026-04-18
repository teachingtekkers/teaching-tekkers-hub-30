import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Camera, ImagePlus, AlertTriangle, CheckCircle2, X, Check } from "lucide-react";

interface CampParticipant {
  id: string;
  child_first_name: string;
  child_last_name: string;
  payment_status?: string | null;
}

type TickState = "ticked" | "not_ticked" | "unclear";

interface ExtractedRow {
  child_name: string;
  attended_tick: TickState;
  paid_tick: TickState;
  tick_confidence: "high" | "medium" | "low";
  tick_notes?: string | null;
  printed_payment_status?: "paid" | "unpaid" | "unknown";
  amount_paid?: number | null;
  amount_owed?: number | null;
}

interface ReviewRow {
  extracted: ExtractedRow;
  matchId: string | null;
  matchName: string | null;
  matchScore: number;
  confident: boolean;
  applyAttendance: boolean;
  applyPayment: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campId: string;
  campName: string;
  campDate?: string; // YYYY-MM-DD — used for attendance updates
  participants: CampParticipant[];
  onApplied?: () => void;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1).fill(0).map((_, i) => i);
  const v1 = new Array(b.length + 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function score(extracted: string, candidate: string): number {
  const e = normalize(extracted);
  const c = normalize(candidate);
  if (!e || !c) return 0;
  if (e === c) return 100;
  const eParts = e.split(" ");
  const cParts = c.split(" ");
  if (eParts.length === cParts.length && eParts.every((p) => cParts.includes(p))) return 95;
  if (eParts.every((p) => cParts.some((cp) => cp === p))) return 88;
  const dist = lev(e, c);
  const maxLen = Math.max(e.length, c.length);
  const sim = 1 - dist / maxLen;
  return Math.round(sim * 80);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function tickBadge(state: TickState) {
  if (state === "ticked") return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-xs gap-1"><Check className="h-3 w-3" />Ticked</Badge>;
  if (state === "not_ticked") return <Badge variant="outline" className="text-xs">No tick</Badge>;
  return <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Unclear</Badge>;
}

export default function SheetPhotoUploadDialog({
  open, onOpenChange, campId, campName, campDate, participants, onApplied,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [reviewRows, setReviewRows] = useState<ReviewRow[] | null>(null);
  const [strict, setStrict] = useState(true);

  const reset = useCallback(() => {
    setFiles([]); setPreviews([]); setReviewRows(null); setExtracting(false); setApplying(false);
  }, []);

  const handleClose = useCallback((v: boolean) => { if (!v) reset(); onOpenChange(v); }, [onOpenChange, reset]);

  const onPickFiles = useCallback((picked: FileList | null) => {
    if (!picked) return;
    const arr = Array.from(picked).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...arr]);
    Promise.all(arr.map(fileToDataUrl)).then((urls) => setPreviews((p) => [...p, ...urls]));
  }, []);

  const removeFile = (idx: number) => {
    setFiles((p) => p.filter((_, i) => i !== idx));
    setPreviews((p) => p.filter((_, i) => i !== idx));
  };

  const threshold = strict ? 90 : 70;

  const buildRow = useCallback((row: ExtractedRow, ths: number): ReviewRow => {
    let best = { id: "", name: "", score: 0 };
    for (const p of participants) {
      const candidate = `${p.child_first_name} ${p.child_last_name}`;
      const s = score(row.child_name, candidate);
      if (s > best.score) best = { id: p.id, name: candidate, score: s };
    }
    const confident = best.score >= ths;
    // Auto-apply only when match is confident, tick is clearly "ticked", and tick_confidence is acceptable
    const tickConfOk = row.tick_confidence !== "low";
    const applyAttendance = confident && tickConfOk && row.attended_tick === "ticked";
    const applyPayment = confident && tickConfOk && row.paid_tick === "ticked";
    return {
      extracted: row,
      matchId: confident ? best.id : null,
      matchName: best.name || null,
      matchScore: best.score,
      confident,
      applyAttendance,
      applyPayment,
    };
  }, [participants]);

  const handleExtract = useCallback(async () => {
    if (previews.length === 0) { toast.error("Add at least one photo"); return; }
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-payments-from-sheet", {
        body: { images: previews },
      });
      if (error) throw error;
      const rows: ExtractedRow[] = data?.rows || [];
      if (rows.length === 0) {
        toast.warning("No rows detected. Try a clearer photo.");
        setExtracting(false);
        return;
      }
      setReviewRows(rows.map((r) => buildRow(r, threshold)));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }, [previews, buildRow, threshold]);

  const onStrictChange = (v: boolean) => {
    setStrict(v);
    if (reviewRows) {
      const newThreshold = v ? 90 : 70;
      setReviewRows(reviewRows.map((r) => buildRow(r.extracted, newThreshold)));
    }
  };

  const toggleAttendance = (idx: number) => {
    if (!reviewRows) return;
    setReviewRows(reviewRows.map((r, i) => i === idx ? { ...r, applyAttendance: !r.applyAttendance } : r));
  };

  const togglePayment = (idx: number) => {
    if (!reviewRows) return;
    setReviewRows(reviewRows.map((r, i) => i === idx ? { ...r, applyPayment: !r.applyPayment } : r));
  };

  const setMatch = (idx: number, participantId: string) => {
    if (!reviewRows) return;
    const p = participants.find((x) => x.id === participantId);
    setReviewRows(reviewRows.map((r, i) => i === idx
      ? { ...r, matchId: participantId, matchName: p ? `${p.child_first_name} ${p.child_last_name}` : null, confident: true }
      : r));
  };

  const summary = useMemo(() => {
    if (!reviewRows) return null;
    const attendanceUpdates = reviewRows.filter((r) => r.applyAttendance && r.matchId).length;
    const paymentUpdates = reviewRows.filter((r) => r.applyPayment && r.matchId).length;
    const flagged = reviewRows.filter((r) => !r.confident || r.extracted.tick_confidence === "low" || r.extracted.attended_tick === "unclear" || r.extracted.paid_tick === "unclear").length;
    const ticksFound = reviewRows.filter((r) => r.extracted.attended_tick === "ticked" || r.extracted.paid_tick === "ticked").length;
    return { total: reviewRows.length, ticksFound, attendanceUpdates, paymentUpdates, flagged };
  }, [reviewRows]);

  const handleApply = useCallback(async () => {
    if (!reviewRows) return;
    const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
    setApplying(true);
    let okPay = 0, okAtt = 0, failed = 0;

    for (const r of reviewRows) {
      if (!r.matchId) continue;

      // Payment update — paid tick means "paid"
      if (r.applyPayment) {
        const note = `Marked PAID from sheet photo tick on ${ts}`;
        const { error } = await supabase
          .from("synced_bookings")
          .update({ payment_status: "paid", staff_notes: note } as never)
          .eq("id", r.matchId);
        if (error) failed++; else okPay++;
      }

      // Attendance update — attended tick means "present"
      if (r.applyAttendance && campDate) {
        // Get player_id from the synced booking if matched
        const { data: sb } = await supabase
          .from("synced_bookings")
          .select("matched_player_id")
          .eq("id", r.matchId)
          .maybeSingle();
        const playerId = (sb as { matched_player_id?: string } | null)?.matched_player_id ?? null;

        const { error } = await supabase
          .from("attendance")
          .upsert({
            camp_id: campId,
            player_id: playerId,
            synced_booking_id: r.matchId,
            date: campDate,
            status: "present",
            note: `From sheet photo tick on ${ts}`,
          } as never, { onConflict: "camp_id,synced_booking_id,date" } as never);
        if (error) failed++; else okAtt++;
      }
    }

    setApplying(false);
    if (okPay > 0) toast.success(`Marked ${okPay} as paid`);
    if (okAtt > 0) toast.success(`Marked ${okAtt} as attended`);
    if (okPay === 0 && okAtt === 0 && failed === 0) toast.error("Nothing selected to apply");
    if (failed > 0) toast.error(`${failed} update${failed === 1 ? "" : "s"} failed`);
    onApplied?.();
    handleClose(false);
  }, [reviewRows, campId, campDate, onApplied, handleClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update from Sheet Photo (Tick Detection)</DialogTitle>
          <DialogDescription>
            {campName} — upload printed sheet photos. The system reads MANUAL tick marks added by hand to update attended / paid status.
          </DialogDescription>
        </DialogHeader>

        {!reviewRows && (
          <div className="space-y-4">
            <label
              htmlFor="sheet-upload"
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-accent/50 transition"
            >
              <ImagePlus className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Click to add photos of the printed sheet</p>
              <p className="text-xs text-muted-foreground mt-1">Tick marks (✓), highlighter, or pen marks will be detected</p>
              <input
                id="sheet-upload" type="file" accept="image/*" multiple capture="environment"
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </label>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative group rounded-md overflow-hidden border">
                    <img src={src} alt={`Sheet ${i + 1}`} className="w-full h-32 object-cover" />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 bg-background/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={handleExtract} disabled={previews.length === 0 || extracting}>
                {extracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reading ticks…</> : <><Camera className="h-4 w-4 mr-2" />Detect Ticks & Review</>}
              </Button>
            </DialogFooter>
          </div>
        )}

        {reviewRows && summary && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 flex-wrap gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">{summary.total} rows read</Badge>
                <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1"><Check className="h-3 w-3" />{summary.ticksFound} ticks found</Badge>
                {summary.flagged > 0 && (
                  <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{summary.flagged} need review</Badge>
                )}
                <Badge variant="default">{summary.attendanceUpdates} attended</Badge>
                <Badge variant="default">{summary.paymentUpdates} paid</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="strict-mode" className="text-xs">Strict matching</Label>
                <Switch id="strict-mode" checked={strict} onCheckedChange={onStrictChange} />
              </div>
            </div>

            {!campDate && (
              <div className="text-xs rounded-md border border-amber-300 bg-amber-50/60 p-2 text-amber-900">
                No camp date provided — attendance updates will be skipped. Payment updates will still apply.
              </div>
            )}

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {reviewRows.map((r, i) => {
                const flagged = !r.confident || r.extracted.tick_confidence === "low" || r.extracted.attended_tick === "unclear" || r.extracted.paid_tick === "unclear";
                return (
                  <div
                    key={i}
                    className={`border rounded-md p-3 text-sm ${flagged ? "border-amber-300 bg-amber-50/50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{r.extracted.child_name}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">Attend:</span> {tickBadge(r.extracted.attended_tick)}
                          <span className="font-medium text-foreground ml-2">Paid:</span> {tickBadge(r.extracted.paid_tick)}
                          <Badge variant="outline" className="text-[10px]">conf: {r.extracted.tick_confidence}</Badge>
                          {r.extracted.tick_notes && <span className="italic">"{r.extracted.tick_notes}"</span>}
                        </div>
                        <div className="mt-2">
                          <select
                            value={r.matchId || ""}
                            onChange={(e) => setMatch(i, e.target.value)}
                            className="w-full text-xs border rounded px-2 py-1 bg-background"
                          >
                            <option value="">— No match (skip) —</option>
                            {participants.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.child_first_name} {p.child_last_name}
                              </option>
                            ))}
                          </select>
                          {r.matchName && (
                            <div className="text-[11px] text-muted-foreground mt-1">
                              {r.confident ? <CheckCircle2 className="inline h-3 w-3 text-emerald-600 mr-1" /> : <AlertTriangle className="inline h-3 w-3 text-amber-600 mr-1" />}
                              Match: {r.matchName} ({r.matchScore}%)
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end shrink-0">
                        <div className="flex items-center gap-2">
                          <Label className="text-[11px]">Mark attended</Label>
                          <Switch
                            checked={r.applyAttendance}
                            onCheckedChange={() => toggleAttendance(i)}
                            disabled={!r.matchId || !campDate}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-[11px]">Mark paid</Label>
                          <Switch
                            checked={r.applyPayment}
                            onCheckedChange={() => togglePayment(i)}
                            disabled={!r.matchId}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewRows(null)} disabled={applying}>
                <Upload className="h-4 w-4 mr-2" />Back
              </Button>
              <Button onClick={handleApply} disabled={applying || (summary.attendanceUpdates === 0 && summary.paymentUpdates === 0)}>
                {applying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying…</> : `Apply ${summary.attendanceUpdates + summary.paymentUpdates} update${summary.attendanceUpdates + summary.paymentUpdates === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
