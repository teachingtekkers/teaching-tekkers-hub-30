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

function parseAge(val: unknown): number | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  // Handle "9 Years, 8 Months" format
  const yearsMatch = s.match(/(\d+)\s*year/i);
  if (yearsMatch) return parseInt(yearsMatch[1], 10);
  // Handle plain number string
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function parseDateOfBirth(val: unknown): string | null {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // Try native parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

// Strip common suffixes like WK1, WK2, Week 1, etc. for matching
function normalizeForMatching(s: string): string {
  return normalize(s)
    .replace(/\b(wk\s*\d+|week\s*\d+)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): Set<string> {
  const stopWords = new Set(["camp", "the", "a", "an", "and", "of", "in", "at", "for"]);
  return new Set(
    normalize(s).split(" ").filter((w) => w.length > 1 && !stopWords.has(w))
  );
}

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

function findBestCamp(booking: IncomingBooking, camps: CampRow[]): CampRow | null {
  if (!camps.length) return null;

  const bookingNameNorm = normalize(booking.camp_name);
  const bookingNameMatch = normalizeForMatching(booking.camp_name);

  // Fast path: exact normalized name match
  for (const camp of camps) {
    if (normalize(camp.name) === bookingNameNorm) return camp;
  }

  // Fast path: match after stripping WK1/Week suffixes
  for (const camp of camps) {
    if (normalizeForMatching(camp.name) === bookingNameMatch) return camp;
  }

  // Fast path: one name contains the other
  for (const camp of camps) {
    const campNorm = normalize(camp.name);
    if (campNorm.includes(bookingNameNorm) || bookingNameNorm.includes(campNorm)) return camp;
  }

  type Scored = { camp: CampRow; score: number };
  const scored: Scored[] = camps.map((camp) => {
    let score = 0;
    score += tokenSimilarity(booking.camp_name, camp.name) * 60;
    if (booking.camp_date && dateOverlaps(booking.camp_date, camp.start_date, camp.end_date)) {
      score += 25;
    }
    if (booking.venue && camp.venue) {
      score += tokenSimilarity(booking.venue, camp.venue) * 10;
    }
    if (booking.county && camp.county && normalize(booking.county) === normalize(camp.county)) {
      score += 5;
    }
    return { camp, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
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

    // Load existing external_booking_ids in one query for dedup
    const externalIds = bookings
      .map((b) => b.external_booking_id)
      .filter(Boolean) as string[];
    
    const existingByExtId: Record<string, string> = {};
    if (externalIds.length > 0) {
      const { data: existingRows } = await supabase
        .from("synced_bookings")
        .select("id, external_booking_id")
        .in("external_booking_id", externalIds)
        .eq("source_system", "bookings.teachingtekkers.com");
      (existingRows || []).forEach((r: { id: string; external_booking_id: string }) => {
        existingByExtId[r.external_booking_id] = r.id;
      });
    }

    let created = 0, updated = 0, failed = 0, campsCreated = 0;
    const errors: string[] = [];

    // Process bookings in batches of 10 for efficiency
    const BATCH_SIZE = 10;
    for (let i = 0; i < bookings.length; i += BATCH_SIZE) {
      const batch = bookings.slice(i, i + BATCH_SIZE);
      const inserts: Record<string, unknown>[] = [];
      const updates: { id: string; record: Record<string, unknown> }[] = [];

      for (const b of batch) {
        try {
          // Camp matching
          let matched_camp_id: string | null = null;
          const bestCamp = findBestCamp(b, campsList);

          if (bestCamp) {
            matched_camp_id = bestCamp.id;
          } else if (b.camp_name) {
            // Auto-create camp
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
            duplicate_warning: false,
          };

          // Check if existing by external_booking_id
          const existingId = b.external_booking_id ? existingByExtId[b.external_booking_id] : null;

          if (existingId) {
            updates.push({ id: existingId, record });
            updated++;
          } else {
            inserts.push(record);
            created++;
          }
        } catch (e) {
          failed++;
          errors.push(`${b.child_first_name} ${b.child_last_name}: ${e.message}`);
        }
      }

      // Batch insert new records
      if (inserts.length > 0) {
        const { error: insertErr } = await supabase
          .from("synced_bookings")
          .insert(inserts);
        if (insertErr) {
          failed += inserts.length;
          created -= inserts.length;
          errors.push(`Batch insert error: ${insertErr.message}`);
        }
      }

      // Batch updates (still need individual updates due to different where clauses)
      for (const u of updates) {
        const { error: updateErr } = await supabase
          .from("synced_bookings")
          .update(u.record)
          .eq("id", u.id);
        if (updateErr) {
          failed++;
          updated--;
          errors.push(`Update error: ${updateErr.message}`);
        }
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
