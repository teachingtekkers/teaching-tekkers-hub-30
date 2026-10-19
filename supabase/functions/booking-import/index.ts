import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { applyRun, DEFAULT_SOURCE, EngineError, prepareRun, resolveRow, syncCamp } from "../_shared/booking-engine.ts";
import { describeBackendError } from "../_shared/booking-errors.ts";
import { z } from "npm:zod@3.25.76";

const requestSchema = z.object({
  action: z.enum(["preview", "decisions", "commit", "resolve", "sync"]),
  source_system: z.string().trim().min(1).max(200).optional(),
  source_camp_id: z.string().trim().min(1).max(100).optional(), camp_id: z.string().uuid().optional(),
  file_name: z.string().max(500).optional(), run_id: z.string().uuid().optional(), row_id: z.string().uuid().optional(),
  rows: z.array(z.record(z.string().max(10000))).max(3000).optional(),
  decisions: z.record(z.string().max(100)).optional(), decision: z.string().max(100).optional(),
}).strict();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) throw new Error("Import configuration unavailable");
    const db = createClient(url, serviceKey);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: userData } = await db.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Not signed in" }, 401);
    const { data: role } = await db.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Admins only" }, 403);

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid import request", issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })) }, 400);
    const body = parsed.data;
    const adminDb = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const sourceSystem = String(body.source_system || DEFAULT_SOURCE);

    switch (body.action) {
      case "preview":
        return json(await prepareRun(db, {
          sourceSystem, sourceCampId: String(body.source_camp_id || "").trim(), campId: String(body.camp_id || ""),
          rows: Array.isArray(body.rows) ? body.rows : [], fileName: body.file_name, trigger: "manual", userId,
        }));
      case "commit":
        return json({ success: true, ...(await applyRun(db, String(body.run_id || ""), { auto: false, adminDb })) });
      case "decisions": {
        const { error } = await adminDb.rpc("save_csv_decisions", { _run_id: body.run_id, _decisions: body.decisions || {} });
        if (error) throw new EngineError(error.message, 409);
        return json({ success: true });
      }
      case "resolve":
        return json({ success: true, ...(await resolveRow(db, String(body.row_id || ""), String(body.decision || ""))) });
      case "sync":
        return json({ error: "Automatic import is not connected; use preview and explicit commit" }, 409);
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    if (err instanceof EngineError) return json({ error: err.message }, err.status);
    console.error("booking-import error", err);
    const info = describeBackendError(err);
    return json({ error: info.message, ...(info.code ? { code: info.code } : {}) }, info.status);
  }
});
