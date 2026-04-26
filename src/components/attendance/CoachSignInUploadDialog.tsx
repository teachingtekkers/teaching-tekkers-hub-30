import { useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, X, ImageIcon, Check, AlertTriangle, UserPlus, Eye, FileText } from "lucide-react";
import { toast } from "sonner";

/* ------------------------------- types ----------------------------------- */

interface ParticipantLite {
  id: string;
  child_first_name: string;
  child_last_name: string;
  payment_status: string | null;
  amount_owed: number | null;
  total_amount: number | null;
  sibling_discount: number | null;
}

interface ExtractedRow {
  child_name: string;
  signed_in: "yes" | "no" | "unclear";
  evidence_type: string;
  evidence_notes?: string | null;
  marked_unpaid: boolean;
  confidence: number;
  is_walk_in: boolean;
}

type ReviewBucket = "signed_in" | "unpaid_to_paid" | "paid_but_absent" | "walk_ins" | "needs_review";

interface ReviewItem {
  key: string;
  participant: ParticipantLite | null;   // null = walk-in candidate
  extracted: ExtractedRow | null;        // null = absent (no row found)
  bucket: ReviewBucket;
  // suggested update — admin can override
  suggestedStatus: "present" | "absent";
  suggestedPayment: "paid" | "unpaid" | "keep";
  accepted: boolean;
  // walk-in only
  walkInFirstName?: string;
  walkInLastName?: string;
  walkInAction?: "create" | "match" | "ignore";
  walkInMatchId?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campId: string;
  campName: string;
  campDate: string;
  participants: ParticipantLite[];
  onApplied: () => void;
}

/* ------------------------------- helpers --------------------------------- */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // strip accents
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
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

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
}

