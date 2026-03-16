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

function parseDateOfBirth(val: unknown): string | null {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
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
  if (s === "paid" || s === "complete" || s === "completed" || s === "success") return "paid";
  if (s === "refunded" || s === "refund") return "refunded";
  if (s === "partial" || s === "partially paid") return "partial";
  if (s === "unpaid" || s === "pending" || s === "awaiting") return "pending";
  return s || "pending";
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

    const { data: syncLog, error: logErr } = await supabase
      .from("sync_logs")
      .insert({ status: "running", records_processed: bookings.length })
      .select()
      .single();

    if (logErr) throw logErr;

    const { data: allCamps } = await supabase
      .from("camps")
      .select("id, name, venue, county, start_date, end_date, club_name");
    const campsList: CampRow[] = allCamps || [];

    const externalIds = bookings
      .map((b) => b.external_booking_id)
      .filter(Boolean) as string[];

    const existingByExtId: Record<string, { id: string; manual_override: boolean }> = {};
    if (externalIds.length > 0) {
      const { data: existingRows } = await supabase
        .from("synced_bookings")
        .select("id, external_booking_id, manual_override")
        .in("external_booking_id", externalIds)
        .eq("source_system", "bookings.teachingtekkers.com");
      (existingRows || []).forEach((r: any) => {
        existingByExtId[r.external_booking_id] = { id: r.id, manual_override: r.manual_override };
      });
    }

    let created = 0, updated = 0, failed = 0, needsReview = 0, draftsCreated = 0;
    const errorRows: { external_booking_id: string | null; camp_name: string; child_first_name: string; child_last_name: string; error_code: string; error_message: string; raw_row_json: unknown }[] = [];
    const draftCampCache: Record<string, string> = {};

    const BATCH_SIZE = 10;
    for (let i = 0; i < bookings.length; i += BATCH_SIZE) {
      const batch = bookings.slice(i, i + BATCH_SIZE);
      const inserts: Record<string, unknown>[] = [];
      const updates: { id: string; record: Record<string, unknown> }[] = [];

      for (const b of batch) {
        try {
          const matchResult = findBestCamp(b, campsList);

          let matched_camp_id: string | null = null;
          let match_status = "unmatched";
          let match_score: number | null = null;
          let match_reason: string | null = null;

          if (matchResult) {
            match_score = matchResult.score;
            match_reason = matchResult.reason;
            match_status = matchTier(matchResult.score);

            if (match_status === "matched") {
              matched_camp_id = matchResult.camp.id;
            }
            if (match_status === "needs_review") {
              needsReview++;
              match_reason = `suggested_camp=${matchResult.camp.id}; ${match_reason}`;
            }
          }

          // Auto-create draft camp when unmatched
          if (!matched_camp_id && match_status === "unmatched" && b.camp_name) {
            const normName = normalize(b.camp_name);
            const campDate = b.camp_date || b.booking_date || new Date().toISOString().split("T")[0];

            if (draftCampCache[normName]) {
              matched_camp_id = draftCampCache[normName];
              match_status = "matched";
              match_score = 100;
              match_reason = "Reused draft camp from this import";
            } else {
              const { data: existingDrafts } = await supabase
                .from("camps")
                .select("id, name, start_date, end_date")
                .eq("status", "draft")
                .eq("is_auto_created", true);

              const reusable = (existingDrafts || []).find((dc: any) => {
                if (normalize(dc.name) !== normName) return false;
                const s = new Date(dc.start_date).getTime();
                const e = new Date(dc.end_date).getTime();
                const d = new Date(campDate).getTime();
                return d >= s - 7 * 86400000 && d <= e + 7 * 86400000;
              });

              if (reusable) {
                matched_camp_id = reusable.id;
                draftCampCache[normName] = reusable.id;
                match_status = "matched";
                match_score = 95;
                match_reason = "Reused existing draft camp";
              } else {
                const startDate = campDate;
                const endDateObj = new Date(startDate);
                endDateObj.setDate(endDateObj.getDate() + 3);
                const endDate = endDateObj.toISOString().split("T")[0];
                const clubName = b.camp_name.split(/[-–]/)[0].trim() || b.camp_name;

                const { data: newCamp, error: campErr } = await supabase
                  .from("camps")
                  .insert({
                    name: b.camp_name,
                    club_name: clubName,
                    venue: b.venue || "TBC",
                    county: b.county || "TBC",
                    start_date: startDate,
                    end_date: endDate,
                    age_group: "U8-U12",
                    status: "draft",
                    is_auto_created: true,
                  } as any)
                  .select("id, name, venue, county, start_date, end_date, club_name")
                  .single();

                if (campErr) {
                  errorRows.push({
                    external_booking_id: b.external_booking_id || null,
                    camp_name: b.camp_name,
                    child_first_name: b.child_first_name,
                    child_last_name: b.child_last_name,
                    error_code: "draft_camp_creation",
                    error_message: `Draft camp "${b.camp_name}": ${campErr.message}`,
                    raw_row_json: b,
                  });
                } else if (newCamp) {
                  matched_camp_id = newCamp.id;
                  campsList.push(newCamp as CampRow);
                  draftCampCache[normName] = newCamp.id;
                  draftsCreated++;
                  match_status = "matched";
                  match_score = 100;
                  match_reason = "Auto-created draft camp";
                }
              }
            }
          }

          const totalAmount = parseMoney(b.total_amount);
          const amountPaidRaw = parseMoney(b.amount_paid);
          const siblingDiscount = parseMoney(b.sibling_discount);
          const refundAmount = parseMoney(b.refund_amount);
          const totalCost = Math.max(0, totalAmount - siblingDiscount);
          const amountOwed = Math.max(0, totalCost - amountPaidRaw - refundAmount);
          const paymentStatus = normalizePaymentStatus(b.payment_status);

          const medCondition = b.medical_condition?.trim() || "";
          const medNotes = b.medical_notes?.trim() || "";
          const combinedMedical = [medCondition, medNotes].filter(Boolean).join(" — ") || null;

          const record = {
            external_booking_id: b.external_booking_id || null,
            camp_name: b.camp_name,
            camp_date: b.camp_date || null,
            venue: b.venue || null,
            county: b.county || null,
            child_first_name: b.child_first_name,
            child_last_name: b.child_last_name,
            date_of_birth: parseDateOfBirth(b.date_of_birth),
            age: parseAge(b.age),
            parent_name: b.parent_name || null,
            parent_phone: b.parent_phone || null,
            parent_email: b.parent_email || null,
            emergency_contact: b.emergency_contact || null,
            alternate_phone: b.alternate_phone || null,
            medical_condition: b.medical_condition || null,
            medical_notes: combinedMedical,
            kit_size: b.kit_size || "M",
            payment_status: paymentStatus,
            booking_status: b.booking_status || "confirmed",
            booking_date: parseDateOfBirth(b.booking_date),
            source_system: "bookings.teachingtekkers.com",
            last_synced_at: new Date().toISOString(),
            sync_log_id: syncLog.id,
            matched_camp_id,
            match_status,
            match_score,
            match_reason,
            duplicate_warning: false,
            total_amount: totalAmount,
            amount_paid: amountPaidRaw,
            sibling_discount: siblingDiscount,
            refund_amount: refundAmount,
            amount_owed: amountOwed,
            payment_type: b.payment_type || null,
            photo_permission: parsePhotoPermission(b.photo_permission),
          };

          const existing = b.external_booking_id ? existingByExtId[b.external_booking_id] : null;

          if (existing) {
            if (existing.manual_override) {
              delete record.matched_camp_id;
              delete record.match_status;
              delete record.match_score;
              delete record.match_reason;
            }
            updates.push({ id: existing.id, record });
          } else {
            inserts.push(record);
          }
        } catch (e) {
          failed++;
          errorRows.push({
            external_booking_id: b.external_booking_id || null,
            camp_name: b.camp_name || "",
            child_first_name: b.child_first_name || "",
            child_last_name: b.child_last_name || "",
            error_code: "booking_processing",
            error_message: e.message,
            raw_row_json: b,
          });
        }
      }

      if (inserts.length > 0) {
        const { error: insertErr } = await supabase
          .from("synced_bookings")
          .insert(inserts);
        if (insertErr) {
          let batchFailed = 0;
          for (const row of inserts) {
            const { error: rowErr } = await supabase
              .from("synced_bookings")
              .insert(row);
            if (rowErr) {
              batchFailed++;
              errorRows.push({
                external_booking_id: (row.external_booking_id as string) || null,
                camp_name: (row.camp_name as string) || "",
                child_first_name: (row.child_first_name as string) || "",
                child_last_name: (row.child_last_name as string) || "",
                error_code: "booking_insert",
                error_message: rowErr.message,
                raw_row_json: row,
              });
            }
          }
          failed += batchFailed;
          created -= batchFailed;
        }
      }

      for (const u of updates) {
        const { error: updateErr } = await supabase
          .from("synced_bookings")
          .update(u.record)
          .eq("id", u.id);
        if (updateErr) {
          failed++;
          updated--;
          errorRows.push({
            external_booking_id: (u.record.external_booking_id as string) || null,
            camp_name: (u.record.camp_name as string) || "",
            child_first_name: (u.record.child_first_name as string) || "",
            child_last_name: (u.record.child_last_name as string) || "",
            error_code: "booking_update",
            error_message: updateErr.message,
            raw_row_json: u.record,
          });
        }
      }
    }

    // Write error rows to import_errors table
    if (errorRows.length > 0) {
      const errorInserts = errorRows.map(e => ({
        sync_log_id: syncLog.id,
        external_booking_id: e.external_booking_id,
        camp_name: e.camp_name,
        child_first_name: e.child_first_name,
        child_last_name: e.child_last_name,
        error_code: e.error_code,
        error_message: e.error_message,
        raw_row_json: e.raw_row_json,
      }));
      await supabase.from("import_errors").insert(errorInserts);
    }

    const errorSummary = errorRows.length > 0
      ? `${errorRows.length} failures – see import_errors table`
      : null;

    await supabase
      .from("sync_logs")
      .update({
        status: failed > 0 ? "completed_with_errors" : "completed",
        sync_completed_at: new Date().toISOString(),
        records_created: created,
        records_updated: updated,
        records_failed: failed,
        error_notes: errorSummary,
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
          needs_review: needsReview,
          drafts_created: draftsCreated,
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
