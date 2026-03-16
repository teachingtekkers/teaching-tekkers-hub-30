import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PurgeOptions {
  camp_ids: string[];
  delete_synced_bookings?: boolean;
  delete_attendance?: boolean;
  delete_rosters?: boolean;
  delete_camp_records?: boolean;
  archive_instead?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: PurgeOptions = await req.json();
    const {
      camp_ids,
      delete_synced_bookings = true,
      delete_attendance = true,
      delete_rosters = false,
      delete_camp_records = false,
      archive_instead = false,
    } = body;

    if (!camp_ids || !Array.isArray(camp_ids) || camp_ids.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "camp_ids required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const summary: Record<string, number> = {};
    const errors: string[] = [];

    // Process in batches to handle large camp sets
    const BATCH = 50;
    for (let i = 0; i < camp_ids.length; i += BATCH) {
      const batch = camp_ids.slice(i, i + BATCH);

      // 1. Delete synced_bookings matched to these camps
      if (delete_synced_bookings) {
        const { data: sbRows } = await supabase
          .from("synced_bookings")
          .select("id")
          .in("matched_camp_id", batch);
        const count = sbRows?.length || 0;

        if (count > 0) {
          const { error: sbErr } = await supabase
            .from("synced_bookings")
            .delete()
            .in("matched_camp_id", batch);
          if (sbErr) errors.push(`synced_bookings: ${sbErr.message}`);
          else summary.synced_bookings = (summary.synced_bookings || 0) + count;
        }
      }

      // 2. Delete attendance records for these camps
      if (delete_attendance) {
        const { data: attRows } = await supabase
          .from("attendance")
          .select("id")
          .in("camp_id", batch);
        const count = attRows?.length || 0;

        if (count > 0) {
          const { error: attErr } = await supabase
            .from("attendance")
            .delete()
            .in("camp_id", batch);
          if (attErr) errors.push(`attendance: ${attErr.message}`);
          else summary.attendance = (summary.attendance || 0) + count;
        }
      }

      // 3. Delete roster assignments for these camps (camp_coach_assignments)
      if (delete_rosters) {
        const { data: rosterRows } = await supabase
          .from("camp_coach_assignments")
          .select("id")
          .in("camp_id", batch);
        const count = rosterRows?.length || 0;

        if (count > 0) {
          const { error: rErr } = await supabase
            .from("camp_coach_assignments")
            .delete()
            .in("camp_id", batch);
          if (rErr) errors.push(`camp_coach_assignments: ${rErr.message}`);
          else summary.roster_assignments = (summary.roster_assignments || 0) + count;
        }
      }

      // 4. Delete or archive camp records
      if (delete_camp_records) {
        if (archive_instead) {
          const { error: archErr } = await supabase
            .from("camps")
            .update({ status: "archived" } as any)
            .in("id", batch);
          if (archErr) errors.push(`archive camps: ${archErr.message}`);
          else summary.camps_archived = (summary.camps_archived || 0) + batch.length;
        } else {
          // Delete related records first (financial overrides, session plan assignments, etc.)
          await supabase.from("camp_financial_overrides").delete().in("camp_id", batch);
          await supabase.from("session_plan_assignments").delete().in("camp_id", batch);
          await supabase.from("camp_messages").delete().in("camp_id", batch);
          await supabase.from("club_invoices").delete().in("camp_id", batch);
          await supabase.from("payroll_records").delete().in("camp_id", batch);
          await supabase.from("bookings").delete().in("camp_id", batch);

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

          // Delete equipment assignments
          await supabase.from("equipment_assignments").delete().in("camp_id", batch);

          // Finally delete camps
          const { error: cErr } = await supabase
            .from("camps")
            .delete()
            .in("id", batch);
          if (cErr) errors.push(`camps: ${cErr.message}`);
          else summary.camps_deleted = (summary.camps_deleted || 0) + batch.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        summary,
        errors: errors.length > 0 ? errors : undefined,
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
