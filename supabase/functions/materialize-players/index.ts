import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
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

    // Fetch all synced bookings
    const { data: bookings, error: fetchErr } = await supabase
      .from("synced_bookings")
      .select("id, child_first_name, child_last_name, date_of_birth, parent_email, parent_phone, kit_size, medical_notes, medical_condition, photo_permission, matched_player_id")
      .order("imported_at", { ascending: true });

    if (fetchErr) throw fetchErr;

    // Load all existing players
    const { data: existingPlayers, error: playersErr } = await supabase
      .from("players")
      .select("id, first_name, last_name, date_of_birth");

    if (playersErr) throw playersErr;

    // Build lookup maps with multiple strategies
    // Key strategy 1: first+last+dob
    const mapByDob = new Map<string, string>();
    // Key strategy 2: first+last+email (no map since we don't store email on players, but we track via booking)
    const mapByName = new Map<string, string>(); // first+last only (weakest)

    for (const p of existingPlayers || []) {
      const fn = norm(p.first_name);
      const ln = norm(p.last_name);
      if (p.date_of_birth) {
        mapByDob.set(`${fn}|${ln}|${p.date_of_birth}`, p.id);
      }
      // Store first match by name (used as fallback)
      const nameKey = `${fn}|${ln}`;
      if (!mapByName.has(nameKey)) {
        mapByName.set(nameKey, p.id);
      }
    }

    // Also build email->player map from previously linked bookings
    const mapByEmail = new Map<string, string>();
    const mapByPhone = new Map<string, string>();
    for (const b of bookings || []) {
      if (b.matched_player_id) {
        const fn = norm(b.child_first_name || "");
        const ln = norm(b.child_last_name || "");
        if (b.parent_email) {
          const key = `${fn}|${ln}|${norm(b.parent_email)}`;
          if (!mapByEmail.has(key)) mapByEmail.set(key, b.matched_player_id);
        }
        if (b.parent_phone) {
          const key = `${fn}|${ln}|${norm(b.parent_phone)}`;
          if (!mapByPhone.has(key)) mapByPhone.set(key, b.matched_player_id);
        }
      }
    }

    let created = 0;
    let linked = 0;
    let skipped = 0;
    const failedRows: { name: string; reason: string }[] = [];

    for (const b of bookings || []) {
      const firstName = (b.child_first_name || "").trim();
      const lastName = (b.child_last_name || "").trim();
      if (!firstName || !lastName) {
        skipped++;
        continue;
      }

      const fn = norm(firstName);
      const ln = norm(lastName);
      const dob = b.date_of_birth || null;

      // Try matching in priority order
      let playerId: string | undefined;

      // 1. Match by name + DOB
      if (dob) {
        playerId = mapByDob.get(`${fn}|${ln}|${dob}`);
      }

      // 2. Match by name + parent_email
      if (!playerId && b.parent_email) {
        playerId = mapByEmail.get(`${fn}|${ln}|${norm(b.parent_email)}`);
      }

      // 3. Match by name + parent_phone
      if (!playerId && b.parent_phone) {
        playerId = mapByPhone.get(`${fn}|${ln}|${norm(b.parent_phone)}`);
      }

      if (!playerId) {
        // Create new player
        const medNotes = [b.medical_notes, b.medical_condition].filter(Boolean).join(" — ") || null;
        const photoPermission = b.photo_permission ?? false;

        const { data: newPlayer, error: insertErr } = await supabase
          .from("players")
          .insert({
            first_name: firstName,
            last_name: lastName,
            date_of_birth: dob, // nullable now
            kit_size: b.kit_size || "M",
            medical_notes: medNotes,
            photo_permission: photoPermission,
          })
          .select("id")
          .single();

        if (insertErr) {
          failedRows.push({ name: `${firstName} ${lastName}`, reason: insertErr.message });
          continue;
        }

        playerId = newPlayer.id;
        // Add to maps for subsequent bookings
        if (dob) mapByDob.set(`${fn}|${ln}|${dob}`, playerId);
        mapByName.set(`${fn}|${ln}`, playerId);
        if (b.parent_email) mapByEmail.set(`${fn}|${ln}|${norm(b.parent_email)}`, playerId);
        if (b.parent_phone) mapByPhone.set(`${fn}|${ln}|${norm(b.parent_phone)}`, playerId);
        created++;
      }

      // Link booking to player if not already linked
      if (b.matched_player_id !== playerId) {
        const { error: updateErr } = await supabase
          .from("synced_bookings")
          .update({ matched_player_id: playerId })
          .eq("id", b.id);

        if (updateErr) {
          failedRows.push({ name: `${firstName} ${lastName}`, reason: `Link: ${updateErr.message}` });
        } else {
          linked++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        created,
        linked,
        skipped,
        failed: failedRows.length,
        failed_rows: failedRows.slice(0, 20),
        total: (bookings || []).length,
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
