/** Read-only helpers for saved (not imported) CSV previews. No writes, no resolve paths. */
export interface SavedPreviewRun {
  id: string;
  created_at: string;
  source_system: string;
  source_camp_id: string;
  file_name: string | null;
  status: string;
  counts: Record<string, unknown> | null;
  digest: string | null;
  camps: { name: string; start_date: string | null } | null;
}

export interface PreviewGroup { key: string; latest: SavedPreviewRun; older: SavedPreviewRun[] }

export const PAGE_SIZE = 1000;

/** Loads every page; any page error fails the whole load (never a silent partial list). */
export async function fetchAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data || [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return out;
  }
}

const newerFirst = (a: SavedPreviewRun, b: SavedPreviewRun) =>
  a.created_at === b.created_at ? (a.id < b.id ? 1 : -1) : a.created_at < b.created_at ? 1 : -1;

/** Latest preview per durable source_system + source_camp_id; repeats are kept only as history. */
export function groupLatestPreviews(runs: SavedPreviewRun[]): PreviewGroup[] {
  const map = new Map<string, SavedPreviewRun[]>();
  for (const r of runs) {
    if (r.status !== "preview") continue;
    const key = `${r.source_system}\u0000${r.source_camp_id}`;
    map.set(key, [...(map.get(key) || []), r]);
  }
  return [...map.entries()].map(([key, list]) => {
    const sorted = [...list].sort(newerFirst);
    return { key, latest: sorted[0], older: sorted.slice(1) };
  }).sort((a, b) => a.latest.source_camp_id.localeCompare(b.latest.source_camp_id, undefined, { numeric: true }) || a.latest.source_system.localeCompare(b.latest.source_system));
}

export type PreviewFreshness = "legacy_stale" | "revalidation_required";
/** A digest only means the server will re-check evidence before import — never "verified current". */
export function previewFreshness(r: Pick<SavedPreviewRun, "digest">): PreviewFreshness {
  return typeof r.digest === "string" && /^[0-9a-f]{32}$/.test(r.digest) ? "revalidation_required" : "legacy_stale";
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
export function previewRowCounts(r: Pick<SavedPreviewRun, "counts">) {
  const c = r.counts || {};
  return { new: num(c.new), updated: num(c.updated), unchanged: num(c.unchanged), review: num(c.ambiguous), rejected: num(c.rejected), rows: num(c.source_rows) };
}

/** Totals over LATEST previews only (camps and file rows), never summing superseded repeats. */
export function latestPreviewSummary(groups: PreviewGroup[]) {
  let reviewRows = 0;
  let unknown = 0;
  for (const g of groups) {
    const n = previewRowCounts(g.latest).review;
    if (n === null) unknown++; else reviewRows += n;
  }
  return { camps: groups.length, campsWithReviewRows: groups.filter((g) => (previewRowCounts(g.latest).review ?? 0) > 0).length, reviewRows, campsWithUnknownCounts: unknown, olderPreviews: groups.reduce((s, g) => s + g.older.length, 0) };
}

export const SAVED_PREVIEW_SELECT = "id,created_at,source_system,source_camp_id,file_name,status,counts,digest:safety_snapshot->>digest,camps(name,start_date)";
/** Only name, classification and reason — no contact, medical, payment or raw row data. */
export const PREVIEW_ROW_SELECT = "id,row_index,classification,reason,conflict,first:normalized->>child_first_name,last:normalized->>child_last_name";

export function savedPreviewsQuery(db: { from: (t: string) => any }, from: number, to: number) {
  return db.from("booking_import_runs").select(SAVED_PREVIEW_SELECT).eq("status", "preview")
    .neq("source_system", "synthetic-test").order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
}
export function previewRowsQuery(db: { from: (t: string) => any }, runId: string, from: number, to: number) {
  return db.from("booking_import_run_rows").select(PREVIEW_ROW_SELECT).eq("run_id", runId).order("row_index").order("id").range(from, to);
}
