// Shared import engine used by manual CSV imports and automatic sync.
import { computePatch, planImport, SOURCE_FIELDS, type ExistingRow, type Incoming } from "./booking-logic.ts";
import { prepareSafeRun } from "./booking-safe-engine.ts";

export const DEFAULT_SOURCE = "bookings.teachingtekkers.com";
export const EXISTING_COLS = [
  "id", "external_booking_id", "source_participant_id", "participant_key", "source_values", "manual_override", "kit_given",
  "matched_camp_id", "source_camp_id", ...SOURCE_FIELDS,
].filter((v, i, a) => a.indexOf(v) === i).join(",");
const LOCK_MINUTES = 10;

// deno-lint-ignore no-explicit-any
export type DB = any;

export class EngineError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function fetchExisting(db: DB, sourceSystem: string, sourceCampId: string, campId: string): Promise<ExistingRow[]> {
  const out: ExistingRow[] = [];
  for (const filter of [
    (q: DB) => q.eq("source_system", sourceSystem).eq("source_camp_id", sourceCampId),
    (q: DB) => q.eq("matched_camp_id", campId).is("source_camp_id", null), // rows from the old importer
  ]) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await filter(db.from("synced_bookings").select(EXISTING_COLS)).order("id").range(from, from + 999);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
  }
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

export async function resolveMappedCamp(db: DB, sourceSystem: string, sourceCampId: string): Promise<string | null> {
  const { data } = await db.from("source_camp_mappings").select("camp_id").eq("source_system", sourceSystem).eq("source_camp_id", sourceCampId).maybeSingle();
  return data?.camp_id ?? null;
}

export interface PrepareInput {
  sourceSystem: string; sourceCampId: string; campId: string; rows: Incoming[];
  fileName?: string | null; trigger: "manual" | "auto"; extractedAt?: string | null; userId?: string | null;
}

/** Stage the source rows and classify them. Writes nothing to bookings. */
export async function prepareRun(db: DB, inp: PrepareInput) {
  if (inp.trigger === "manual") return prepareSafeRun(db, inp);
  if (!inp.sourceCampId) throw new EngineError("Source camp ID is required");
  if (!inp.campId) throw new EngineError("Choose the app camp this source camp belongs to");
  if (!inp.rows.length || inp.rows.length > 3000) throw new EngineError("Expected 1–3000 rows");
  const { data: camp } = await db.from("camps").select("id,name").eq("id", inp.campId).maybeSingle();
  if (!camp) throw new EngineError("App camp not found");
  const mapped = await resolveMappedCamp(db, inp.sourceSystem, inp.sourceCampId);
  if (mapped && mapped !== inp.campId) {
    throw new EngineError(`Source camp ${inp.sourceCampId} is already linked to a different app camp. Pick that camp or change the link first.`, 409);
  }
  const { data: otherMap } = await db.from("source_camp_mappings").select("source_camp_id")
    .eq("source_system", inp.sourceSystem).eq("camp_id", inp.campId).neq("source_camp_id", inp.sourceCampId);

  const existing = await fetchExisting(db, inp.sourceSystem, inp.sourceCampId, inp.campId);
  const planned = planImport(inp.rows, existing);

  const counts: Record<string, number> = { new: 0, updated: 0, unchanged: 0, ambiguous: 0, rejected: 0, conflicts: 0 };
  for (const p of planned) { counts[p.classification]++; if (p.conflict) counts.conflicts++; }
  const accepted = planned.filter((p) => p.classification !== "rejected");
  counts.participants = accepted.length;
  counts.families_verified = new Set(accepted.filter((p) => p.family_verified).map((p) => p.family_key)).size;
  counts.families_estimated = new Set(accepted.filter((p) => !p.family_verified).map((p) => p.family_key)).size;
  counts.existing_in_app = existing.length;

  const { data: run, error: runErr } = await db.from("booking_import_runs").insert({
    source_system: inp.sourceSystem, source_camp_id: inp.sourceCampId, camp_id: inp.campId,
    file_name: inp.fileName || null, counts, created_by: inp.userId || null, trigger: inp.trigger,
    extracted_at: inp.extractedAt || new Date().toISOString(),
  }).select("id").single();
  if (runErr) throw runErr;

  const rowInserts = planned.map((p) => ({ ...p, run_id: run.id, raw_row: inp.rows[p.row_index] }))
    .map(({ family_verified: _fv, ...r }) => r);
  for (let i = 0; i < rowInserts.length; i += 500) {
    const { error } = await db.from("booking_import_run_rows").insert(rowInserts.slice(i, i + 500));
    if (error) throw error;
  }

  const candIds = new Set(planned.flatMap((p) => [...p.candidate_ids, p.synced_booking_id].filter(Boolean) as string[]));
  const candidates = existing.filter((e) => candIds.has(e.id)).map((e) => ({
    id: e.id, child_first_name: e.child_first_name, child_last_name: e.child_last_name,
    date_of_birth: e.date_of_birth, parent_email: e.parent_email, parent_phone: e.parent_phone,
  }));
  return {
    run_id: run.id, counts, rows: planned, candidates, camp_name: camp.name,
    warnings: otherMap?.length ? [`This app camp is also linked to source camp(s) ${otherMap.map((m: DB) => m.source_camp_id).join(", ")}`] : [],
  };
}

