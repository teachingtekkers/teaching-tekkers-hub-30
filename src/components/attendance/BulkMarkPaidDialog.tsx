import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, UserPlus, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Participant {
  id: string;
  child_first_name: string;
  child_last_name: string;
  payment_status?: string | null;
  total_amount?: number | null;
  sibling_discount?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campId: string;
  campName: string;
  date: string;
  participants: Participant[];
  onApplied: () => void;
}

type RowAction =
  | { kind: "match"; input: string; participant: Participant }
  | { kind: "new"; input: string; firstName: string; lastName: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function parseName(line: string): { firstName: string; lastName: string } {
  // strip leading numbering, bullets, ticks, etc.
  const cleaned = line
    .replace(/^[\s\d\.\)\-•\*\u2713\u2714xX]+/, "")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function findMatch(input: string, participants: Participant[]): Participant | null {
  const n = norm(input);
  if (!n) return null;
  const tokens = n.split(" ").filter(Boolean);
  // 1) exact full name match (first + last)
  for (const p of participants) {
    const full = norm(`${p.child_first_name} ${p.child_last_name}`);
    if (full === n) return p;
  }
  // 2) all tokens contained in full name
  for (const p of participants) {
    const full = norm(`${p.child_first_name} ${p.child_last_name}`);
    if (tokens.every((t) => full.includes(t))) return p;
  }
  // 3) last name + first initial fallback
  if (tokens.length >= 2) {
    for (const p of participants) {
      const fn = norm(p.child_first_name);
      const ln = norm(p.child_last_name);
      if (
        tokens.includes(ln) &&
        tokens.some((t) => fn.startsWith(t) || t.startsWith(fn[0] || ""))
      ) {
        return p;
      }
    }
  }
  return null;
}

export default function BulkMarkPaidDialog({
  open,
  onOpenChange,
  campId,
  campName,
  date,
  participants,
  onApplied,
}: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const rows: RowAction[] = useMemo(() => {
    if (!text.trim()) return [];
    const lines = text
      .split(/\r?\n|,|;/g)
      .map((l) => l.trim())
      .filter(Boolean);
    const seen = new Set<string>();
    const out: RowAction[] = [];
    for (const line of lines) {
      const key = norm(line);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const m = findMatch(line, participants);
      if (m) {
        out.push({ kind: "match", input: line, participant: m });
      } else {
        const { firstName, lastName } = parseName(line);
        if (firstName) out.push({ kind: "new", input: line, firstName, lastName });
      }
    }
    return out;
  }, [text, participants]);

  const matched = rows.filter((r) => r.kind === "match") as Extract<RowAction, { kind: "match" }>[];
  const newOnes = rows.filter((r) => r.kind === "new") as Extract<RowAction, { kind: "new" }>[];

  const handleApply = async () => {
    if (rows.length === 0) {
      toast.error("Paste at least one name");
      return;
    }
    setSaving(true);
    let paidCount = 0;
    let addedCount = 0;
    let failed = 0;

    try {
      // 1) Mark matched participants as paid
      for (const r of matched) {
        const p = r.participant;
        const totalCost = Math.max(
          0,
          (p.total_amount ?? 0) - (p.sibling_discount ?? 0)
        );
        const { error } = await supabase
          .from("synced_bookings")
          .update({
            amount_paid: totalCost,
            amount_owed: 0,
            payment_status: "paid",
          } as never)
          .eq("id", p.id);
        if (error) failed++;
        else paidCount++;
      }

      // 2) Add new walk-ins as paid + mark present
      for (const r of newOnes) {
        const { data: booking, error } = await supabase
          .from("synced_bookings")
          .insert({
            child_first_name: r.firstName,
            child_last_name: r.lastName || "",
            matched_camp_id: campId,
            camp_name: campName,
            source_system: "walk-in",
            match_status: "matched",
            payment_status: "paid",
            total_amount: 0,
            amount_paid: 0,
            amount_owed: 0,
            staff_notes: `Added via bulk paid list on ${new Date()
              .toISOString()
              .slice(0, 16)
              .replace("T", " ")}`,
          } as never)
          .select("id")
          .single();
        if (error || !booking) {
          failed++;
          continue;
        }
        addedCount++;
        await supabase.from("attendance").insert({
          camp_id: campId,
          synced_booking_id: (booking as { id: string }).id,
          date,
          status: "present",
        } as never);
      }

      const parts: string[] = [];
      if (paidCount) parts.push(`${paidCount} marked paid`);
      if (addedCount) parts.push(`${addedCount} added & paid`);
      if (failed) parts.push(`${failed} failed`);
      toast.success(parts.join(" · ") || "Done");
      setText("");
      onOpenChange(false);
      onApplied();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Bulk update failed: " + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Mark Paid</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Paste names (one per line, or comma/semicolon separated)
            </Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"e.g.\nJohn Smith\nMary O'Connor\nLiam Murphy"}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Names matching camp participants will be marked paid. Names not
              found will be added as walk-ins, marked present, and marked paid.
            </p>
          </div>

          {rows.length > 0 && (
            <div className="space-y-2 border rounded-md p-3 bg-muted/30">
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  {matched.length} matched
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <UserPlus className="h-3 w-3 text-blue-600" />
                  {newOnes.length} new
                </Badge>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 text-sm">
                {matched.map((r, i) => (
                  <div
                    key={`m-${i}`}
                    className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-background"
                  >
                    <span className="truncate">
                      <span className="text-muted-foreground">{r.input}</span>
                      <span className="mx-1 text-muted-foreground">→</span>
                      <span className="font-medium">
                        {r.participant.child_first_name}{" "}
                        {r.participant.child_last_name}
                      </span>
                    </span>
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                      Mark Paid
                    </Badge>
                  </div>
                ))}
                {newOnes.map((r, i) => (
                  <div
                    key={`n-${i}`}
                    className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-background"
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3 text-blue-600 shrink-0" />
                      <span className="font-medium">
                        {r.firstName} {r.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        (not on camp list)
                      </span>
                    </span>
                    <Badge variant="outline" className="text-blue-700 border-blue-300">
                      Add + Paid
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={saving || rows.length === 0}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Applying…
                </>
              ) : (
                `Apply (${rows.length})`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
