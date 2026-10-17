import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2 } from "lucide-react";

export interface ImportJob {
  fileName: string;
  sourceCampId: string;
  campId: string;
  rows: Record<string, string>[];
}

type Cls = "new" | "updated" | "unchanged" | "ambiguous" | "rejected";
interface PlanRow {
  row_index: number;
  classification: Cls;
  reason: string | null;
  candidate_ids: string[];
  normalized: Record<string, unknown>;
  diff: Record<string, { from: unknown; to: unknown }> | null;
  protected_fields: string[];
}
interface Candidate { id: string; child_first_name: string; child_last_name: string; date_of_birth: string | null; parent_email: string | null; parent_phone: string | null }
interface Preview {
  run_id: string;
  camp_name: string;
  counts: Record<string, number>;
  rows: PlanRow[];
  candidates: Candidate[];
  warnings: string[];
}

const CLS_STYLE: Record<Cls, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default", updated: "secondary", unchanged: "outline", ambiguous: "destructive", rejected: "destructive",
};

async function invokeImport(body: unknown) {
  const { data, error } = await supabase.functions.invoke("booking-import", { body });
  if (error) {
    let msg = error.message;
    try { const ctx = await (error as { context?: Response }).context?.json(); if (ctx?.error) msg = ctx.error; } catch { /* keep default */ }
    throw new Error(msg);
  }
  return data;
}