function tokenSetScore(a: string, b: string): number {
  const ta = new Set(normalize(a).split(" ").filter(Boolean));
  const tb = new Set(normalize(b).split(" ").filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let matches = 0;
  for (const t of ta) if (tb.has(t)) matches++;
  return matches / Math.max(ta.size, tb.size);
}

function bestMatch(name: string, participants: ParticipantLite[]): { participant: ParticipantLite | null; score: number } {
  let best: ParticipantLite | null = null;
  let bestScore = 0;
  for (const p of participants) {
    const full = `${p.child_first_name} ${p.child_last_name}`;
    const score = Math.max(similarity(name, full), tokenSetScore(name, full) * 0.95);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return { participant: best, score: bestScore };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function evidenceLabel(t: string): string {
  switch (t) {
    case "tick_on_row": return "Tick on row";
    case "cash_note": return "Cash note";
    case "paid_note": return "Paid";
    case "paid_online_note": return "Paid online";
    case "paid_revolut_note": return "Paid Revolut";
    case "handwritten_amount": return "Handwritten amount";
    case "initials": return "Coach initials";
    case "unpaid_note": return "Marked unpaid";
    case "none": return "No mark";
    default: return t || "Other mark";
  }
}

/* ------------------------------- component ------------------------------- */

export default function CoachSignInUploadDialog({
  open, onOpenChange, campId, campName, campDate, participants, onApplied,
}: Props) {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [extracting, setExtracting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [activeTab, setActiveTab] = useState<ReviewBucket>("signed_in");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFiles([]);
    setPreviews([]);
    setStep("upload");
    setItems([]);
    setActiveTab("signed_in");
  };

  const handleClose = () => {
    if (extracting || applying) return;
    reset();
    onOpenChange(false);
  };

  const handleFiles = async (selected: FileList | null) => {
    if (!selected) return;
    const arr = Array.from(selected).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) {
      toast.error("Please select image files (JPG, PNG, HEIC).");
      return;
    }
    const newPreviews: string[] = [];
    for (const f of arr) newPreviews.push(await fileToDataUrl(f));
    setFiles((prev) => [...prev, ...arr]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const buildReviewItems = (rows: ExtractedRow[]): ReviewItem[] => {
    const result: ReviewItem[] = [];
    const matchedParticipantIds = new Set<string>();

    // 1. Process every extracted row
    rows.forEach((row, idx) => {
      if (row.is_walk_in) {
        // Try a soft match first — coach may have written a registered name in the walk-in area
        const { participant, score } = bestMatch(row.child_name, participants);
        const parts = row.child_name.trim().split(/\s+/);
        const first = parts[0] || row.child_name;
        const last = parts.slice(1).join(" ") || "";
        result.push({
          key: `walkin-${idx}`,
          participant: null,
          extracted: row,
          bucket: "walk_ins",
          suggestedStatus: "present",
          suggestedPayment: "paid",
          accepted: true,
          walkInFirstName: first,
          walkInLastName: last,
          walkInAction: score >= 0.85 && participant ? "match" : "create",
          walkInMatchId: score >= 0.85 ? participant?.id ?? null : null,
        });
        return;
      }

      const { participant, score } = bestMatch(row.child_name, participants);
      if (!participant || score < 0.6) {
        // low-confidence printed-row match → treat as walk-in candidate
        const parts = row.child_name.trim().split(/\s+/);
        result.push({
          key: `unmatched-${idx}`,
          participant: null,
          extracted: row,
          bucket: "needs_review",
          suggestedStatus: row.signed_in === "yes" ? "present" : "absent",
          suggestedPayment: "keep",
          accepted: false,
          walkInFirstName: parts[0] || row.child_name,
          walkInLastName: parts.slice(1).join(" ") || "",
          walkInAction: "create",
        });
        return;
      }

      matchedParticipantIds.add(participant.id);
      const wasUnpaid = (participant.payment_status ?? "pending") !== "paid";
      const signedIn = row.signed_in === "yes";
      const unclear = row.signed_in === "unclear" || score < 0.8 || row.confidence < 0.6;

      let bucket: ReviewBucket = "needs_review";
      let suggestedStatus: "present" | "absent" = "absent";
      let suggestedPayment: "paid" | "unpaid" | "keep" = "keep";

      if (unclear) {
        bucket = "needs_review";
        suggestedStatus = signedIn ? "present" : "absent";
        suggestedPayment = signedIn ? (row.marked_unpaid ? "unpaid" : "paid") : "keep";
      } else if (signedIn) {
        suggestedStatus = "present";
        if (row.marked_unpaid) {
          suggestedPayment = "unpaid";
          bucket = "signed_in";
        } else if (wasUnpaid) {
          suggestedPayment = "paid";
          bucket = "unpaid_to_paid";
        } else {
          suggestedPayment = "paid";
          bucket = "signed_in";
        }
      } else {
        suggestedStatus = "absent";
        suggestedPayment = "keep";
        // Will be reclassified to paid_but_absent in step 2 if applicable
        bucket = "signed_in"; // default; reclassify below
      }

      result.push({
        key: `m-${participant.id}`,
        participant,
        extracted: row,
        bucket,
        suggestedStatus,
        suggestedPayment,
        accepted: !unclear,
      });
    });

    // 2. Add registered participants not seen on the sheet at all → absent
    for (const p of participants) {
      if (matchedParticipantIds.has(p.id)) continue;
      const wasPaid = (p.payment_status ?? "pending") === "paid";
      result.push({
        key: `absent-${p.id}`,
        participant: p,
        extracted: null,
        bucket: wasPaid ? "paid_but_absent" : "signed_in", // signed_in tab also shows absentees? No — keep absentees out of signed_in
        suggestedStatus: "absent",
        suggestedPayment: "keep",
        accepted: true,
      });
    }

    // 3. Reclassify: absentees that are already paid → paid_but_absent;
    //    other absentees only show in needs_review tab if any reason.
    return result.map((it) => {
      if (it.extracted === null && it.participant) {
        const wasPaid = (it.participant.payment_status ?? "pending") === "paid";
        return { ...it, bucket: wasPaid ? "paid_but_absent" : "signed_in" };
      }
      // Signed_in=no on the sheet but printed → if already paid, paid_but_absent
      if (it.extracted && it.extracted.signed_in === "no" && it.participant) {
        const wasPaid = (it.participant.payment_status ?? "pending") === "paid";
        if (wasPaid) return { ...it, bucket: "paid_but_absent", suggestedStatus: "absent", suggestedPayment: "keep" };
      }
      return it;
    });
  };

  const runExtraction = async () => {
    if (files.length === 0) {
      toast.error("Add at least one photo of the sign-in sheet.");
      return;
    }
    setExtracting(true);
    try {
      const images = await Promise.all(files.map(fileToDataUrl));
      const { data, error } = await supabase.functions.invoke("extract-payments-from-sheet", {
        body: { images },
      });
      if (error) throw error;
      const rows = (data?.rows ?? []) as ExtractedRow[];
      if (rows.length === 0) {
        toast.error("No rows detected on the sheet. Try a clearer photo.");
        setExtracting(false);
        return;
      }
      setItems(buildReviewItems(rows));
      setStep("review");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Extraction failed";
      toast.error(msg);
    } finally {
      setExtracting(false);
    }
  };

  /* ------------------------------- buckets ------------------------------- */

  const buckets = useMemo(() => {
    const out: Record<ReviewBucket, ReviewItem[]> = {
      signed_in: [],
      unpaid_to_paid: [],
      paid_but_absent: [],
      walk_ins: [],
      needs_review: [],
    };
    for (const it of items) {
      if (it.bucket === "signed_in" && it.suggestedStatus === "absent") continue; // hide from signed_in tab
      out[it.bucket].push(it);
    }
    return out;
  }, [items]);

  const updateItem = (key: string, patch: Partial<ReviewItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  };

  /* ------------------------------- apply --------------------------------- */

  const apply = async () => {
    setApplying(true);
    let presentCount = 0;
    let paidCount = 0;
    let walkInCount = 0;
    let auditRows: any[] = [];

    try {
      for (const it of items) {
        if (!it.accepted) continue;

        // Walk-in handling
        if (it.bucket === "walk_ins" || (it.bucket === "needs_review" && !it.participant)) {
          if (it.walkInAction === "ignore") continue;

          if (it.walkInAction === "match" && it.walkInMatchId) {
            const target = participants.find((p) => p.id === it.walkInMatchId);
            if (!target) continue;
            await applyToParticipant(target, "present", "paid", it.extracted, false, auditRows);
            presentCount++; paidCount++;
            continue;
          }

          // Create walk-in
          const totalCost = 80;
          const { data: created, error: insErr } = await supabase
            .from("synced_bookings")
            .insert({
              child_first_name: it.walkInFirstName ?? it.extracted?.child_name ?? "Walk-in",
              child_last_name: it.walkInLastName ?? "",
              camp_name: campName,
              camp_date: campDate,
              matched_camp_id: campId,
              source_system: "walk-in",
              match_status: "matched",
              payment_status: "paid",
              amount_paid: totalCost,
              amount_owed: 0,
              total_amount: totalCost,
              attendance_source: "handwritten_walk_in_from_coach_sheet",
              evidence_type: it.extracted?.evidence_type ?? "handwritten_walk_in",
              sign_in_confidence: it.extracted?.confidence ?? null,
              needs_admin_review: true,
              staff_notes: `Walk-in created from coach sign-in sheet on ${new Date().toISOString()}`,
            } as never)
            .select()
            .single();
          if (insErr) {
            console.error(insErr);
            continue;
          }
          // attendance row
          await supabase.from("attendance").insert({
            camp_id: campId,
            synced_booking_id: (created as any)?.id,
            date: campDate,
            status: "present",
            note: "Walk-in from coach sign-in sheet",
          } as never);
          walkInCount++; presentCount++; paidCount++;
          auditRows.push({
            camp_id: campId, camp_date: campDate,
            uploaded_by_user_id: user?.id ?? null,
            uploaded_by_email: user?.email ?? null,
            participant_id: (created as any)?.id ?? null,
            participant_name: `${it.walkInFirstName ?? ""} ${it.walkInLastName ?? ""}`.trim(),
            is_walk_in: true,
            original_attendance_status: null,
            new_attendance_status: "present",
            original_payment_status: null,
            new_payment_status: "paid",
            original_amount_owed: null,
            new_amount_owed: 0,
            evidence_type: it.extracted?.evidence_type ?? "handwritten_walk_in",
            confidence_score: it.extracted?.confidence ?? null,
            admin_overrode: false,
            notes: it.extracted?.evidence_notes ?? null,
          });
          continue;
        }

        // Matched participant
        if (!it.participant) continue;
        const newStatus = it.suggestedStatus;
        const newPay = it.suggestedPayment;
        const overrode = false; // (admin can edit but we don't track granularly here)
        await applyToParticipant(it.participant, newStatus, newPay, it.extracted, overrode, auditRows);
        if (newStatus === "present") presentCount++;
        if (newPay === "paid") paidCount++;
      }

      if (auditRows.length > 0) {
        await supabase.from("sheet_upload_audits").insert(auditRows as never);
      }

      toast.success(`Applied: ${presentCount} present, ${paidCount} paid, ${walkInCount} walk-ins`);
      onApplied();
      handleClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Apply failed";
      toast.error(msg);
    } finally {
      setApplying(false);
    }
  };

  const applyToParticipant = async (
    p: ParticipantLite,
    newStatus: "present" | "absent",
    newPay: "paid" | "unpaid" | "keep",
    ev: ExtractedRow | null,
    overrode: boolean,
    auditRows: any[],
  ) => {
    const ts = new Date().toISOString();
    const original_payment_status = p.payment_status ?? "pending";
    const original_amount_owed = p.amount_owed ?? null;

    // Attendance upsert
    if (newStatus === "present") {
      const { data: existing } = await supabase
        .from("attendance")
        .select("id")
        .eq("camp_id", campId)
        .eq("synced_booking_id", p.id)
        .eq("date", campDate)
        .maybeSingle();
      if (existing) {
        await supabase.from("attendance").update({
          status: "present",
          note: `Coach sign-in sheet (${ev?.evidence_type ?? "match"})`,
        } as never).eq("id", (existing as any).id);
      } else {
        await supabase.from("attendance").insert({
          camp_id: campId,
          synced_booking_id: p.id,
          date: campDate,
          status: "present",
          note: `Coach sign-in sheet (${ev?.evidence_type ?? "match"})`,
        } as never);
      }
    } else {
      // absent — remove any existing present row for this date so totals are correct
      await supabase
        .from("attendance")
        .delete()
        .eq("camp_id", campId)
        .eq("synced_booking_id", p.id)
        .eq("date", campDate);
    }

    // Payment update
    let new_payment_status = original_payment_status;
    let new_amount_owed = original_amount_owed;
    const totalCost = Math.max(0, (p.total_amount ?? 0) - (p.sibling_discount ?? 0));

    const updates: Record<string, unknown> = {
      attendance_source: "coach_sign_in_sheet",
      evidence_type: ev?.evidence_type ?? null,
      sign_in_confidence: ev?.confidence ?? null,
    };

    if (newPay === "paid") {
      updates.payment_status = "paid";
      updates.amount_paid = totalCost;
      updates.amount_owed = 0;
      new_payment_status = "paid";
      new_amount_owed = 0;
    } else if (newPay === "unpaid") {
      updates.payment_status = "unpaid";
      new_payment_status = "unpaid";
    }

    const prevNote = ""; // appended via separate fetch would be heavier — keep concise
    updates.staff_notes = `Updated from coach sign-in sheet ${ts}${ev?.evidence_notes ? ` — ${ev.evidence_notes}` : ""}`;

    await supabase.from("synced_bookings").update(updates as never).eq("id", p.id);

    auditRows.push({
      camp_id: campId, camp_date: campDate,
      uploaded_by_user_id: user?.id ?? null,
      uploaded_by_email: user?.email ?? null,
      participant_id: p.id,
      participant_name: `${p.child_first_name} ${p.child_last_name}`,
      is_walk_in: false,
      original_attendance_status: null,
      new_attendance_status: newStatus,
      original_payment_status,
      new_payment_status,
      original_amount_owed,
      new_amount_owed,
      evidence_type: ev?.evidence_type ?? null,
      confidence_score: ev?.confidence ?? null,
      admin_overrode: overrode,
      notes: ev?.evidence_notes ?? null,
    });
  };

  /* ------------------------------- render -------------------------------- */

  const acceptedCount = items.filter((i) => i.accepted).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Upload Coach Sign-In Sheet
          </DialogTitle>
          <DialogDescription>
            {campName} — {campDate}. Photos of the paper sheet become the source of truth for who attended and paid.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click or drop sheet photos here</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Multiple photos OK. JPG, PNG, HEIC. v1 = images only.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>

                {previews.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {previews.map((src, idx) => (
                      <div key={idx} className="relative group aspect-square rounded border overflow-hidden bg-muted">
                        <img src={src} alt={`Sheet ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                          className="absolute top-1 right-1 rounded-full bg-background/90 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-3">
            {/* Summary chips */}
            <div className="flex flex-wrap gap-2">
              <SummaryChip label="Signed in" count={buckets.signed_in.length} />
              <SummaryChip label="Unpaid → Paid" count={buckets.unpaid_to_paid.length} variant="amber" />
              <SummaryChip label="Paid but absent" count={buckets.paid_but_absent.length} variant="muted" />
              <SummaryChip label="Walk-ins" count={buckets.walk_ins.length} variant="indigo" />
              <SummaryChip label="Needs review" count={buckets.needs_review.length} variant="destructive" />
              {previews.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { setPreviewIndex(0); setPreviewOpen(true); }}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  View sheets ({previews.length})
                </Button>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReviewBucket)}>
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="signed_in">Signed In ({buckets.signed_in.length})</TabsTrigger>
                <TabsTrigger value="unpaid_to_paid">Unpaid → Paid ({buckets.unpaid_to_paid.length})</TabsTrigger>
                <TabsTrigger value="paid_but_absent">Paid But Absent ({buckets.paid_but_absent.length})</TabsTrigger>
                <TabsTrigger value="walk_ins">Walk-Ins ({buckets.walk_ins.length})</TabsTrigger>
                <TabsTrigger value="needs_review">
                  {buckets.needs_review.length > 0 && <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />}
                  Needs Review ({buckets.needs_review.length})
                </TabsTrigger>
              </TabsList>

              {(["signed_in", "unpaid_to_paid", "paid_but_absent", "walk_ins", "needs_review"] as ReviewBucket[]).map((b) => (
                <TabsContent key={b} value={b} className="space-y-2 mt-3">
                  {buckets[b].length === 0 ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">Nothing in this tab.</div>
                  ) : (
                    buckets[b].map((it) => (
                      <ReviewRow key={it.key} item={it} onChange={(patch) => updateItem(it.key, patch)} participants={participants} />
                    ))
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        <DialogFooter>
          {step === "upload" ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={extracting}>Cancel</Button>
              <Button onClick={runExtraction} disabled={extracting || files.length === 0}>
                {extracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reading sheets…</> : <><ImageIcon className="h-4 w-4 mr-2" /> Read Sheets</>}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("upload")} disabled={applying}>Back</Button>
              <Button onClick={apply} disabled={applying || acceptedCount === 0}>
                {applying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Applying…</> : <><Check className="h-4 w-4 mr-2" /> Apply Attendance & Payments ({acceptedCount})</>}
              </Button>
            </>
          )}
        </DialogFooter>

        {/* Sheet preview modal */}
        {previewOpen && previews[previewIndex] && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewOpen(false)}
          >
            <img src={previews[previewIndex]} alt="Sheet" className="max-h-full max-w-full object-contain" />
            {previews.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {previews.map((_, i) => (
                  <button
                    key={i}
                    className={`h-2 w-2 rounded-full ${i === previewIndex ? "bg-white" : "bg-white/40"}`}
                    onClick={(e) => { e.stopPropagation(); setPreviewIndex(i); }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- subcomponents --------------------------- */

function SummaryChip({ label, count, variant = "default" }: { label: string; count: number; variant?: "default" | "amber" | "muted" | "indigo" | "destructive" }) {
  const cls = {
    default: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    muted: "bg-muted text-muted-foreground border-border",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    destructive: "bg-destructive/10 text-destructive border-destructive/30",
  }[variant];
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>
      <span>{label}</span>
      <span className="font-bold">{count}</span>
    </div>
  );
}

function ReviewRow({
  item, onChange, participants,
}: {
  item: ReviewItem;
  onChange: (patch: Partial<ReviewItem>) => void;
  participants: ParticipantLite[];
}) {
  const ev = item.extracted;
  const p = item.participant;
  const isWalkInRow = item.bucket === "walk_ins" || (item.bucket === "needs_review" && !p);

  return (
    <Card className={item.accepted ? "" : "opacity-60"}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                {p ? `${p.child_first_name} ${p.child_last_name}` : (ev?.child_name ?? "Unknown")}
              </span>
              {p && (
                <Badge variant="outline" className="text-[10px]">
                  current: {p.payment_status ?? "pending"}
                  {(p.amount_owed ?? 0) > 0 && ` · €${p.amount_owed} owed`}
                </Badge>
              )}
              {ev && (
                <Badge variant="secondary" className="text-[10px]">
                  {evidenceLabel(ev.evidence_type)}
                  {typeof ev.confidence === "number" && ` · ${Math.round(ev.confidence * 100)}%`}
                </Badge>
              )}
              {ev?.marked_unpaid && (
                <Badge variant="destructive" className="text-[10px]">coach: unpaid</Badge>
              )}
            </div>
            {ev?.evidence_notes && (
              <p className="text-xs text-muted-foreground mt-1 italic">"{ev.evidence_notes}"</p>
            )}
          </div>
          <Button
            size="sm"
            variant={item.accepted ? "default" : "outline"}
            onClick={() => onChange({ accepted: !item.accepted })}
          >
            {item.accepted ? <><Check className="h-3.5 w-3.5 mr-1" />Accepted</> : "Accept"}
          </Button>
        </div>

        {/* Walk-in controls */}
        {isWalkInRow && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={item.walkInAction === "create" ? "default" : "outline"}
                onClick={() => onChange({ walkInAction: "create", walkInMatchId: null, accepted: true })}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Create Walk-In
              </Button>
              <Button
                size="sm"
                variant={item.walkInAction === "match" ? "default" : "outline"}
                onClick={() => onChange({ walkInAction: "match" })}
              >
                Match to Existing
              </Button>
              <Button
                size="sm"
                variant={item.walkInAction === "ignore" ? "default" : "outline"}
                onClick={() => onChange({ walkInAction: "ignore", accepted: false })}
              >
                Ignore
              </Button>
            </div>

            {item.walkInAction === "create" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">First name</Label>
                  <Input
                    value={item.walkInFirstName ?? ""}
                    onChange={(e) => onChange({ walkInFirstName: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Last name</Label>
                  <Input
                    value={item.walkInLastName ?? ""}
                    onChange={(e) => onChange({ walkInLastName: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}

            {item.walkInAction === "match" && (
              <select
                className="w-full h-8 text-sm rounded-md border bg-background px-2"
                value={item.walkInMatchId ?? ""}
                onChange={(e) => onChange({ walkInMatchId: e.target.value || null })}
              >
                <option value="">Select participant…</option>
                {participants.map((pp) => (
                  <option key={pp.id} value={pp.id}>
                    {pp.child_first_name} {pp.child_last_name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Suggested update controls for matched participants */}
        {!isWalkInRow && p && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t text-xs">
            <span className="text-muted-foreground">Set to:</span>
            <select
              className="h-7 text-xs rounded-md border bg-background px-2"
              value={item.suggestedStatus}
              onChange={(e) => onChange({ suggestedStatus: e.target.value as "present" | "absent" })}
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
            <select
              className="h-7 text-xs rounded-md border bg-background px-2"
              value={item.suggestedPayment}
              onChange={(e) => onChange({ suggestedPayment: e.target.value as "paid" | "unpaid" | "keep" })}
            >
              <option value="keep">Keep payment as-is</option>
              <option value="paid">Mark paid</option>
              <option value="unpaid">Mark unpaid</option>
            </select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
