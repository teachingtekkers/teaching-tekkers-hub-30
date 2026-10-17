import { planImport, type Incoming } from "./booking-logic.ts";
import { applyGlobalSafety, scopedExisting, type SafetySnapshot } from "./booking-safety.ts";

// Service-only snapshot and staging RPCs; ordinary users cannot inject plans or updates.
export async function prepareSafeRun(db: any, inp: {
  sourceSystem: string; sourceCampId: string; campId: string; rows: Incoming[];
  fileName?: string | null; userId?: string | null;
}) {
  if (!inp.userId || !inp.sourceCampId || !inp.campId || inp.rows.length < 1 || inp.rows.length > 3000) throw new Error("Authenticated admin, mapped camp and 1–3000 rows required");
  const { data: snapshot, error } = await db.rpc("csv_safety_snapshot");
  if (error) throw error;
  const state = snapshot as SafetySnapshot;
  const camps = state.camps as { id: string; name: string }[];
  const camp = camps.find((c) => c.id === inp.campId);
  if (!camp) throw new Error("App camp not found");
  const existing = scopedExisting(state, inp.sourceSystem, inp.sourceCampId, inp.campId);
  const planned = applyGlobalSafety(planImport(inp.rows, existing), state, inp.sourceCampId);
  const counts: Record<string, number> = { new: 0, updated: 0, unchanged: 0, ambiguous: 0, rejected: 0, conflicts: 0, source_rows: inp.rows.length };
  for (const r of planned) { counts[r.classification]++; if (r.conflict) counts.conflicts++; }
  const accepted = planned.filter((r) => r.classification !== "rejected");
  counts.participants = accepted.length;
  counts.families_verified = new Set(accepted.filter((r) => r.family_verified).map((r) => r.family_key)).size;
  counts.families_estimated = new Set(accepted.filter((r) => !r.family_verified).map((r) => r.family_key)).size;
  counts.existing_in_app = existing.length;
  const { data: id, error: stageError } = await db.rpc("stage_csv_safety_run", { payload: {
    source_system: inp.sourceSystem, source_camp_id: inp.sourceCampId, camp_id: inp.campId,
    user_id: inp.userId, file_name: inp.fileName ?? null, counts, snapshot,
    rows: planned.map(({ family_verified: _fv, ...p }) => ({ ...p, raw_row: inp.rows[p.row_index] })),
  } });
  if (stageError) throw stageError;
  return { run_id: id, counts, rows: planned, candidates: existing, camp_name: camp.name,
    warnings: ["Cross-camp profiles and registrations checked without a row limit. Safety conflicts remain held; skip them to import eligible rows. Any relevant data change after preview requires a fresh preview."] };
}