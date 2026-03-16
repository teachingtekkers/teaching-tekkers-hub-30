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

    // Find duplicate identity_key groups
    const { data: allPlayers, error: fetchErr } = await supabase
      .from("players")
      .select("id, identity_key, created_at")
      .not("identity_key", "is", null)
      .order("created_at", { ascending: true });

    if (fetchErr) throw fetchErr;

    // Group by identity_key
    const groups = new Map<string, { id: string; created_at: string }[]>();
    for (const p of allPlayers || []) {
      if (!p.identity_key) continue;
      const arr = groups.get(p.identity_key) || [];
      arr.push({ id: p.id, created_at: p.created_at });
      groups.set(p.identity_key, arr);
    }

    let groupsMerged = 0;
    let playersDeleted = 0;
    let bookingsRelinked = 0;

    for (const [key, players] of groups) {
      if (players.length <= 1) continue;

      // Canonical = earliest
      const canonical = players[0];
      const duplicates = players.slice(1);

      for (const dup of duplicates) {
        // Relink synced_bookings
        const { data: relinked } = await supabase
          .from("synced_bookings")
          .update({ matched_player_id: canonical.id })
          .eq("matched_player_id", dup.id)
          .select("id");

        bookingsRelinked += (relinked || []).length;

        // Relink attendance
        await supabase
          .from("attendance")
          .update({ player_id: canonical.id })
          .eq("player_id", dup.id);

        // Delete duplicate player
        const { error: delErr } = await supabase
          .from("players")
          .delete()
          .eq("id", dup.id);

        if (!delErr) playersDeleted++;
      }

      groupsMerged++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        groups_merged: groupsMerged,
        players_deleted: playersDeleted,
        bookings_relinked: bookingsRelinked,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("merge-duplicate-players error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
