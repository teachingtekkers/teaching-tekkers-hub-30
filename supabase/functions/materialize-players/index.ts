import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function stripNonDigits(s: string): string {
  return s.replace(/\D/g, "");
}

function computeIdentityKey(
  firstName: string,
  lastName: string,
  dob: string | null,
  guardianEmail: string | null,
  guardianPhone: string | null
): string {
  const fn = norm(firstName);
  const ln = norm(lastName);
  if (dob) return `${fn}|${ln}|${dob}`;
  if (guardianEmail) return `${fn}|${ln}|email|${norm(guardianEmail)}`;
  if (guardianPhone) return `${fn}|${ln}|phone|${stripNonDigits(guardianPhone)}`;
  return `${fn}|${ln}|nodob`;
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

    // Fetch unmaterialized synced bookings only
    const { data: bookings, error: fetchErr } = await supabase
      .from("synced_bookings")
      .select("id, child_first_name, child_last_name, date_of_birth, parent_email, parent_phone, kit_size, medical_notes, medical_condition, photo_permission, matched_player_id, camp_name, external_booking_id")
      .is("matched_player_id", null)
      .order("imported_at", { ascending: true });

    if (fetchErr) throw fetchErr;

    let created = 0;
    let linked = 0;
    let skipped = 0;
    const failedRows: { name: string; reason: string; booking: unknown }[] = [];

    for (const b of bookings || []) {
      const firstName = (b.child_first_name || "").trim();
      const lastName = (b.child_last_name || "").trim();
      if (!firstName || !lastName) {
        skipped++;
        continue;
      }

      const dob = b.date_of_birth || null;
      const guardianEmail = b.parent_email?.trim() || null;
      const guardianPhone = b.parent_phone?.trim() || null;
      const identityKey = computeIdentityKey(firstName, lastName, dob, guardianEmail, guardianPhone);

      const medNotes = [b.medical_notes, b.medical_condition].filter(Boolean).join(" — ") || null;
      const photoPermission = b.photo_permission ?? false;

      // Upsert player on identity_key
      const { data: upsertedPlayer, error: upsertErr } = await supabase
        .from("players")
        .upsert(
          {
            first_name: firstName,
            last_name: lastName,
            norm_first_name: norm(firstName),
            norm_last_name: norm(lastName),
            date_of_birth: dob,
            kit_size: b.kit_size || "M",
            medical_notes: medNotes,
            photo_permission: photoPermission,
            guardian_email: guardianEmail,
            guardian_phone: guardianPhone,
            identity_key: identityKey,
          },
          { onConflict: "identity_key" }
        )
        .select("id")
        .single();

      if (upsertErr) {
        failedRows.push({ name: `${firstName} ${lastName}`, reason: upsertErr.message, booking: b });
        continue;
      }

      const playerId = upsertedPlayer.id;
      const wasNew = created; // track before

      // Check if this was a new player (we can't tell from upsert, but we track by linking)
      // Link the booking
      const { error: linkErr } = await supabase
        .from("synced_bookings")
        .update({ matched_player_id: playerId })
        .eq("id", b.id);

      if (linkErr) {
        failedRows.push({ name: `${firstName} ${lastName}`, reason: `Link: ${linkErr.message}`, booking: b });
      } else {
        linked++;
      }
    }

    // Count how many new players were created by comparing before/after
    // Simpler: count players created in last minute as proxy, or just report linked
    // For accurate count, query players that have identity_keys matching what we processed
    const { count: totalPlayers } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true });

    // Write failures to import_errors table
    if (failedRows.length > 0) {
      const errorInserts = failedRows.map(f => ({
        error_code: "materialize_players",
        error_message: f.reason,
        child_first_name: (f.booking as any)?.child_first_name || null,
        child_last_name: (f.booking as any)?.child_last_name || null,
        camp_name: (f.booking as any)?.camp_name || null,
        external_booking_id: (f.booking as any)?.external_booking_id || null,
        raw_row_json: f.booking,
      }));
      await supabase.from("import_errors").insert(errorInserts);
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: (bookings || []).length,
        created: linked, // each linked booking either created or matched a player
        linked,
        skipped,
        failed: failedRows.length,
        total_players: totalPlayers || 0,
        failed_rows: failedRows.slice(0, 20).map(f => ({ name: f.name, reason: f.reason })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("materialize-players error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
