import { createClient } from "npm:@supabase/supabase-js@2";
import { DEFAULT_SOURCE, EngineError, syncCamp } from "../_shared/booking-engine.ts";

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
  alternate_phone?: string;
  medical_condition?: string;
  medical_notes?: string;
  kit_size?: string;
  payment_status?: string;
  booking_status?: string;
  booking_date?: string;
  total_amount?: string | number;
  amount_paid?: string | number;
  sibling_discount?: string | number;
  refund_amount?: string | number;
  payment_type?: string;
  amount_owed?: string | number;
  photo_permission?: string | boolean;
}

// ── Parsing helpers ──

function parseMoney(val: unknown): number {
  if (val == null || val === "") return 0;
  if (typeof val === "number") return val;
  const s = String(val).replace(/[€£$,\s]/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseAge(val: unknown): number | null {
  if (val == null || val === "") return null;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  const yearsMatch = s.match(/(\d+)\s*year/i);
  if (yearsMatch) return parseInt(yearsMatch[1], 10);
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/**
 * Safe date parser — NO `new Date(string)`.
 * Supports YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY.
 * Returns YYYY-MM-DD string or null.
 */
function safeParseDate(val: unknown): string | null {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  if (s === "") return null;

  // YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const m = parseInt(iso[2], 10);
    const d = parseInt(iso[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return `${iso[1]}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return null;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const d = parseInt(dmy[1], 10);
    const m = parseInt(dmy[2], 10);
    const y = parseInt(dmy[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return `${dmy[3]}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return null;
  }

  return null;
}

function parsePhotoPermission(val: unknown): boolean | null {
  if (val == null || val === "") return null;
  if (typeof val === "boolean") return val;
  const s = String(val).toLowerCase().trim();
  if (s === "") return null;
  if (s === "yes" || s === "true" || s === "1" || s === "y") return true;
  if (s === "no" || s === "false" || s === "0" || s === "n") return false;
  return null;
}

function normalizePaymentStatus(val: unknown): string {
  if (val == null || val === "") return "pending";
  const s = String(val).toLowerCase().trim();
  if (!s) return "pending";
  if (s.includes("paid") || s.includes("complete") || s.includes("success") || s.includes("succeeded")) return "paid";
  if (s.includes("refund")) return "refunded";
  if (s.includes("partial")) return "partial";
  if (s.includes("pending") || s.includes("unpaid") || s.includes("awaiting")) return "pending";
  return "pending";
}

// ── Matching helpers ──

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeForMatching(s: string): string {
  return normalize(s)
    .replace(/\b\d{4}\b/g, "")
    .replace(/€\s*\d+/g, "")
    .replace(/\b(camp|the|a|an|and|of|in|at|for)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): Set<string> {
  return new Set(
    normalizeForMatching(s).split(" ").filter((w) => w.length > 1)
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

interface MatchResult {
  camp: CampRow;
  score: number;
  reason: string;
}

function findBestCamp(booking: IncomingBooking, camps: CampRow[]): MatchResult | null {
  if (!camps.length) return null;

  const bookingNameNorm = normalize(booking.camp_name);
  const bookingNameMatch = normalizeForMatching(booking.camp_name);

  for (const camp of camps) {
    if (normalize(camp.name) === bookingNameNorm) {
      return { camp, score: 100, reason: "Exact name match" };
    }
  }
  for (const camp of camps) {
    if (normalizeForMatching(camp.name) === bookingNameMatch) {
      return { camp, score: 90, reason: "Exact match after normalization" };
    }
  }
  for (const camp of camps) {
    const campNorm = normalize(camp.name);
    if (campNorm.includes(bookingNameNorm) || bookingNameNorm.includes(campNorm)) {
      return { camp, score: 80, reason: "Substring name match" };
    }
  }

  type Scored = { camp: CampRow; score: number; reasons: string[] };
  const scored: Scored[] = camps.map((camp) => {
    let score = 0;
    const reasons: string[] = [];

    const nameSim = tokenSimilarity(booking.camp_name, camp.name);
    score += nameSim * 55;
    if (nameSim > 0) reasons.push(`name_sim=${(nameSim * 100).toFixed(0)}%`);

    const clubSim = tokenSimilarity(booking.camp_name, camp.club_name);
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
      else {
        const vs = tokenSimilarity(booking.venue, camp.venue) * 5;
        if (vs > 0) { score += vs; reasons.push("venue_token"); }
      }
    }

    if (booking.county && camp.county && normalize(booking.county) === normalize(camp.county)) {
      score += 5;
      reasons.push("county_match");
    }

    return { camp, score, reasons };
  });

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

function matchTier(score: number): string {
  if (score >= 60) return "matched";
  if (score >= 45) return "needs_review";
  return "unmatched";
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/**
 * Legacy intake endpoint, now behind the same safeguards as the CSV importer.
 * - Pushes from the booking system: { source_camp_id, bookings[] } with header x-sync-token (BOOKING_SYNC_TOKEN)
 *   or an admin session -> shared engine (mapped camps only, safe rows applied, the rest queued for review).
 * - Admin "Re-match": { rematch_ids[] } -> only recalculates the camp link of unmatched rows; never touches
 *   child, payment, kit or note fields.
 * Anonymous requests and un-mapped full-record upserts are refused.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const syncToken = Deno.env.get("BOOKING_SYNC_TOKEN") || "";
    const presented = req.headers.get("x-sync-token") || "";
    let isAdmin = false;
    const viaToken = !!syncToken && !!presented && timingSafeEqual(presented, syncToken);
    if (!viaToken) {
      const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = await db.auth.getUser(jwt);
      if (u?.user?.id) {
        const { data: role } = await db.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
        isAdmin = !!role;
      }
      if (!isAdmin) return json({ error: "Not authorised" }, 401);
    }

    const body = await req.json();

    if (body.source_camp_id && Array.isArray(body.bookings)) {
      const out = await syncCamp(db, {
        sourceSystem: String(body.source_system || DEFAULT_SOURCE), sourceCampId: String(body.source_camp_id).trim(),
        rows: body.bookings, extractedAt: body.extracted_at || null,
      });
      return json({ success: true, ...out });
    }

    if (isAdmin && Array.isArray(body.rematch_ids)) {
      const ids: string[] = body.rematch_ids.slice(0, 2000);
      const { data: camps } = await db.from("camps").select("id, name, venue, county, start_date, end_date, club_name").neq("status", "archived");
      let matched = 0, review = 0;
      for (let i = 0; i < ids.length; i += 200) {
        const { data: rows } = await db.from("synced_bookings").select("id,camp_name,camp_date,venue,county,child_first_name,child_last_name,match_status")
          .in("id", ids.slice(i, i + 200)).neq("match_status", "matched");
        for (const b of rows || []) {
          const m = findBestCamp(b as IncomingBooking, camps || []);
          if (!m) continue;
          const tier = matchTier(m.score);
          const patch = tier === "matched"
            ? { matched_camp_id: m.camp.id, match_status: "matched", match_score: m.score, match_reason: m.reason }
            : tier === "needs_review" ? { match_status: "needs_review", match_score: m.score, match_reason: `suggested_camp=${m.camp.id}; ${m.reason}` } : null;
          if (!patch) continue;
          await db.from("synced_bookings").update(patch).eq("id", b.id);
          if (tier === "matched") matched++; else review++;
        }
      }
      return json({ success: true, summary: { processed: ids.length, created: 0, updated: matched, needs_review: review, camps_created: 0 } });
    }

    return json({ error: "This endpoint now needs a source_camp_id for an already-linked camp. Use Booking Sync → Import for new camps." }, 410);
  } catch (err) {
    if (err instanceof EngineError) return json({ error: err.message }, err.status);
    console.error("booking-intake error", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
