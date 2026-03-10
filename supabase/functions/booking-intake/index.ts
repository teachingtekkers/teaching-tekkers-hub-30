import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface IncomingBooking {
  external_booking_id?: string;
  camp_name: string;
  camp_date?: string;
  venue?: string;
  county?: string;
  child_first_name: string;
  child_last_name: string;
  date_of_birth?: string;
  age?: number;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  emergency_contact?: string;
  medical_notes?: string;
  kit_size?: string;
  payment_status?: string;
  booking_status?: string;
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

    const body = await req.json();
    const bookings: IncomingBooking[] = Array.isArray(body.bookings)
      ? body.bookings
      : [body];

    // Create sync log
    const { data: syncLog, error: logErr } = await supabase
      .from("sync_logs")
      .insert({ status: "running", records_processed: bookings.length })
      .select()
      .single();

    if (logErr) throw logErr;

    let created = 0, updated = 0, failed = 0;
    const errors: string[] = [];

    for (const b of bookings) {
      try {
        // Try to match camp
        let matched_camp_id: string | null = null;
        if (b.camp_name) {
          const { data: camps } = await supabase
            .from("camps")
            .select("id")
            .ilike("name", `%${b.camp_name}%`)
            .limit(1);
          if (camps?.length) matched_camp_id = camps[0].id;
        }

        // Check for existing by external_booking_id
        let existing = null;
        if (b.external_booking_id) {
          const { data } = await supabase
            .from("synced_bookings")
            .select("id")
            .eq("external_booking_id", b.external_booking_id)
            .eq("source_system", "bookings.teachingtekkers.com")
            .maybeSingle();
          existing = data;
        }

        // Check duplicate by child name + camp
        let duplicate_warning = false;
        if (!existing) {
          const { data: dupes } = await supabase
            .from("synced_bookings")
            .select("id")
            .eq("child_first_name", b.child_first_name)
            .eq("child_last_name", b.child_last_name)
            .eq("camp_name", b.camp_name)
            .limit(1);
          if (dupes?.length) duplicate_warning = true;
        }

        const record = {
          external_booking_id: b.external_booking_id || null,
          camp_name: b.camp_name,
          camp_date: b.camp_date || null,
          venue: b.venue || null,
          county: b.county || null,
          child_first_name: b.child_first_name,
          child_last_name: b.child_last_name,
          date_of_birth: b.date_of_birth || null,
          age: b.age || null,
          parent_name: b.parent_name || null,
          parent_phone: b.parent_phone || null,
          parent_email: b.parent_email || null,
          emergency_contact: b.emergency_contact || null,
          medical_notes: b.medical_notes || null,
          kit_size: b.kit_size || "M",
          payment_status: b.payment_status || "pending",
          booking_status: b.booking_status || "confirmed",
          source_system: "bookings.teachingtekkers.com",
          last_synced_at: new Date().toISOString(),
          sync_log_id: syncLog.id,
          matched_camp_id,
          match_status: matched_camp_id ? "matched" : "unmatched",
          duplicate_warning,
        };

        if (existing) {
          await supabase
            .from("synced_bookings")
            .update(record)
            .eq("id", existing.id);
          updated++;
        } else {
          await supabase.from("synced_bookings").insert(record);
          created++;
        }
      } catch (e) {
        failed++;
        errors.push(`${b.child_first_name} ${b.child_last_name}: ${e.message}`);
      }
    }

    // Update sync log
    await supabase
      .from("sync_logs")
      .update({
        status: failed > 0 ? "completed_with_errors" : "completed",
        sync_completed_at: new Date().toISOString(),
        records_created: created,
        records_updated: updated,
        records_failed: failed,
        error_notes: errors.length ? errors.join("; ") : null,
      })
      .eq("id", syncLog.id);

    return new Response(
      JSON.stringify({
        success: true,
        sync_log_id: syncLog.id,
        summary: { processed: bookings.length, created, updated, failed },
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