export default function ImportPreviewStep({ jobs, onBack, onDone }: {
  jobs: ImportJob[];
  onBack: () => void;
  onDone: (summary: { created: number; updated: number; unchanged: number; skipped: number; protected_rows: number }) => void;
}) {
  const [previews, setPreviews] = useState<Record<string, Preview | { error: string }>>({});
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [filter, setFilter] = useState<Cls | "all">("all");
  const [resolutions, setResolutions] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<string, Preview | { error: string }> = {};
      for (const j of jobs) {
        try {
          out[j.fileName] = await invokeImport({ action: "preview", source_camp_id: j.sourceCampId, camp_id: j.campId, file_name: j.fileName, rows: j.rows });
        } catch (e) {
          out[j.fileName] = { error: e instanceof Error ? e.message : String(e) };
        }
      }
      if (!cancelled) { setPreviews(out); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [jobs]);

  const unresolved = useMemo(() => Object.entries(previews).reduce((n, [f, p]) => {
    if ("error" in p) return n;
    return n + p.rows.filter((r) => r.classification === "ambiguous" && !resolutions[f]?.[r.row_index]).length;
  }, 0), [previews, resolutions]);
  const hasErrors = Object.values(previews).some((p) => "error" in p);

  const commit = async () => {
    setCommitting(true);
    const total = { created: 0, updated: 0, unchanged: 0, skipped: 0, protected_rows: 0 };
    try {
      for (const [f, p] of Object.entries(previews)) {
        if ("error" in p) continue;
        await invokeImport({ action: "decisions", run_id: p.run_id, decisions: resolutions[f] || {} });
        const res = await invokeImport({ action: "commit", run_id: p.run_id });
        for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += res.result?.[k] || 0;
      }
      onDone(total);
    } catch (e) {
      setPreviews((prev) => ({ ...prev }));
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setCommitting(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /><p className="text-sm text-muted-foreground mt-3">Comparing with existing records…</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {(["all", "new", "updated", "unchanged", "ambiguous", "rejected"] as const).map((c) => (
          <Button key={c} size="sm" variant={filter === c ? "default" : "outline"} onClick={() => setFilter(c)} className="capitalize h-7 text-xs">
            {c === "ambiguous" ? "needs review" : c}
          </Button>
        ))}
      </div>

      {jobs.map((j) => {
        const p = previews[j.fileName];
        if (!p) return null;
        if ("error" in p) {
          return (
            <div key={j.fileName} className="rounded-md border border-destructive bg-destructive/5 p-3 text-sm text-destructive">
              <p className="font-medium">{j.fileName}</p><p>{p.error}</p>
            </div>
          );
        }
        const cand = new Map(p.candidates.map((c) => [c.id, c]));
        const rows = p.rows.filter((r) => filter === "all" || r.classification === filter);
        return (
          <div key={j.fileName} className="rounded-md border p-3 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{p.camp_name} <span className="text-muted-foreground font-normal">· source camp {j.sourceCampId}</span></p>
                <p className="text-xs text-muted-foreground">{j.fileName}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.counts.participants} participant registrations
                {p.counts.families_verified ? ` · ${p.counts.families_verified} bookings (from booking IDs)` : ""}
                {p.counts.families_estimated ? ` · ~${p.counts.families_estimated} families (estimate from parent contact)` : ""}
                {` · ${p.counts.existing_in_app} already in app`}
                {p.counts.conflicts ? ` · ${p.counts.conflicts} with app edits kept (sent to review)` : ""}
              </p>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center">
              {(["new", "updated", "unchanged", "ambiguous", "rejected"] as const).map((c) => (
                <div key={c} className="rounded border py-1.5">
                  <p className="text-lg font-semibold">{p.counts[c] || 0}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{c === "ambiguous" ? "Needs review" : c}</p>
                </div>
              ))}
            </div>
            {p.warnings.map((w) => <p key={w} className="text-xs text-muted-foreground flex gap-1"><AlertTriangle className="h-3.5 w-3.5" />{w}</p>)}
            <div className="max-h-[320px] overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-10">Row</TableHead>
                    <TableHead className="text-xs">Child</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.row_index}>
                      <TableCell className="text-xs py-1.5">{r.row_index + 1}</TableCell>
                      <TableCell className="text-xs py-1.5">
                        {String(r.normalized.child_first_name || "—")} {String(r.normalized.child_last_name || "")}
                        <div className="text-muted-foreground">{String(r.normalized.date_of_birth || "no DOB")}</div>
                      </TableCell>
                      <TableCell className="py-1.5"><Badge variant={CLS_STYLE[r.classification]} className="text-[10px] capitalize">{r.classification === "ambiguous" ? "review" : r.classification}</Badge></TableCell>
                      <TableCell className="text-xs py-1.5 space-y-1">
                        <p className="text-muted-foreground">{r.reason}</p>
                        {r.diff && Object.entries(r.diff).map(([f, d]) => (
                          <p key={f}><span className="font-mono">{f}</span>: {String(d.from ?? "—")} → {String(d.to ?? "—")}</p>
                        ))}
                        {r.classification === "ambiguous" && (
                          <Select
                            value={resolutions[j.fileName]?.[r.row_index] || "unset"}
                            onValueChange={(v) => setResolutions((s) => ({ ...s, [j.fileName]: { ...(s[j.fileName] || {}), [r.row_index]: v } }))}
                          >
                            <SelectTrigger className="h-7 text-xs w-72"><SelectValue placeholder="Choose…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unset" disabled>Choose what to do…</SelectItem>
                              {!r.normalized._safety_hold && r.candidate_ids.map((id) => {
                                const c = cand.get(id);
                                return <SelectItem key={id} value={`link:${id}`}>Same child as {c ? `${c.child_first_name} ${c.child_last_name} (${c.date_of_birth || "no DOB"}, ${c.parent_email || c.parent_phone || "no contact"})` : id}</SelectItem>;
                              })}
                              {!r.normalized._safety_hold && <SelectItem value="new">Add as a new child</SelectItem>}
                              <SelectItem value="skip">Skip this row</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-4">No rows</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}

      <p className="text-xs text-muted-foreground">
        Attendance, kit given, staff notes and payment changes made in the app are never overwritten. Rejected rows are not imported.
      </p>
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={committing}>Back</Button>
        <Button onClick={commit} disabled={committing || unresolved > 0 || (hasErrors && Object.values(previews).every((p) => "error" in p))}>
          {committing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          {unresolved > 0 ? `Resolve ${unresolved} review row${unresolved > 1 ? "s" : ""}` : "Confirm import"}
        </Button>
      </div>
    </div>
  );
}