function splitNormalized(r: DB, run: DB, familyId: string | null, runId: string) {
  const n = { ...r.normalized };
  const sourcePid = n.source_participant_id || null;
  const sourceBid = n.source_booking_id || null;
  delete n.source_participant_id; delete n.source_booking_id;
  const identity = {
    source_system: run.source_system, source_camp_id: run.source_camp_id, source_participant_id: sourcePid,
    source_booking_id: sourceBid, participant_key: r.participant_key, family_booking_id: familyId,
    source_values: n, last_import_run_id: runId, last_synced_at: new Date().toISOString(),
  };
  return { n, identity, sourcePid };
}

async function applyLink(db: DB, targetId: string, n: DB, identity: DB, force = false) {
  const { data: cur, error } = await db.from("synced_bookings").select(EXISTING_COLS).eq("id", targetId).maybeSingle();
  if (error) throw error;
  if (!cur) return null;
  // Recheck against the current record so staff edits made after the preview are kept
  const { diff, protectedFields } = computePatch(cur, n);
  const patch: DB = { ...identity };
  for (const [f, v] of Object.entries(diff)) patch[f] = v.to;
  if (force) for (const f of protectedFields) patch[f] = n[f];
  const { error: upErr } = await db.from("synced_bookings").update(patch).eq("id", targetId);
  if (upErr) throw upErr;
  return { diff, protectedFields: force ? [] : protectedFields };
}

async function insertNew(db: DB, run: DB, camp: DB, r: DB, n: DB, identity: DB, sourcePid: string | null) {
  const extId = `src:${run.source_camp_id}:${sourcePid || r.participant_key}`;
  const row = {
    ...n, ...identity, kit_size: n.kit_size || "M", external_booking_id: extId,
    camp_name: camp.name, camp_date: camp.start_date, venue: camp.venue, county: camp.county,
    matched_camp_id: camp.id, match_status: "matched", match_score: 100, match_reason: `Source camp ${run.source_camp_id} mapping`,
    duplicate_warning: false,
  };
  // Deterministic ID + ignore duplicates: a retried import never creates a second copy
  const { error } = await db.from("synced_bookings").upsert(row, { onConflict: "external_booking_id,source_system", ignoreDuplicates: true });
  if (error) throw error;
  const { data } = await db.from("synced_bookings").select("id").eq("external_booking_id", extId).eq("source_system", run.source_system).single();
  return data.id as string;
}

export interface ApplyOptions { resolutions?: Record<string, string>; auto: boolean; failAfterRows?: number; adminDb?: DB }

