import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Normalization helpers ──

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function stripNoise(s: string): string {
  return normalize(s)
    .replace(/\b\d{4}\b/g, "")
    .replace(/€\s*\d+/g, "")
    .replace(/\b(camp|the|a|an|and|of|in|at|for)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): Set<string> {
  return new Set(
    stripNoise(s).split(" ").filter((w) => w.length > 1)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function dateOverlaps(campDate: string | null, startDate: string, endDate: string): boolean {
  if (!campDate) return false;
  return campDate >= startDate && campDate <= endDate;
}

interface CampRow {
  id: string;
  name: string;
  venue: string;
  county: string;
  club_name: string;
  start_date: string;
  end_date: string;
}

interface BookingRow {
  id: string;
  camp_name: string;
  camp_date: string | null;
  venue: string | null;
  county: string | null;
  matched_camp_id: string | null;
  match_status: string;
}

interface MatchResult {
  camp: CampRow;
  score: number;
  reason: string;
}

function findBestCamp(booking: BookingRow, camps: CampRow[]): MatchResult | null {
  if (!camps.length) return null;

  const bNameNorm = normalize(booking.camp_name);
  const bNameStripped = stripNoise(booking.camp_name);
  const bTokens = tokenize(booking.camp_name);

  // Exact match
  for (const camp of camps) {
    if (normalize(camp.name) === bNameNorm) {
      return { camp, score: 100, reason: "Exact name match" };
    }
  }
  for (const camp of camps) {
    if (stripNoise(camp.name) === bNameStripped) {
      return { camp, score: 90, reason: "Exact match after normalization" };
    }
  }
  for (const camp of camps) {
    const cNorm = normalize(camp.name);
    if (cNorm.includes(bNameNorm) || bNameNorm.includes(cNorm)) {
      return { camp, score: 80, reason: "Substring name match" };
    }
  }

  type Scored = { camp: CampRow; score: number; reasons: string[] };
  const scored: Scored[] = [];

  for (const camp of camps) {
    let score = 0;
    const reasons: string[] = [];

    const cTokens = tokenize(camp.name);
    const nameSim = jaccardSimilarity(bTokens, cTokens);
    score += nameSim * 55;
    if (nameSim > 0) reasons.push(`name_sim=${(nameSim * 100).toFixed(0)}%`);

    const clubTokens = tokenize(camp.club_name);
    const clubSim = jaccardSimilarity(bTokens, clubTokens);
    if (clubSim > 0.4) {
      score += clubSim * 20;
      reasons.push(`club_sim=${(clubSim * 100).toFixed(0)}%`);
    }

    if (booking.camp_date && dateOverlaps(booking.camp_date, camp.start_date, camp.end_date)) {
      score += 20;
      reasons.push("date_overlap");
    }

    if (booking.venue && camp.venue) {
      const bv = normalize(booking.venue);
      const cv = normalize(camp.venue);
      if (bv === cv) { score += 10; reasons.push("venue_exact"); }
      else if (bv.includes(cv) || cv.includes(bv)) { score += 7; reasons.push("venue_partial"); }
    }

    if (booking.county && camp.county && normalize(booking.county) === normalize(camp.county)) {
      score += 5;
      reasons.push("county_match");
    }

    scored.push({ camp, score, reasons });
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best.score >= 20) {
    return {
      camp: best.camp,
      score: Math.round(best.score),
      reason: best.reasons.join(", "),
    };
  }
  return null;
}

/** 3-tier match status from score */
function matchTier(score: number): string {
  if (score >= 60) return "matched";
  if (score >= 45) return "needs_review";
  return "unmatched";
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

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "all";

    const { data: allCamps } = await supabase
      .from("camps")
      .select("id, name, venue, county, club_name, start_date, end_date");
    const camps: CampRow[] = allCamps || [];

    if (camps.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No camps found in database" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase
      .from("synced_bookings")
      .select("id, camp_name, camp_date, venue, county, matched_camp_id, match_status");

    if (mode === "unmatched_only") {
      query = query.or("match_status.eq.unmatched,match_status.eq.needs_review,matched_camp_id.is.null");
    }

    const { data: bookingsData } = await query;
    const bookingsToProcess: BookingRow[] = bookingsData || [];

    let repaired = 0;
    let alreadyCorrect = 0;
    let stillUnmatched = 0;
    let markedForReview = 0;
    let failed = 0;
    const unmatchedCamps: string[] = [];
    const errors: string[] = [];

    const BATCH = 50;
    for (let i = 0; i < bookingsToProcess.length; i += BATCH) {
      const batch = bookingsToProcess.slice(i, i + BATCH);

      for (const booking of batch) {
        try {
          const result = findBestCamp(booking, camps);

          if (!result) {
            stillUnmatched++;
            if (!unmatchedCamps.includes(booking.camp_name)) {
              unmatchedCamps.push(booking.camp_name);
            }
            if (booking.match_status !== "unmatched" || booking.matched_camp_id !== null) {
              await supabase
                .from("synced_bookings")
                .update({ matched_camp_id: null, match_status: "unmatched", match_score: null, match_reason: null })
                .eq("id", booking.id);
            }
            continue;
          }

          const tier = matchTier(result.score);

          if (tier === "matched" && booking.matched_camp_id === result.camp.id && booking.match_status === "matched") {
            alreadyCorrect++;
            // Still update score/reason
            await supabase
              .from("synced_bookings")
              .update({ match_score: result.score, match_reason: result.reason })
              .eq("id", booking.id);
            continue;
          }

          const updateData: Record<string, unknown> = {
            match_status: tier,
            match_score: result.score,
            match_reason: tier === "needs_review"
              ? `suggested_camp=${result.camp.id}; ${result.reason}`
              : result.reason,
          };

          if (tier === "matched") {
            updateData.matched_camp_id = result.camp.id;
            repaired++;
          } else {
            // needs_review: don't auto-link
            updateData.matched_camp_id = null;
            markedForReview++;
          }

          const { error: updateErr } = await supabase
            .from("synced_bookings")
            .update(updateData)
            .eq("id", booking.id);

          if (updateErr) {
            failed++;
            errors.push(`${booking.id}: ${updateErr.message}`);
          }
        } catch (e) {
          failed++;
          errors.push(`${booking.id}: ${e.message}`);
        }
      }
    }

    // Detect duplicates
    const { data: allBookings } = await supabase
      .from("synced_bookings")
      .select("id, child_first_name, child_last_name, matched_camp_id, duplicate_warning");

    const dupeMap = new Map<string, string[]>();
    let duplicatesFound = 0;
    for (const b of (allBookings || [])) {
      if (!b.matched_camp_id) continue;
      const key = `${normalize(b.child_first_name)}_${normalize(b.child_last_name)}_${b.matched_camp_id}`;
      const arr = dupeMap.get(key) || [];
      arr.push(b.id);
      dupeMap.set(key, arr);
    }
    for (const [, ids] of dupeMap) {
      if (ids.length > 1) {
        duplicatesFound += ids.length;
        for (const id of ids) {
          await supabase
            .from("synced_bookings")
            .update({ duplicate_warning: true })
            .eq("id", id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total_processed: bookingsToProcess.length,
          repaired,
          already_correct: alreadyCorrect,
          still_unmatched: stillUnmatched,
          needs_review: markedForReview,
          failed,
          duplicates_found: duplicatesFound,
          unmatched_camp_names: unmatchedCamps,
          camps_available: camps.length,
        },
        errors: errors.length ? errors : null,
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
