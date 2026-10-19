import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import {
  fetchAllPages, groupLatestPreviews, latestPreviewSummary, previewFreshness, previewRowsQuery, savedPreviewsQuery, PAGE_SIZE,
  PREVIEW_ROW_SELECT, type SavedPreviewRun,
} from "@/lib/savedPreviews";

const run = (id: string, camp: string, at: string, review: number, extra: Partial<SavedPreviewRun> = {}): SavedPreviewRun => ({
  id, created_at: at, source_system: "src-a", source_camp_id: camp, file_name: `${camp}.csv`, status: "preview",
  counts: { new: 1, updated: 0, unchanged: 0, ambiguous: review, rejected: 0, source_rows: 1 + review }, digest: null, camps: null, ...extra,
});

describe("saved preview visibility", () => {
  it("keeps only the latest preview per source camp and never sums superseded repeats", () => {
    const g = groupLatestPreviews([run("a", "176", "2026-10-19T10:00Z", 47), run("b", "176", "2026-10-19T10:22Z", 47), run("c", "176", "2026-10-18T09:00Z", 47)]);
    expect(g).toHaveLength(1);
    expect(g[0].latest.id).toBe("b");
    expect(g[0].older.map((r) => r.id)).toEqual(["a", "c"]);
    expect(latestPreviewSummary(g)).toMatchObject({ camps: 1, reviewRows: 47, olderPreviews: 2 });
  });
  it("breaks equal timestamps by id deterministically", () => {
    const g = groupLatestPreviews([run("aaa", "180", "2026-10-19T18:38Z", 7), run("bbb", "180", "2026-10-19T18:38Z", 5)]);
    expect(g[0].latest.id).toBe("bbb");
  });
  it("same camp id under different source systems stays separate", () => {
    const g = groupLatestPreviews([run("a", "180", "2026-10-19T10:00Z", 1), run("b", "180", "2026-10-19T11:00Z", 2, { source_system: "src-b" })]);
    expect(g).toHaveLength(2);
    expect(latestPreviewSummary(g).reviewRows).toBe(3);
  });
  it("ignores committed/failed runs so history and previews stay distinct", () => {
    expect(groupLatestPreviews([run("a", "1", "2026-10-19T10:00Z", 1, { status: "committed" }), run("b", "2", "2026-10-19T10:00Z", 1, { status: "failed" })])).toHaveLength(0);
  });
  it("legacy previews without a digest are stale; a digest only means revalidation is required", () => {
    expect(previewFreshness({ digest: null })).toBe("legacy_stale");
    expect(previewFreshness({ digest: "nothex" })).toBe("legacy_stale");
    expect(previewFreshness({ digest: "0123456789abcdef0123456789abcdef" })).toBe("revalidation_required");
  });
  it("missing counts are reported as unknown, not zero", () => {
    const s = latestPreviewSummary(groupLatestPreviews([run("a", "1", "2026-10-19T10:00Z", 0, { counts: {} })]));
    expect(s).toMatchObject({ reviewRows: 0, campsWithUnknownCounts: 1 });
  });
  it("loads beyond 1000 rows and fails closed on any page error", async () => {
    const all = Array.from({ length: 2500 }, (_, i) => i);
    const got = await fetchAllPages<number>(async (f, t) => ({ data: all.slice(f, t + 1), error: null }));
    expect(got).toHaveLength(2500);
    await expect(fetchAllPages(async (f) => (f >= PAGE_SIZE ? { data: null, error: { message: "boom" } } : { data: all.slice(0, PAGE_SIZE), error: null }))).rejects.toBeTruthy();
  });
  it("queries are read-only, preview-only and row details exclude contact/medical/raw fields", () => {
    const calls: string[] = [];
    const q: any = new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => { calls.push(`${k}:${JSON.stringify(a)}`); return q; } });
    savedPreviewsQuery({ from: () => q }, 0, 999);
    previewRowsQuery({ from: () => q }, "r", 0, 999);
    expect(calls.some((c) => /^(insert|update|upsert|delete|rpc)/.test(c))).toBe(false);
    expect(calls).toContain('eq:["status","preview"]');
    expect(PREVIEW_ROW_SELECT).not.toMatch(/email|phone|medical|raw_row|amount|diff/);
  });
  it("only admins can read runs/rows (existing policy; no widened access)", () => {
    const mig = readFileSync("src/components/booking-sync/SavedPreviewsPanel.tsx", "utf8");
    expect(mig).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(|functions\.invoke/);
  });
});