/** Apply a staged run. Safe to retry: applied rows are skipped and new rows use deterministic IDs. */
export async function applyRun(db: DB, runId: string, opts: ApplyOptions) {
  if (!opts.auto) {
    if (!opts.adminDb) throw new EngineError("Authenticated admin transaction required", 403);
    const { data, error } = await opts.adminDb.rpc("commit_csv_safety_run", { _run_id: runId });
    if (error) throw new EngineError(error.message, 409);
    return data;
  }
  const resolutions = opts.resolutions || {};
  const { data: run0 } = await db.from("booking_import_runs").select("*").eq("id", runId).maybeSingle();
  if (!run0) throw new EngineError("Import preview not found", 404);
  if (run0.status === "committed" || run0.status === "needs_review") throw new EngineError("This preview has already been imported", 409);

  const { data: planRows0, error: prErr } = await db.from("booking_import_run_rows").select("*").eq("run_id", runId).order("row_index");
  if (prErr) throw prErr;
  if (!opts.auto) {
    const unresolved = planRows0.filter((r: DB) => r.classification === "ambiguous" && !r.applied && !resolutions[String(r.row_index)]);
    if (unresolved.length) throw new EngineError(`Resolve the review rows first (rows ${unresolved.slice(0, 10).map((r: DB) => r.row_index + 1).join(", ")})`);
    const targets = Object.values(resolutions).filter((v) => v.startsWith("link:"));
    if (new Set(targets).size !== targets.length) throw new EngineError("Two rows are linked to the same existing child. Change one of them.");
  }

  // Overlap protection: one active run per source camp
  const staleBefore = new Date(Date.now() - LOCK_MINUTES * 60_000).toISOString();
  const { data: active } = await db.from("booking_import_runs").select("id").eq("source_system", run0.source_system)
    .eq("source_camp_id", run0.source_camp_id).eq("status", "committing").gt("locked_at", staleBefore).neq("id", runId);
  if (active?.length) throw new EngineError("Another import for this camp is still running. Try again shortly.", 409);
  const { data: locked } = await db.from("booking_import_runs").update({ status: "committing", locked_at: new Date().toISOString(), error: null })
    .eq("id", runId).or(`status.in.(preview,failed),and(status.eq.committing,locked_at.lt.${staleBefore})`).select("*");
  if (!locked?.length) throw new EngineError("This import is already being applied.", 409);
  const run = locked[0];

  const result = { created: 0, updated: 0, unchanged: 0, skipped: 0, protected_rows: 0, pending_review: 0 };
  try {
    const { data: camp } = await db.from("camps").select("id,name,venue,county,start_date").eq("id", run.camp_id).maybeSingle();
    if (!camp) throw new EngineError("App camp no longer exists");

    // Family bookings (idempotent upsert)
    const famRows = new Map<string, DB>();
    for (const r of planRows0) if (r.classification !== "rejected" && r.family_key) famRows.set(r.family_key, r.normalized);
    const familyIds = new Map<string, string>();
    const famPayload = [...famRows.entries()].map(([k, n]) => ({
      source_system: run.source_system, source_camp_id: run.source_camp_id, family_key: k,
      source_booking_id: n.source_booking_id || null, guardian_name: n.parent_name, guardian_email: n.parent_email,
      guardian_phone: n.parent_phone, last_import_run_id: runId, updated_at: new Date().toISOString(),
    }));
    for (let i = 0; i < famPayload.length; i += 500) {
      const { data, error } = await db.from("source_family_bookings")
        .upsert(famPayload.slice(i, i + 500), { onConflict: "source_system,source_camp_id,family_key" }).select("id,family_key");
      if (error) throw error;
      for (const f of data) familyIds.set(f.family_key, f.id);
    }

    // Fresh view of the camp, used to revalidate rows planned as "new"
    const fresh = await fetchExisting(db, run.source_system, run.source_camp_id, run.camp_id);
    const claimedNow = new Set(planRows0.filter((r: DB) => r.synced_booking_id).map((r: DB) => r.synced_booking_id));

    // Runs for this source camp, used to replace older unresolved review items for the same child
    const { data: campRuns } = await db.from("booking_import_runs").select("id")
      .eq("source_system", run.source_system).eq("source_camp_id", run.source_camp_id).neq("id", runId);
    const otherRunIds = (campRuns || []).map((x: DB) => x.id);
    const supersede = async (bookingId: string | null, pKey: string | null) => {
      if (!otherRunIds.length) return;
      let q = db.from("booking_import_run_rows").update({ review_status: "superseded" }).in("run_id", otherRunIds).eq("review_status", "pending");
      q = bookingId ? q.eq("synced_booking_id", bookingId) : q.eq("participant_key", pKey).is("synced_booking_id", null);
      await q;
    };

    let processed = 0;
    for (const r of planRows0) {
      if (r.applied) continue;
      if (opts.failAfterRows != null && processed >= opts.failAfterRows) throw new Error("Simulated interruption");
      const famId = familyIds.get(r.family_key) || null;
      const { n, identity, sourcePid } = splitNormalized(r, run, famId, runId);
      const res = resolutions[String(r.row_index)];
      let kind: "new" | "link" | "skip" | "review";
      let targetId: string | null = null;

      if (r.classification === "rejected") kind = "skip";
      else if (r.classification === "ambiguous") {
        if (!res) kind = "review";
        else if (res === "skip") kind = "skip";
        else if (res === "new") kind = "new";
        else if (res.startsWith("link:") && (r.candidate_ids || []).includes(res.slice(5))) { kind = "link"; targetId = res.slice(5); }
        else throw new EngineError(`Invalid choice for row ${r.row_index + 1}`);
      } else if (r.classification === "new") kind = "new";
      else { kind = "link"; targetId = r.synced_booking_id; }

      if (kind === "new" && r.classification === "new") {
        // Did a matching child appear after the preview? Then don't create a second one.
        const [re] = planImport([r.raw_row], fresh.filter((e) => !claimedNow.has(e.id)));
        if (re.classification !== "new") {
          kind = "review";
          r.reason = `Changed since preview: ${re.reason}`;
          r.candidate_ids = re.synced_booking_id ? [re.synced_booking_id] : re.candidate_ids;
        }
      }

      const rowUpdate: DB = { applied: true, resolution: res || null };
      if (kind === "skip") { result.skipped++; }
      else if (kind === "review") {
        result.pending_review++;
        await supersede(null, r.participant_key);
        Object.assign(rowUpdate, { applied: false, review_status: "pending", classification: "ambiguous", reason: r.reason, candidate_ids: r.candidate_ids });
      } else if (kind === "new") {
        rowUpdate.synced_booking_id = await insertNew(db, run, camp, r, n, identity, sourcePid);
        result.created++;
      } else {
        const out = await applyLink(db, targetId!, n, identity);
        if (!out) { result.skipped++; rowUpdate.reason = "Record no longer exists"; }
        else {
          Object.assign(rowUpdate, { diff: out.diff, protected_fields: out.protectedFields, synced_booking_id: targetId, conflict: out.protectedFields.length > 0 });
          if (Object.keys(out.diff).length) result.updated++; else result.unchanged++;
          if (out.protectedFields.length) {
            result.protected_rows++;
            const sourceDiffers = out.protectedFields.some((f) => String(n[f] ?? "") !== "");
            if (sourceDiffers) { rowUpdate.review_status = "pending"; await supersede(targetId, null); }
          }
        }
      }
      const { error: rowErr } = await db.from("booking_import_run_rows").update(rowUpdate).eq("id", r.id);
      if (rowErr) throw rowErr;
      processed++;
    }

    await db.from("source_camp_mappings").upsert({
      source_system: run.source_system, source_camp_id: run.source_camp_id, camp_id: run.camp_id, updated_at: new Date().toISOString(),
    }, { onConflict: "source_system,source_camp_id" });
    const { count: pending } = await db.from("booking_import_run_rows").select("id", { count: "exact", head: true })
      .eq("run_id", runId).eq("review_status", "pending");
    const status = (pending || 0) > 0 ? "needs_review" : "committed";
    const prevResult = run.counts?.result || {};
    const merged: DB = { ...result };
    for (const k of Object.keys(result)) if (k !== "pending_review") merged[k] = (prevResult[k] || 0) + (result as DB)[k];
    merged.pending_review = pending || 0;
    await db.from("booking_import_runs").update({ status, committed_at: new Date().toISOString(), locked_at: null, counts: { ...run.counts, result: merged } }).eq("id", runId);
    await db.from("booking_sync_settings").update({ last_success_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", 1);
    return { status, result: merged };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from("booking_import_runs").update({ status: "failed", error: msg, locked_at: null, counts: { ...run.counts, partial: result } }).eq("id", runId);
    await db.from("booking_sync_settings").update({ last_failure_at: new Date().toISOString(), last_error: msg, updated_at: new Date().toISOString() }).eq("id", 1);
    throw e;
  }
}

/** Resolve one review-queue row. */
export async function resolveRow(db: DB, rowId: string, decision: string) {
  // Historical conflicts must not be force-applied by the old nontransactional resolver.
  throw new EngineError("Held values are unchanged. Use a fresh preview; identity and sensitive-field decisions need separate verified review.", 409);
  /* Deprecated nontransactional resolver retained below for historical reference.
  const { data: r } = await db.from("booking_import_run_rows").select("*").eq("id", rowId).maybeSingle();
  if (!r || r.review_status !== "pending") throw new EngineError("This item is no longer waiting for review", 409);
  const { data: run } = await db.from("booking_import_runs").select("*").eq("id", r.run_id).single();
  const { data: camp } = await db.from("camps").select("id,name,venue,county,start_date").eq("id", run.camp_id).maybeSingle();
  if (!camp) throw new EngineError("App camp no longer exists");
  const { data: fam } = await db.from("source_family_bookings").select("id")
    .eq("source_system", run.source_system).eq("source_camp_id", run.source_camp_id).eq("family_key", r.family_key).maybeSingle();
  const { n, identity, sourcePid } = splitNormalized(r, run, fam?.id || null, run.id);
  const upd: DB = { review_status: "resolved", resolution: decision, applied: true };

  if (r.conflict && r.synced_booking_id && (decision === "accept_source" || decision === "keep_app")) {
    if (decision === "accept_source") {
      const out = await applyLink(db, r.synced_booking_id, n, identity, true);
      upd.diff = out?.diff;
    } else {
      // Keep the app values; remember the source value so the same difference isn't re-flagged
      await db.from("synced_bookings").update({ source_values: n, last_import_run_id: run.id }).eq("id", r.synced_booking_id);
    }
  } else if (decision === "skip") {
    upd.applied = false;
  } else if (decision === "new") {
    upd.synced_booking_id = await insertNew(db, run, camp, r, n, identity, sourcePid);
  } else if (decision.startsWith("link:") && (r.candidate_ids || []).includes(decision.slice(5))) {
    const out = await applyLink(db, decision.slice(5), n, identity);
    if (!out) throw new EngineError("That record no longer exists");
    Object.assign(upd, { synced_booking_id: decision.slice(5), diff: out.diff, protected_fields: out.protectedFields, conflict: out.protectedFields.length > 0 });
    if (out.protectedFields.length) upd.review_status = "pending";
  } else throw new EngineError("Invalid decision");

  await db.from("booking_import_run_rows").update(upd).eq("id", rowId);
  const { count } = await db.from("booking_import_run_rows").select("id", { count: "exact", head: true }).eq("run_id", run.id).eq("review_status", "pending");
  if (!count) await db.from("booking_import_runs").update({ status: "committed" }).eq("id", run.id).eq("status", "needs_review");
  return { remaining_in_run: count || 0 };
  */
}

/** Automatic path: only already-mapped camps; applies safe rows, queues the rest. */
export async function syncCamp(db: DB, inp: { sourceSystem: string; sourceCampId: string; rows: Incoming[]; extractedAt?: string | null }) {
  const { data: settings } = await db.from("booking_sync_settings").select("paused").eq("id", 1).maybeSingle();
  if (settings?.paused) throw new EngineError("Automatic sync is paused", 423);
  const campId = await resolveMappedCamp(db, inp.sourceSystem, inp.sourceCampId);
  if (!campId) throw new EngineError(`Source camp ${inp.sourceCampId} is not linked to an app camp yet. Import it once manually to create the link.`, 422);
  const prep = await prepareRun(db, { ...inp, campId, trigger: "auto", fileName: "automatic sync" });
  const applied = await applyRun(db, prep.run_id, { auto: true });
  return { run_id: prep.run_id, counts: prep.counts, ...applied };
}
