import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type BookingRow = {
  id: string;
  external_booking_id: string | null;
  child_first_name: string | null;
  child_last_name: string | null;
  date_of_birth: string | null;
  booking_date?: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  kit_size: string | null;
  medical_notes: string | null;
  medical_condition?: string | null;
  photo_permission: boolean | null;
  matched_player_id: string | null;
  camp_name: string | null;
};

function norm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function parseSafeDate(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    const month = Number(m);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${m}-${d}`;
  }

  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const month = Number(m);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

function computeIdentityKey(
  firstName: string,
  lastName: string,
  dob: string | null,
  parentEmail: string | null,
  parentPhone: string | null,
): string {
  const fn = norm(firstName);
  const ln = norm(lastName);
  if (dob) return `${fn}|${ln}|${dob}`;
  if (parentEmail) return `${fn}|${ln}|email|${norm(parentEmail)}`;
  if (parentPhone) return `${fn}|${ln}|phone|${digitsOnly(parentPhone)}`;
  return `${fn}|${ln}|nodob`;
}

async function logImportError(supabase: ReturnType<typeof createClient>, booking: BookingRow, message: string) {
  await supabase.from("import_errors").insert({
    error_code: "materialize_players",
    error_message: message,
    child_first_name: booking.child_first_name,
    child_last_name: booking.child_last_name,
    camp_name: booking.camp_name,
    external_booking_id: booking.external_booking_id,
    raw_row_json: booking,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const bookingIds = Array.isArray(body?.bookingIds) ? body.bookingIds.filter(Boolean) : null;
    const externalBookingIds = Array.isArray(body?.externalBookingIds) ? body.externalBookingIds.filter(Boolean) : null;

    let query = supabase
      .from("synced_bookings")
      .select("id, external_booking_id, child_first_name, child_last_name, date_of_birth, booking_date, parent_email, parent_phone, kit_size, medical_notes, medical_condition, photo_permission, matched_player_id, camp_name")
      .order("imported_at", { ascending: true });

    if (bookingIds && bookingIds.length > 0) {
      query = query.in("id", bookingIds);
    } else if (externalBookingIds && externalBookingIds.length > 0) {
      query = query.in("external_booking_id", externalBookingIds);
    } else {
      query = query.is("matched_player_id", null);
    }

    const { data: bookings, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    let createdPlayers = 0;
    let linkedPlayers = 0;
    let skippedMissingName = 0;
    const failedRows: Array<{ booking_id: string; name: string; reason: string }> = [];
    const failureGroups = new Map<string, number>();

    for (const booking of (bookings || []) as BookingRow[]) {
      const firstName = booking.child_first_name?.trim() || "";
      const lastName = booking.child_last_name?.trim() || "";

      if (!firstName || !lastName) {
        skippedMissingName += 1;
        continue;
      }

      const parsedDob = parseSafeDate(booking.date_of_birth);
      const parentEmail = booking.parent_email?.trim() || null;
      const parentPhone = booking.parent_phone?.trim() || null;
      const identityKey = computeIdentityKey(firstName, lastName, parsedDob, parentEmail, parentPhone);

      const { count: existingCountBefore } = await supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .eq("identity_key", identityKey);

      const medicalNotes = [booking.medical_condition, booking.medical_notes].filter(Boolean).join(" — ") || null;

      const { data: player, error: upsertErr } = await supabase
        .from("players")
        .upsert({
          first_name: firstName,
          last_name: lastName,
          date_of_birth: parsedDob,
          medical_notes: medicalNotes,
          kit_size: booking.kit_size || "M",
          photo_permission: booking.photo_permission ?? false,
          guardian_email: parentEmail,
          guardian_phone: parentPhone ? digitsOnly(parentPhone) : null,
          norm_first_name: norm(firstName),
          norm_last_name: norm(lastName),
          identity_key: identityKey,
        }, { onConflict: "identity_key" })
        .select("id")
        .single();

      if (upsertErr || !player) {
        const reason = upsertErr?.message || "Player upsert failed";
        failedRows.push({ booking_id: booking.id, name: `${firstName} ${lastName}`, reason });
        failureGroups.set(reason, (failureGroups.get(reason) || 0) + 1);
        await logImportError(supabase, booking, reason);
        continue;
      }

      if (!existingCountBefore) createdPlayers += 1;

      const { error: linkErr } = await supabase
        .from("synced_bookings")
        .update({ matched_player_id: player.id })
        .eq("id", booking.id);

      if (linkErr) {
        const reason = `Failed to link booking: ${linkErr.message}`;
        failedRows.push({ booking_id: booking.id, name: `${firstName} ${lastName}`, reason });
        failureGroups.set(reason, (failureGroups.get(reason) || 0) + 1);
        await logImportError(supabase, booking, reason);
        continue;
      }

      linkedPlayers += 1;
    }

    return new Response(JSON.stringify({
      success: true,
      processed: (bookings || []).length,
      created_players: createdPlayers,
      linked_players: linkedPlayers,
      skipped_missing_name: skippedMissingName,
      failed: failedRows.length,
      failed_rows: failedRows.slice(0, 25),
      failure_summary: Array.from(failureGroups.entries()).map(([message, count]) => ({ message, count })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});