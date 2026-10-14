import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Settings { paused: boolean; last_success_at: string | null; last_failure_at: string | null; last_error: string | null }
interface Run {
  id: string; created_at: string; trigger: string; status: string; source_camp_id: string; file_name: string | null; error: string | null;
  counts: Record<string, unknown> & { result?: Record<string, number> }; camps: { name: string } | null;
}
interface ReviewRow {
  id: string; row_index: number; reason: string | null; conflict: boolean; candidate_ids: string[] | null; synced_booking_id: string | null;
  normalized: Record<string, unknown>; protected_fields: string[] | null;
  booking_import_runs: { source_camp_id: string; camps: { name: string } | null } | null;
}
interface Cand { id: string; child_first_name: string; child_last_name: string; date_of_birth: string | null; parent_email: string | null; parent_phone: string | null; [k: string]: unknown }

const fmt = (d: string | null) => (d ? format(new Date(d), "dd MMM yyyy HH:mm") : "—");

export default function SyncReviewPanel() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [queue, setQueue] = useState<ReviewRow[]>([]);
  const [cands, setCands] = useState<Record<string, Cand>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, r, q] = await Promise.all([
      supabase.from("booking_sync_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("booking_import_runs").select("id,created_at,trigger,status,source_camp_id,file_name,error,counts,camps(name)")
        .neq("source_system", "synthetic-test").neq("status", "preview").order("created_at", { ascending: false }).limit(15),
      supabase.from("booking_import_run_rows").select("id,row_index,reason,conflict,candidate_ids,synced_booking_id,normalized,protected_fields,booking_import_runs(source_camp_id,camps(name))")
        .eq("review_status", "pending").order("created_at").limit(200),
    ]);
    setSettings(s.data as Settings | null);
    setRuns((r.data || []) as unknown as Run[]);
    const rows = (q.data || []) as unknown as ReviewRow[];
    setQueue(rows);
    const ids = [...new Set(rows.flatMap((x) => [...(x.candidate_ids || []), x.synced_booking_id].filter(Boolean) as string[]))];
    if (ids.length) {
      const { data } = await supabase.from("synced_bookings")
        .select("id,child_first_name,child_last_name,date_of_birth,parent_email,parent_phone,total_amount,amount_paid,refund_amount,payment_status,kit_size")
        .in("id", ids);
      setCands(Object.fromEntries((data || []).map((c) => [c.id, c as Cand])));
    } else setCands({});
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const togglePause = async (paused: boolean) => {
    const { error } = await supabase.from("booking_sync_settings").update({ paused, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast({ title: "Could not change", description: error.message, variant: "destructive" });
    else setSettings((s) => (s ? { ...s, paused } : s));
  };

  const resolve = async (rowId: string, decision: string) => {
    setBusy(rowId);
    const { data, error } = await supabase.functions.invoke("booking-import", { body: { action: "resolve", row_id: rowId, decision } });
    setBusy(null);
    if (error || data?.error) {
      let msg = data?.error || error?.message;
      try { const ctx = await (error as { context?: Response })?.context?.json(); if (ctx?.error) msg = ctx.error; } catch { /* default */ }
      toast({ title: "Could not apply", description: msg, variant: "destructive" });
    } else load();
  };

  const failing = settings?.last_failure_at && (!settings.last_success_at || settings.last_failure_at > settings.last_success_at);
  const lastRun = runs[0];

  return (
    <div className="space-y-4">
      {(failing || queue.length > 0) && (
        <div className="flex items-start gap-2 rounded-md border border-destructive bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            {failing && <p>The last import failed: {settings?.last_error}. Retry it from the import history below.</p>}
            {queue.length > 0 && <p>{queue.length} item{queue.length > 1 ? "s" : ""} need your review.</p>}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Sync status</CardTitle>
            <CardDescription>Automatic sync from the booking system is not connected yet. Manual imports use the same safeguards.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4 text-sm">
          <div><p className="text-xs text-muted-foreground">Last successful import</p><p className="font-medium">{fmt(settings?.last_success_at ?? null)}</p></div>
          <div>
            <p className="text-xs text-muted-foreground">Last run</p>
            <p className="font-medium">{lastRun ? `${lastRun.counts.result?.created ?? 0} added · ${lastRun.counts.result?.updated ?? 0} updated` : "—"}</p>
          </div>
          <div><p className="text-xs text-muted-foreground">Waiting for review</p><p className="font-medium">{queue.length}</p></div>
          <div className="flex items-center gap-2">
            <Switch checked={!settings?.paused} onCheckedChange={(on) => togglePause(!on)} disabled={!settings} />
            <span>{settings?.paused ? "Automatic updates paused" : "Automatic updates on"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Review queue</CardTitle><CardDescription>Uncertain matches and differences between the booking system and changes made in the app.</CardDescription></CardHeader>
        <CardContent>
          {queue.length === 0 ? <p className="text-sm text-muted-foreground">Nothing waiting.</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">Camp</TableHead><TableHead className="text-xs">From booking system</TableHead>
                <TableHead className="text-xs">Issue</TableHead><TableHead className="text-xs">Decision</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {queue.map((r) => {
                  const n = r.normalized;
                  const cur = r.synced_booking_id ? cands[r.synced_booking_id] : null;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{r.booking_import_runs?.camps?.name}<div className="text-muted-foreground">source {r.booking_import_runs?.source_camp_id}</div></TableCell>
                      <TableCell className="text-xs">
                        {String(n.child_first_name)} {String(n.child_last_name)}
                        <div className="text-muted-foreground">{String(n.date_of_birth || "no DOB")} · {String(n.parent_email || n.parent_phone || "no contact")}</div>
                      </TableCell>
                      <TableCell className="text-xs space-y-1">
                        <p>{r.reason}</p>
                        {r.conflict && cur && (r.protected_fields || []).map((f) => (
                          <p key={f}><span className="font-mono">{f}</span>: app {String(cur[f] ?? "—")} · source {String(n[f] ?? "—")}</p>
                        ))}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-1 items-start">
                          {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : r.conflict ? (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolve(r.id, "keep_app")}>Keep app value</Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolve(r.id, "accept_source")}>Use booking system value</Button>
                            </>
                          ) : (
                            <>
                              {(r.candidate_ids || []).map((id) => {
                                const c = cands[id];
                                return (
                                  <Button key={id} size="sm" variant="outline" className="h-auto py-1 text-xs text-left whitespace-normal" onClick={() => resolve(r.id, `link:${id}`)}>
                                    Same child as {c ? `${c.child_first_name} ${c.child_last_name} (${c.date_of_birth || "no DOB"})` : "existing record"}
                                  </Button>
                                );
                              })}
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => resolve(r.id, "new")}>Add as new child</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => resolve(r.id, "skip")}>Skip</Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Import history</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">When</TableHead><TableHead className="text-xs">Camp</TableHead><TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Result</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {runs.length === 0 && <TableRow><TableCell colSpan={5} className="text-xs text-muted-foreground text-center py-4">No imports yet</TableCell></TableRow>}
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{fmt(r.created_at)}</TableCell>
                  <TableCell className="text-xs">{r.camps?.name || "—"}<div className="text-muted-foreground">source {r.source_camp_id}</div></TableCell>
                  <TableCell className="text-xs capitalize">{r.trigger}</TableCell>
                  <TableCell><Badge variant={r.status === "failed" ? "destructive" : r.status === "committed" ? "secondary" : "outline"} className="text-[10px]">{r.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {r.status === "failed" ? (
                      <span className="text-destructive">{r.error} — re-open the file in Import and confirm again; finished rows won't be duplicated.</span>
                    ) : `${r.counts.result?.created ?? 0} added · ${r.counts.result?.updated ?? 0} updated · ${r.counts.result?.unchanged ?? 0} unchanged`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
