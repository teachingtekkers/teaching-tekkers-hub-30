import { planImport, type Incoming } from "./booking-logic.ts";
import { applyGlobalSafety, scopedExisting, type SafetySnapshot } from "./booking-safety.ts";

// Service-only snapshot and staging RPCs; ordinary users cannot inject plans or updates.
export async function prepareSafeRun(db: any, inp: {
  sourceSystem: string; sourceCampId: string; campId: string; rows: Incoming[];
  fileName?: string | null; userId?: string | null;
}) {
  if (!inp.userId || !inp.sourceCampId || !inp.campId || inp.rows.length < 1 || inp.rows.length > 3000) throw new Error("Authenticated admin, mapped camp and 1–3000 rows required");
  // One server call returns the snapshot and the digest of that exact snapshot; staging
  // re-verifies only the digest (no multi-MB round trip that can hit the statement timeout).
  const { data: evidence, error } = await db.rpc("csv_safety_evidence");
  if (error) throw error;
  const digest = (evidence as { digest?: unknown } | null)?.digest;
  if (!evidence || typeof digest !== "string" || !/^[0-9a-f]{32}$/.test(digest)) throw new Error("Safety evidence unavailable; nothing was saved. Please preview again.");
  const state = (evidence as { snapshot: SafetySnapshot }).snapshot;
  const camps = state.camps as { id: string; name: string }[];
  const camp = camps.find((c) => c.id === inp.campId);
  if (!camp) throw new Error("App camp not found");
  const existing = scopedExisting(state, inp.sourceSystem, inp.sourceCampId, inp.campId);
  const plan = planImport(inp.rows, existing);
  for (const p of plan) p.normalized._destination_camp = inp.campId;
  const planned = applyGlobalSafety(plan, state, inp.sourceCampId);
  const counts: Record<string, number> = { new: 0, updated: 0, unchanged: 0, ambiguous: 0, rejected: 0, conflicts: 0, source_rows: inp.rows.length };
  for (const r of planned) { counts[r.classification]++; if (r.conflict) counts.conflicts++; }
  const accepted = planned.filter((r) => r.classification !== "rejected");
  counts.participants = accepted.length;
  counts.families_verified = new Set(accepted.filter((r) => r.family_verified).map((r) => r.family_key)).size;
  counts.families_estimated = new Set(accepted.filter((r) => !r.family_verified).map((r) => r.family_key)).size;
  counts.existing_in_app = existing.length;
  const { data: id, error: stageError } = await db.rpc("stage_csv_safety_run", { payload: {
    source_system: inp.sourceSystem, source_camp_id: inp.sourceCampId, camp_id: inp.campId,
    user_id: inp.userId, file_name: inp.fileName ?? null, counts, snapshot_digest: digest,
    rows: planned.map(({ family_verified: _fv, ...p }) => ({ ...p, raw_row: inp.rows[p.row_index] })),
  } });
  if (stageError) throw stageError;
  return { run_id: id, counts, rows: planned, candidates: existing, camp_name: camp.name,
    warnings: ["Cross-camp profiles and registrations checked without a row limit. Safety conflicts remain held; skip them to import eligible rows. Any relevant data change after preview requires a fresh preview."] };
}