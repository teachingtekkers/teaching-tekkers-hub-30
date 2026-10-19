import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  fetchAllPages, groupLatestPreviews, latestPreviewSummary, previewFreshness, previewRowCounts, previewRowsQuery, savedPreviewsQuery,
  type SavedPreviewRun,
} from "@/lib/savedPreviews";

interface PreviewRow { id: string; row_index: number; classification: string; reason: string | null; conflict: boolean; first: string | null; last: string | null }
const fmt = (d: string | null) => (d ? format(new Date(d), "dd MMM yyyy HH:mm") : "—");
const n = (v: number | null) => (v === null ? "?" : String(v));

export function FreshnessBadge({ run }: { run: Pick<SavedPreviewRun, "digest"> }) {
  return previewFreshness(run) === "legacy_stale"
    ? <Badge variant="destructive" className="text-[10px]">Old preview — preview again</Badge>
    : <Badge variant="outline" className="text-[10px]">Rechecked before import</Badge>;
}

export default function SavedPreviewsPanel({ reloadKey }: { reloadKey: number }) {
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; runs: SavedPreviewRun[] }>({ status: "loading", runs: [] });
  const [open, setOpen] = useState<SavedPreviewRun | null>(null);
  const [showOlder, setShowOlder] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ status: "loading", runs: [] });
    try {
      const runs = await fetchAllPages<SavedPreviewRun>((f, t) => savedPreviewsQuery(supabase, f, t));
      setState({ status: "ready", runs });
    } catch { setState({ status: "error", runs: [] }); }
  }, []);
  useEffect(() => { load(); }, [load, reloadKey]);

  const groups = useMemo(() => groupLatestPreviews(state.runs), [state.runs]);
  const summary = latestPreviewSummary(groups);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Saved previews — not imported</CardTitle>
        <CardDescription>Latest preview per source camp. Nothing here has been imported. Counts are file rows, not unique children; older repeats are not added.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.status === "loading" && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading saved previews…</p>}
        {state.status === "error" && (
          <div className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />Saved previews couldn't be loaded — the count is unknown.
            <Button size="sm" variant="outline" onClick={load}>Try again</Button></div>
        )}
        {state.status === "ready" && (groups.length === 0 ? <p className="text-sm text-muted-foreground">No saved previews.</p> : (<>
          <p className="text-sm">{summary.camps} source camp{summary.camps === 1 ? "" : "s"} with a saved preview · {summary.campsWithReviewRows} with review rows · {summary.reviewRows} review rows in latest previews
            {summary.campsWithUnknownCounts > 0 && ` · ${summary.campsWithUnknownCounts} with unknown counts`} · {summary.olderPreviews} older previews kept as history</p>
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">Camp</TableHead><TableHead className="text-xs">File · previewed</TableHead>
              <TableHead className="text-xs">Rows (new / updated / unchanged / review / rejected)</TableHead>
              <TableHead className="text-xs">Status</TableHead><TableHead className="text-xs" />
            </TableRow></TableHeader>
            <TableBody>
              {groups.map((g) => {
                const r = g.latest; const c = previewRowCounts(r);
                return (<Fragment key={g.key}>
                  <TableRow>
                    <TableCell className="text-xs">{r.camps?.name || "Unmapped camp"}<div className="text-muted-foreground">{r.camps?.start_date || "no date"} · source {r.source_camp_id} · {r.source_system}</div></TableCell>
                    <TableCell className="text-xs">{r.file_name || "—"}<div className="text-muted-foreground">{fmt(r.created_at)}</div></TableCell>
                    <TableCell className="text-xs">{n(c.new)} / {n(c.updated)} / {n(c.unchanged)} / {n(c.review)} / {n(c.rejected)}<div className="text-muted-foreground">{n(c.rows)} file rows</div></TableCell>
                    <TableCell className="space-y-1"><Badge variant="secondary" className="text-[10px]">Not imported</Badge><div><FreshnessBadge run={r} /></div></TableCell>
                    <TableCell className="text-xs space-y-1">
                      <Button size="sm" variant="outline" onClick={() => setOpen(r)}>View details</Button>
                      {g.older.length > 0 && <Button size="sm" variant="ghost" onClick={() => setShowOlder(showOlder === g.key ? null : g.key)}>{g.older.length} older</Button>}
                    </TableCell>
                  </TableRow>
                  {showOlder === g.key && g.older.map((o) => (
                    <TableRow key={o.id} className="bg-muted/40">
                      <TableCell className="text-xs text-muted-foreground">Superseded preview</TableCell>
                      <TableCell className="text-xs">{o.file_name || "—"}<div className="text-muted-foreground">{fmt(o.created_at)}</div></TableCell>
                      <TableCell className="text-xs">{(() => { const k = previewRowCounts(o); return `${n(k.new)} / ${n(k.updated)} / ${n(k.unchanged)} / ${n(k.review)} / ${n(k.rejected)}`; })()}</TableCell>
                      <TableCell><FreshnessBadge run={o} /></TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => setOpen(o)}>View details</Button></TableCell>
                    </TableRow>
                  ))}
                </Fragment>);
              })}
            </TableBody>
          </Table>
        </>))}
      </CardContent>
      <PreviewDetails run={open} onClose={() => setOpen(null)} />
    </Card>
  );
}

function PreviewDetails({ run, onClose }: { run: SavedPreviewRun | null; onClose: () => void }) {
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!run) return;
    let live = true; setRows(null); setError(false);
    fetchAllPages<PreviewRow>((f, t) => previewRowsQuery(supabase, run.id, f, t))
      .then((r) => live && setRows(r)).catch(() => live && setError(true));
    return () => { live = false; };
  }, [run]);
  const exceptions = (rows || []).filter((r) => r.classification === "ambiguous" || r.classification === "rejected" || r.conflict);
  return (
    <Dialog open={!!run} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{run?.camps?.name || "Saved preview"} — source {run?.source_camp_id}</DialogTitle>
          <DialogDescription>Read-only. This preview was not imported; to import, upload the file again and preview it fresh.</DialogDescription>
        </DialogHeader>
        {run && <FreshnessBadge run={run} />}
        {error && <p className="text-sm text-destructive">Rows couldn't be loaded — details are unknown.</p>}
        {!error && !rows && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading rows…</p>}
        {rows && (<>
          <p className="text-sm">{rows.length} file rows saved · {exceptions.length} needing review or rejected</p>
          <Table>
            <TableHeader><TableRow><TableHead className="text-xs">Row</TableHead><TableHead className="text-xs">Child</TableHead><TableHead className="text-xs">Result</TableHead><TableHead className="text-xs">Reason</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.row_index + 1}</TableCell>
                  <TableCell className="text-xs">{[r.first, r.last].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell><Badge variant={r.classification === "rejected" ? "destructive" : r.classification === "ambiguous" || r.conflict ? "outline" : "secondary"} className="text-[10px]">{r.classification === "ambiguous" ? "review" : r.classification}{r.conflict ? " · conflict" : ""}</Badge></TableCell>
                  <TableCell className="text-xs">{r.reason || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>)}
      </DialogContent>
    </Dialog>
  );
}
