import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const deleted: Record<string, number> = {};

    // 1. Delete all synced_bookings
    const { data: sb } = await supabase
      .from("synced_bookings")
      .select("id", { count: "exact", head: false });
    const sbCount = sb?.length || 0;

    const { error: sbErr } = await supabase
      .from("synced_bookings")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all
    if (sbErr) throw new Error(`synced_bookings: ${sbErr.message}`);
    deleted.synced_bookings = sbCount;

    // 2. Delete all sync_logs
    const { data: sl } = await supabase
      .from("sync_logs")
      .select("id", { count: "exact", head: false });
    const slCount = sl?.length || 0;

    const { error: slErr } = await supabase
      .from("sync_logs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (slErr) throw new Error(`sync_logs: ${slErr.message}`);
    deleted.sync_logs = slCount;

    // 3. Delete draft / auto-created camps
    const { data: dc } = await supabase
      .from("camps")
      .select("id")
      .or("status.eq.draft,is_auto_created.eq.true");
    const dcCount = dc?.length || 0;

    if (dcCount > 0) {
      const { error: dcErr } = await supabase
        .from("camps")
        .delete()
        .or("status.eq.draft,is_auto_created.eq.true");
      if (dcErr) throw new Error(`camps: ${dcErr.message}`);
    }
    deleted.draft_camps = dcCount;

    // 4. Clear matched_player_id references on players that were created from imports
    // (We don't delete players since they may have been manually curated)

    return new Response(
      JSON.stringify({ success: true, deleted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
