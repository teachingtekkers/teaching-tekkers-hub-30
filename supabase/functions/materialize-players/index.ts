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

    // Fetch all synced bookings that have no matched_player_id
    const { data: bookings, error: fetchErr } = await supabase
      .from("synced_bookings")
      .select("id, child_first_name, child_last_name, date_of_birth, parent_email, kit_size, medical_notes, medical_condition, photo_permission, matched_player_id")
      .order("imported_at", { ascending: true });

    if (fetchErr) throw fetchErr;

    // Also load all existing players for matching
    const { data: existingPlayers, error: playersErr } = await supabase
      .from("players")
      .select("id, first_name, last_name, date_of_birth");

    if (playersErr) throw playersErr;

    // Build a lookup map: key -> player id
    const playerMap = new Map<string, string>();
    for (const p of existingPlayers || []) {
      const keyDob = `${p.first_name.toLowerCase().trim()}|${p.last_name.toLowerCase().trim()}|${p.date_of_birth || ""}`;
      playerMap.set(keyDob, p.id);
    }

    let created = 0;
    let linked = 0;
    let skipped = 0;

    for (const b of bookings || []) {
      const firstName = (b.child_first_name || "").trim();
      const lastName = (b.child_last_name || "").trim();
      if (!firstName || !lastName) {
        skipped++;
        continue;
      }

      const keyDob = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${b.date_of_birth || ""}`;

      let playerId = playerMap.get(keyDob);

      if (!playerId) {
        // Try to create
        const { data: newPlayer, error: insertErr } = await supabase
          .from("players")
          .insert({
            first_name: firstName,
            last_name: lastName,
            date_of_birth: b.date_of_birth || "2000-01-01",
            kit_size: b.kit_size || "M",
            medical_notes: b.medical_notes || b.medical_condition || null,
            photo_permission: b.photo_permission ?? true,
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error("Insert player error:", insertErr.message, firstName, lastName);
          skipped++;
          continue;
        }

        playerId = newPlayer.id;
        playerMap.set(keyDob, playerId);
        created++;
      }

      // Link booking to player if not already linked
      if (b.matched_player_id !== playerId) {
        const { error: updateErr } = await supabase
          .from("synced_bookings")
          .update({ matched_player_id: playerId })
          .eq("id", b.id);

        if (updateErr) {
          console.error("Update booking error:", updateErr.message);
        } else {
          linked++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, created, linked, skipped, total: (bookings || []).length }),
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
