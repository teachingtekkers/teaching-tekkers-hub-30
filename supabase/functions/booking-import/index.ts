import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { computePatch, planImport, SOURCE_FIELDS, type ExistingRow, type Incoming } from "./logic.ts";

const DEFAULT_SOURCE = "bookings.teachingtekkers.com";
const EXISTING_COLS = [
  "id", "external_booking_id", "source_participant_id", "participant_key", "source_values", "manual_override", "kit_given",
  "matched_camp_id", "source_camp_id", ...SOURCE_FIELDS,
].filter((v, i, a) => a.indexOf(v) === i).join(",");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type DB = any;

async function fetchExisting(db: DB, sourceSystem: string, sourceCampId: string, campId: string): Promise<ExistingRow[]> {
  const out: ExistingRow[] = [];
  for (const filter of [
    (q: DB) => q.eq("source_system", sourceSystem).eq("source_camp_id", sourceCampId),
    // legacy rows imported before source camp IDs existed
    (q: DB) => q.eq("matched_camp_id", campId).is("source_camp_id", null),
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Admin only
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: userData } = await db.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Not signed in" }, 401);
    const { data: role } = await db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Admins only" }, 403);

    const body = await req.json();

    if (body.action === "preview") {
      const sourceSystem = String(body.source_system || DEFAULT_SOURCE);
      const sourceCampId = String(body.source_camp_id || "").trim();
      const campId = String(body.camp_id || "");
      const rows: Incoming[] = Array.isArray(body.rows) ? body.rows : [];
      if (!sourceCampId) return json({ error: "Source camp ID is required" }, 400);
      if (!campId) return json({ error: "Choose the app camp this source camp belongs to" }, 400);
      if (!rows.length || rows.length > 3000) return json({ error: "Expected 1–3000 rows" }, 400);

      const { data: camp } = await db.from("camps").select("id,name").eq("id", campId).maybeSingle();
      if (!camp) return json({ error: "App camp not found" }, 400);
      const { data: mapping } = await db.from("source_camp_mappings").select("camp_id")
        .eq("source_system", sourceSystem).eq("source_camp_id", sourceCampId).maybeSingle();
      if (mapping && mapping.camp_id !== campId) {
        return json({ error: `Source camp ${sourceCampId} is already linked to a different app camp. Pick that camp or change the link first.` }, 409);
      }
      const { data: otherMap } = await db.from("source_camp_mappings").select("source_camp_id")
        .eq("source_system", sourceSystem).eq("camp_id", campId).neq("source_camp_id", sourceCampId);

      const existing = await fetchExisting(db, sourceSystem, sourceCampId, campId);
      const planned = planImport(rows, existing);

      const counts: Record<string, number> = { new: 0, updated: 0, unchanged: 0, ambiguous: 0, rejected: 0 };
      for (const p of planned) counts[p.classification]++;
      const accepted = planned.filter((p) => p.classification !== "rejected");
      counts.participants = accepted.length;
      counts.families = new Set(accepted.map((p) => p.family_key)).size;
      counts.existing_in_app = existing.length;

      const { data: run, error: runErr } = await db.from("booking_import_runs").insert({
        source_system: sourceSystem, source_camp_id: sourceCampId, camp_id: campId,
        file_name: body.file_name || null, counts, created_by: userId,
      }).select("id").single();
      if (runErr) throw runErr;

      const rowInserts = planned.map((p) => ({ ...p, run_id: run.id, raw_row: rows[p.row_index] }));
      for (let i = 0; i < rowInserts.length; i += 500) {
        const { error } = await db.from("booking_import_run_rows").insert(rowInserts.slice(i, i + 500));
        if (error) throw error;
      }

      const candIds = [...new Set(planned.flatMap((p) => [...p.candidate_ids, p.synced_booking_id].filter(Boolean)))];
      const candidates = existing.filter((e) => candIds.includes(e.id)).map((e) => ({
        id: e.id, child_first_name: e.child_first_name, child_last_name: e.child_last_name,
        date_of_birth: e.date_of_birth, parent_email: e.parent_email, parent_phone: e.parent_phone,
      }));
      return json({
        run_id: run.id, counts, rows: planned, candidates, camp_name: camp.name,
        warnings: otherMap?.length ? [`This app camp is also linked to source camp(s) ${otherMap.map((m: DB) => m.source_camp_id).join(", ")}`] : [],
      });
    }

    if (body.action === "commit") {
      const runId = String(body.run_id || "");
      const resolutions: Record<string, string> = body.resolutions || {};
      const { data: run } = await db.from("booking_import_runs").select("*").eq("id", runId).maybeSingle();
      if (!run) return json({ error: "Import preview not found" }, 404);
      if (run.status !== "preview") return json({ error: "This preview has already been imported" }, 409);
      const { data: camp } = await db.from("camps").select("id,name,venue,county,start_date").eq("id", run.camp_id).maybeSingle();
      if (!camp) return json({ error: "App camp no longer exists" }, 400);

      const { data: planRows, error: prErr } = await db.from("booking_import_run_rows").select("*").eq("run_id", runId).order("row_index");
      if (prErr) throw prErr;

      // Decide the action per row
      type Act = { row: DB; kind: "new" | "link" | "skip"; targetId?: string };
      const acts: Act[] = [];
      const unresolved: number[] = [];
      for (const r of planRows) {
        if (r.classification === "rejected") { acts.push({ row: r, kind: "skip" }); continue; }
        if (r.classification === "ambiguous") {
          const res = resolutions[String(r.row_index)];
          if (!res) { unresolved.push(r.row_index + 1); continue; }
          if (res === "skip") acts.push({ row: r, kind: "skip" });
          else if (res === "new") acts.push({ row: r, kind: "new" });
          else if (res.startsWith("link:") && (r.candidate_ids || []).includes(res.slice(5))) acts.push({ row: r, kind: "link", targetId: res.slice(5) });
          else return json({ error: `Invalid choice for row ${r.row_index + 1}` }, 400);
          continue;
        }
        if (r.classification === "new") acts.push({ row: r, kind: "new" });
        else acts.push({ row: r, kind: "link", targetId: r.synced_booking_id });
      }
      if (unresolved.length) return json({ error: `Resolve the review rows first (rows ${unresolved.slice(0, 10).join(", ")})` }, 400);

      const linkTargets = acts.filter((a) => a.kind === "link").map((a) => a.targetId!);
      const dupTarget = linkTargets.find((id, i) => linkTargets.indexOf(id) !== i);
      if (dupTarget) return json({ error: "Two rows are linked to the same existing child. Change one of them." }, 400);

      // Family bookings
      const familyIds = new Map<string, string>();
      const famRows = new Map<string, DB>();
      for (const a of acts) if (a.kind !== "skip") famRows.set(a.row.family_key, a.row.normalized);
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
      await db.from("source_family_bookings").update({ first_import_run_id: runId })
        .eq("source_system", run.source_system).eq("source_camp_id", run.source_camp_id).is("first_import_run_id", null);

      const now = new Date().toISOString();
      const result = { created: 0, updated: 0, unchanged: 0, skipped: 0, protected_rows: 0 };
      const inserts: DB[] = [];
      for (const a of acts) {
        const r = a.row;
        const n = { ...r.normalized };
        const sourcePid = n.source_participant_id || null;
        const sourceBid = n.source_booking_id || null;
        delete n.source_participant_id; delete n.source_booking_id;
        const identity = {
          source_system: run.source_system, source_camp_id: run.source_camp_id, source_participant_id: sourcePid,
          source_booking_id: sourceBid, participant_key: r.participant_key, family_booking_id: familyIds.get(r.family_key) || null,
          source_values: n, last_import_run_id: runId, last_synced_at: now,
        };
        if (a.kind === "skip") { result.skipped++; continue; }
        if (a.kind === "new") {
          inserts.push({
            ...n, ...identity, kit_size: n.kit_size || "M",
            external_booking_id: `src:${run.source_camp_id}:${sourcePid || r.participant_key}`,
            camp_name: camp.name, camp_date: camp.start_date, venue: camp.venue, county: camp.county,
            matched_camp_id: camp.id, match_status: "matched", match_score: 100, match_reason: `Source camp ${run.source_camp_id} mapping`,
            duplicate_warning: false,
          });
          continue;
        }
        // Re-read the current record so edits made after the preview are also protected
        const { data: cur, error: curErr } = await db.from("synced_bookings").select(EXISTING_COLS).eq("id", a.targetId).maybeSingle();
        if (curErr) throw curErr;
        if (!cur) { result.skipped++; continue; }
        const { diff, protectedFields } = computePatch(cur, n);
        const patch: DB = { ...identity };
        for (const [f, v] of Object.entries(diff)) patch[f] = v.to;
        if (protectedFields.length) result.protected_rows++;
        const { error } = await db.from("synced_bookings").update(patch).eq("id", a.targetId);
        if (error) throw error;
        if (Object.keys(diff).length) result.updated++; else result.unchanged++;
        await db.from("booking_import_run_rows").update({ applied: true, diff, protected_fields: protectedFields, synced_booking_id: a.targetId, resolution: resolutions[String(r.row_index)] || null }).eq("id", r.id);
      }
      for (let i = 0; i < inserts.length; i += 200) {
        const { data, error } = await db.from("synced_bookings").insert(inserts.slice(i, i + 200)).select("id,participant_key");
        if (error) throw error;
        result.created += data.length;
        for (const d of data) {
          const r = acts.find((a) => a.kind === "new" && a.row.participant_key === d.participant_key)?.row;
          if (r) await db.from("booking_import_run_rows").update({ applied: true, synced_booking_id: d.id, resolution: resolutions[String(r.row_index)] || null }).eq("id", r.id);
        }
      }

      await db.from("source_camp_mappings").upsert({
        source_system: run.source_system, source_camp_id: run.source_camp_id, camp_id: run.camp_id, updated_at: now,
      }, { onConflict: "source_system,source_camp_id" });
      await db.from("booking_import_runs").update({ status: "committed", committed_at: now, counts: { ...run.counts, result } }).eq("id", runId);
      return json({ success: true, result });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("booking-import error", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
