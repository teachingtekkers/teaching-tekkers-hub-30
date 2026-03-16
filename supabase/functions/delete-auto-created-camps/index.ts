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

    // Find all auto-created draft camps
    const { data: draftCamps, error: findErr } = await supabase
      .from("camps")
      .select("id")
      .eq("status", "draft")
      .eq("is_auto_created", true);

    if (findErr) throw findErr;

    const campIds = (draftCamps || []).map((c: any) => c.id);

    if (campIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, deleted_camps: 0, deleted_bookings: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete synced_bookings matched to these camps
    let deletedBookings = 0;
    const BATCH = 50;
    for (let i = 0; i < campIds.length; i += BATCH) {
      const batch = campIds.slice(i, i + BATCH);
      const { data: sbRows } = await supabase
        .from("synced_bookings")
        .select("id")
        .in("matched_camp_id", batch);
      const count = sbRows?.length || 0;
      if (count > 0) {
        // Unlink bookings (set matched_camp_id to null) rather than delete them
        await supabase
          .from("synced_bookings")
          .update({ matched_camp_id: null, match_status: "unmatched", match_score: null, match_reason: "Camp deleted (auto-created draft cleanup)" })
          .in("matched_camp_id", batch);
        deletedBookings += count;
      }

      // Delete related records
      await supabase.from("camp_coach_assignments").delete().in("camp_id", batch);
      await supabase.from("attendance").delete().in("camp_id", batch);
      await supabase.from("camp_financial_overrides").delete().in("camp_id", batch);
      await supabase.from("session_plan_assignments").delete().in("camp_id", batch);
      await supabase.from("camp_messages").delete().in("camp_id", batch);
      await supabase.from("club_invoices").delete().in("camp_id", batch);
      await supabase.from("payroll_records").delete().in("camp_id", batch);
      await supabase.from("bookings").delete().in("camp_id", batch);
      await supabase.from("equipment_assignments").delete().in("camp_id", batch);

      // Delete fixture data
      const { data: fixtureSets } = await supabase
        .from("fixture_sets")
        .select("id")
        .in("camp_id", batch);
      if (fixtureSets && fixtureSets.length > 0) {
        const fsIds = fixtureSets.map((f: any) => f.id);
        await supabase.from("fixture_matches").delete().in("fixture_set_id", fsIds);
        await supabase.from("fixture_teams").delete().in("fixture_set_id", fsIds);
        await supabase.from("fixture_sets").delete().in("camp_id", batch);
      }

      // Delete the camps
      await supabase.from("camps").delete().in("id", batch);
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted_camps: campIds.length,
        unlinked_bookings: deletedBookings,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
