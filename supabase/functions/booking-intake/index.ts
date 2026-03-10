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

// Normalize text for fuzzy matching: lowercase, strip punctuation, collapse whitespace
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract meaningful tokens from a camp name
function tokenize(s: string): Set<string> {
  const stopWords = new Set(["camp", "the", "a", "an", "and", "of", "in", "at", "for"]);
  return new Set(
    normalize(s)
      .split(" ")
      .filter((w) => w.length > 1 && !stopWords.has(w))
  );
}

// Calculate token overlap ratio (Jaccard-like)
function tokenSimilarity(a: string, b: string): number {
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  if (tokA.size === 0 && tokB.size === 0) return 1;
  if (tokA.size === 0 || tokB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokA) if (tokB.has(t)) intersection++;
  const union = new Set([...tokA, ...tokB]).size;
  return intersection / union;
}

// Check if camp_date falls within camp date range
function dateOverlaps(campDate: string | undefined, startDate: string, endDate: string): boolean {
  if (!campDate) return false;
  return campDate >= startDate && campDate <= endDate;
}

interface CampRow {
  id: string;
  name: string;
  venue: string;
  county: string;
  start_date: string;
  end_date: string;
  club_name: string;
}

function findBestCamp(
  booking: IncomingBooking,
  camps: CampRow[]
): CampRow | null {
  if (!camps.length) return null;

  // Fast path: exact normalized name match
  const bookingNameNorm = normalize(booking.camp_name);
  for (const camp of camps) {
    if (normalize(camp.name) === bookingNameNorm) return camp;
  }

  type Scored = { camp: CampRow; score: number };
  const scored: Scored[] = camps.map((camp) => {
    let score = 0;

    // Name similarity (0-1), weighted heavily
    const nameSim = tokenSimilarity(booking.camp_name, camp.name);
    score += nameSim * 60;

    // Date match
    if (booking.camp_date && dateOverlaps(booking.camp_date, camp.start_date, camp.end_date)) {
      score += 25;
    }

    // Venue similarity
    if (booking.venue && camp.venue) {
      const venueSim = tokenSimilarity(booking.venue, camp.venue);
      score += venueSim * 10;
    }

    // County exact match
    if (booking.county && camp.county && normalize(booking.county) === normalize(camp.county)) {
      score += 5;
    }

    return { camp, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // Minimum threshold: at least 25 score (lowered to catch more partial matches)
  if (best.score >= 25) return best.camp;
  return null;
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

    // Load all camps once for matching
    const { data: allCamps } = await supabase
      .from("camps")
      .select("id, name, venue, county, start_date, end_date, club_name");
    const campsList: CampRow[] = allCamps || [];

    let created = 0,
      updated = 0,
      failed = 0,
      campsCreated = 0;
    const errors: string[] = [];

    for (const b of bookings) {
      try {
        // --- Fuzzy camp matching ---
        let matched_camp_id: string | null = null;
        const bestCamp = findBestCamp(b, campsList);

        if (bestCamp) {
          matched_camp_id = bestCamp.id;
        } else if (b.camp_name) {
          // Auto-create camp from booking data
          const campDate = b.camp_date || new Date().toISOString().split("T")[0];
          const newCamp = {
            name: b.camp_name,
            club_name: b.camp_name.split(/[-–]/)[0].trim() || b.camp_name,
            venue: b.venue || "TBC",
            county: b.county || "TBC",
            start_date: campDate,
            end_date: campDate,
            age_group: "U8-U12",
          };
          const { data: createdCamp, error: campErr } = await supabase
            .from("camps")
            .insert(newCamp)
            .select("id, name, venue, county, start_date, end_date, club_name")
            .single();
          if (campErr) {
            errors.push(`Auto-create camp "${b.camp_name}": ${campErr.message}`);
          } else if (createdCamp) {
            matched_camp_id = createdCamp.id;
            campsList.push(createdCamp as CampRow);
            campsCreated++;
          }
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
        summary: {
          processed: bookings.length,
          created,
          updated,
          failed,
          camps_created: campsCreated,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
