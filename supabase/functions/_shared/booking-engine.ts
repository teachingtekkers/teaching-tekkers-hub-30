// Shared entrypoint: all manual booking writes use the admin-authorized atomic RPC.
import { type Incoming } from "./booking-logic.ts";
import { prepareSafeRun } from "./booking-safe-engine.ts";

export const DEFAULT_SOURCE = "bookings.teachingtekkers.com";
// deno-lint-ignore no-explicit-any
export type DB = any;
export class EngineError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function resolveMappedCamp(db: DB, sourceSystem: string, sourceCampId: string): Promise<string | null> {
  const { data } = await db.from("source_camp_mappings").select("camp_id").eq("source_system", sourceSystem).eq("source_camp_id", sourceCampId).maybeSingle();
  return data?.camp_id ?? null;
}

export interface PrepareInput {
  sourceSystem: string; sourceCampId: string; campId: string; rows: Incoming[];
  fileName?: string | null; trigger: "manual" | "auto"; extractedAt?: string | null; userId?: string | null;
}

/** Stage immutable server decisions; never writes real registrations. */
export async function prepareRun(db: DB, inp: PrepareInput) {
  if (inp.trigger !== "manual") throw new EngineError("Automatic import is not connected", 409);
  return prepareSafeRun(db, inp);
}

export interface ApplyOptions { auto: boolean; adminDb?: DB }
/** Commit exactly one persisted preview, authorized by the existing admin JWT. */
export async function applyRun(_db: DB, runId: string, opts: ApplyOptions) {
  if (opts.auto || !opts.adminDb) throw new EngineError("Authenticated admin transaction required", 403);
  const { data, error } = await opts.adminDb.rpc("commit_csv_safety_run", { _run_id: runId });
  if (error) throw new EngineError(error.message, 409);
  return data;
}

export async function resolveRow(_db: DB, _rowId: string, _decision: string) {
  throw new EngineError("Held values are unchanged. Use a fresh preview; identity and sensitive-field decisions need separate verified review.", 409);
}

export async function syncCamp(_db: DB, _inp: { sourceSystem: string; sourceCampId: string; rows: Incoming[]; extractedAt?: string | null }) {
  throw new EngineError("Automatic import is not connected; use authenticated preview and explicit commit", 409);
}
