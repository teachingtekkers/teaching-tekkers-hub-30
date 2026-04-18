import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Camera, ImagePlus, AlertTriangle, CheckCircle2, X } from "lucide-react";

interface CampParticipant {
  id: string;
  child_first_name: string;
  child_last_name: string;
  payment_status?: string | null;
}

interface ExtractedRow {
  child_name: string;
  payment_status: "paid" | "unpaid" | "unknown";
  amount_paid?: number | null;
  amount_owed?: number | null;
  cash_marked?: boolean;
  notes?: string | null;
}

interface ReviewRow {
  extracted: ExtractedRow;
  matchId: string | null;
  matchName: string | null;
  matchScore: number;
  confident: boolean;
  apply: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campId: string;
  campName: string;
  participants: CampParticipant[];
  onApplied?: () => void;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
}

// Levenshtein distance (small inputs only)
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
  // exact token-set equality regardless of order
  if (eParts.length === cParts.length && eParts.every((p) => cParts.includes(p))) return 95;
  // all extracted tokens appear in candidate
  if (eParts.every((p) => cParts.some((cp) => cp === p))) return 88;
  // levenshtein-based
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

export default function SheetPhotoUploadDialog({
  open, onOpenChange, campId, campName, participants, onApplied,
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

  const matchExtracted = useCallback((rows: ExtractedRow[]): ReviewRow[] => {
    return rows.map((row) => {
      let best = { id: "", name: "", score: 0 };
      for (const p of participants) {
        const candidate = `${p.child_first_name} ${p.child_last_name}`;
        const s = score(row.child_name, candidate);
        if (s > best.score) best = { id: p.id, name: candidate, score: s };
      }
      const confident = best.score >= threshold;
      return {
        extracted: row,
        matchId: confident ? best.id : null,
        matchName: best.name || null,
        matchScore: best.score,
        confident,
        apply: confident && row.payment_status !== "unknown",
      };
    });
  }, [participants, threshold]);

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
      setReviewRows(matchExtracted(rows));
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }, [previews, matchExtracted]);

  // Re-match when strict toggle changes
  const onStrictChange = (v: boolean) => {
    setStrict(v);
    if (reviewRows) {
      const newThreshold = v ? 90 : 70;
      setReviewRows(reviewRows.map((r) => {
        const confident = r.matchScore >= newThreshold;
        return { ...r, confident, apply: confident && r.extracted.payment_status !== "unknown" };
      }));
    }
  };

  const toggleApply = (idx: number) => {
    if (!reviewRows) return;
    setReviewRows(reviewRows.map((r, i) => i === idx ? { ...r, apply: !r.apply } : r));
  };

  const setMatch = (idx: number, participantId: string) => {
    if (!reviewRows) return;
    const p = participants.find((x) => x.id === participantId);
    setReviewRows(reviewRows.map((r, i) => i === idx
      ? { ...r, matchId: participantId, matchName: p ? `${p.child_first_name} ${p.child_last_name}` : null, confident: true, apply: r.extracted.payment_status !== "unknown" }
      : r));
  };

  const summary = useMemo(() => {
    if (!reviewRows) return null;
    const willApply = reviewRows.filter((r) => r.apply && r.matchId);
    const paid = willApply.filter((r) => r.extracted.payment_status === "paid").length;
    const unpaid = willApply.filter((r) => r.extracted.payment_status === "unpaid").length;
    const flagged = reviewRows.filter((r) => !r.confident || r.extracted.payment_status === "unknown").length;
    return { total: reviewRows.length, willApply: willApply.length, paid, unpaid, flagged };
  }, [reviewRows]);

  const handleApply = useCallback(async () => {
    if (!reviewRows) return;
    const toApply = reviewRows.filter((r) => r.apply && r.matchId && r.extracted.payment_status !== "unknown");
    if (toApply.length === 0) { toast.error("Nothing selected to apply"); return; }
    setApplying(true);
    let ok = 0; let failed = 0;
    const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
    for (const r of toApply) {
      const status = r.extracted.payment_status;
      const note = `Updated from sheet photo on ${ts} (status: ${status})`;
      const { error } = await supabase
        .from("synced_bookings")
        .update({ payment_status: status, staff_notes: note } as never)
        .eq("id", r.matchId!);
      if (error) failed++; else ok++;
    }
    setApplying(false);
    if (ok > 0) toast.success(`Updated ${ok} player${ok === 1 ? "" : "s"}`);
    if (failed > 0) toast.error(`${failed} update${failed === 1 ? "" : "s"} failed`);
    onApplied?.();
    handleClose(false);
  }, [reviewRows, onApplied, handleClose]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Payments from Sheet Photo</DialogTitle>
          <DialogDescription>
            {campName} — upload printed sheet photos to auto-update Paid/Unpaid status.
          </DialogDescription>
        </DialogHeader>

        {!reviewRows && (
          <div className="space-y-4">
            <label
              htmlFor="sheet-upload"
              className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-accent/50 transition"
            >
              <ImagePlus className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Click to add photos</p>
              <p className="text-xs text-muted-foreground mt-1">JPG/PNG, multiple supported</p>
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
                {extracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reading sheet…</> : <><Camera className="h-4 w-4 mr-2" />Extract & Review</>}
              </Button>
            </DialogFooter>
          </div>
        )}

        {reviewRows && summary && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary">{summary.total} detected</Badge>
                <Badge className="bg-emerald-600 hover:bg-emerald-600">{summary.paid} paid</Badge>
                <Badge variant="outline">{summary.unpaid} unpaid</Badge>
                {summary.flagged > 0 && (
                  <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{summary.flagged} need review</Badge>
                )}
                <Badge variant="default">{summary.willApply} will be applied</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="strict-mode" className="text-xs">Strict matching</Label>
                <Switch id="strict-mode" checked={strict} onCheckedChange={onStrictChange} />
              </div>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {reviewRows.map((r, i) => (
                <div
                  key={i}
                  className={`border rounded-md p-3 text-sm ${!r.confident || r.extracted.payment_status === "unknown" ? "border-amber-300 bg-amber-50/50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{r.extracted.child_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        {r.extracted.payment_status === "paid" && <Badge className="bg-emerald-600 hover:bg-emerald-600 text-xs">Paid</Badge>}
                        {r.extracted.payment_status === "unpaid" && <Badge variant="outline" className="text-xs">Unpaid</Badge>}
                        {r.extracted.payment_status === "unknown" && <Badge variant="destructive" className="text-xs">Unknown</Badge>}
                        {r.extracted.cash_marked && <span>• cash</span>}
                        {r.extracted.amount_paid != null && <span>• paid €{r.extracted.amount_paid}</span>}
                        {r.extracted.amount_owed != null && <span>• owed €{r.extracted.amount_owed}</span>}
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
                    <div className="flex items-center">
                      <Switch
                        checked={r.apply}
                        onCheckedChange={() => toggleApply(i)}
                        disabled={!r.matchId || r.extracted.payment_status === "unknown"}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewRows(null)} disabled={applying}>
                <Upload className="h-4 w-4 mr-2" />Back
              </Button>
              <Button onClick={handleApply} disabled={applying || summary.willApply === 0}>
                {applying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Applying…</> : `Apply ${summary.willApply} update${summary.willApply === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
