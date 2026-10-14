import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { applyRun, DEFAULT_SOURCE, EngineError, prepareRun, resolveRow, syncCamp } from "../_shared/booking-engine.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: userData } = await db.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Not signed in" }, 401);
    const { data: role } = await db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Admins only" }, 403);

    const body = await req.json();
    const sourceSystem = String(body.source_system || DEFAULT_SOURCE);
    // Fault injection is only honoured for synthetic test data
    const failAfterRows = sourceSystem === "synthetic-test" && typeof body.__fail_after === "number" ? body.__fail_after : undefined;

    switch (body.action) {
      case "preview":
        return json(await prepareRun(db, {
          sourceSystem, sourceCampId: String(body.source_camp_id || "").trim(), campId: String(body.camp_id || ""),
          rows: Array.isArray(body.rows) ? body.rows : [], fileName: body.file_name, trigger: "manual", userId,
        }));
      case "commit":
        return json({ success: true, ...(await applyRun(db, String(body.run_id || ""), { auto: false, resolutions: body.resolutions || {}, failAfterRows })) });
      case "resolve":
        return json({ success: true, ...(await resolveRow(db, String(body.row_id || ""), String(body.decision || ""))) });
      case "sync":
        return json({ success: true, ...(await syncCamp(db, {
          sourceSystem, sourceCampId: String(body.source_camp_id || "").trim(), rows: Array.isArray(body.rows) ? body.rows : [], extractedAt: body.extracted_at,
        })) });
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    if (err instanceof EngineError) return json({ error: err.message }, err.status);
    console.error("booking-import error", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
