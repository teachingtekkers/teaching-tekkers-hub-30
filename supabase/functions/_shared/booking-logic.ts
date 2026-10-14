// Pure matching / diff logic for the booking importer. No I/O — unit-testable.

export type Incoming = Record<string, string | undefined>;

export interface ExistingRow {
  id: string;
  child_first_name: string;
  child_last_name: string;
  date_of_birth: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  source_participant_id: string | null;
  participant_key: string | null;
  source_values: Record<string, unknown> | null;
  manual_override: boolean | null;
  kit_given: boolean | null;
  [k: string]: unknown;
}

export type Classification = "new" | "updated" | "unchanged" | "ambiguous" | "rejected";

export interface PlannedRow {
  row_index: number;
  classification: Classification;
  reason: string | null;
  participant_key: string | null;
  family_key: string | null;
  synced_booking_id: string | null;
  candidate_ids: string[];
  normalized: Record<string, unknown>;
  diff: Record<string, { from: unknown; to: unknown }> | null;
  protected_fields: string[];
  conflict: boolean;
  family_verified: boolean;
}

// ── normalisers ──
export function normText(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
export function normEmail(s: unknown): string {
  return String(s ?? "").trim().toLowerCase();
}
export function normPhone(s: unknown): string {
  const d = String(s ?? "").replace(/\D/g, "");
  return d.length >= 7 ? d.slice(-9) : "";
}
export function parseMoney(val: unknown): number {
  if (val == null || val === "") return 0;
  if (typeof val === "number") return val;
  const n = parseFloat(String(val).replace(/[€£$,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}
export function parseAge(val: unknown): number | null {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  const m = s.match(/(\d+)\s*year/i);
  if (m) return parseInt(m[1], 10);
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}
/** No `new Date(string)`: supports YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY. */
export function safeParseDate(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  let y: number, m: number, d: number;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (dmy) { d = +dmy[1]; m = +dmy[2]; y = +dmy[3]; }
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function parseBool(val: unknown): boolean | null {
  const s = String(val ?? "").toLowerCase().trim();
  if (["yes", "true", "1", "y"].includes(s)) return true;
  if (["no", "false", "0", "n"].includes(s)) return false;
  return null;
}
function normPaymentStatus(val: unknown): string {
  const s = String(val ?? "").toLowerCase();
  if (s.includes("refund")) return "refunded";
  if (s.includes("partial")) return "partial";
  if (s.includes("unpaid") || s.includes("pending") || s.includes("awaiting")) return "pending";
  if (s.includes("paid") || s.includes("complete") || s.includes("succe")) return "paid";
  return "pending";
}

export const PAYMENT_FIELDS = ["total_amount", "sibling_discount", "amount_paid", "refund_amount", "amount_owed", "payment_status", "payment_type"];
export const SOURCE_FIELDS = [
  "child_first_name", "child_last_name", "parent_name", "parent_phone", "parent_email", "emergency_contact", "alternate_phone",
  "date_of_birth", "age", "medical_condition", "medical_notes", "photo_permission", "booking_date", "booking_status", "kit_size",
  ...PAYMENT_FIELDS,
];
const NUMERIC = new Set(["total_amount", "sibling_discount", "amount_paid", "refund_amount", "amount_owed", "age"]);

/** Turn a mapped CSV row into DB-shaped source values. */
export function normaliseIncoming(r: Incoming): Record<string, unknown> {
  const total = parseMoney(r.total_amount);
  const disc = parseMoney(r.sibling_discount);
  const paid = parseMoney(r.amount_paid);
  const refund = parseMoney(r.refund_amount);
  const owed = Math.max(0, Math.max(0, total - disc) - paid - refund);
  const medC = (r.medical_condition || "").trim();
  const medN = (r.medical_notes || "").trim();
  return {
    child_first_name: (r.child_first_name || "").trim(),
    child_last_name: (r.child_last_name || "").trim(),
    parent_name: r.parent_name?.trim() || null,
    parent_phone: r.parent_phone?.trim() || null,
    parent_email: r.parent_email?.trim() || null,
    emergency_contact: r.emergency_contact?.trim() || null,
    alternate_phone: r.alternate_phone?.trim() || null,
    date_of_birth: safeParseDate(r.date_of_birth),
    age: parseAge(r.age),
    medical_condition: medC || null,
    medical_notes: [medC, medN].filter(Boolean).join(" — ") || null,
    photo_permission: parseBool(r.photo_permission),
    booking_date: safeParseDate(r.booking_date),
    booking_status: r.booking_status?.trim() || "confirmed",
    kit_size: r.kit_size?.trim() || null,
    total_amount: total,
    sibling_discount: disc,
    amount_paid: paid,
    refund_amount: refund,
    amount_owed: owed,
    payment_status: r.payment_status ? normPaymentStatus(r.payment_status) : (owed <= 0 && total > 0 ? "paid" : "pending"),
    payment_type: r.payment_type?.trim() || null,
  };
}

export function guardianKey(email: unknown, phone: unknown): string {
  const e = normEmail(email);
  if (e) return `e:${e}`;
  const p = normPhone(phone);
  return p ? `p:${p}` : "";
}
export function participantKey(first: unknown, last: unknown, dob: unknown, email: unknown, phone: unknown): string {
  return [normText(first), normText(last), String(dob ?? ""), guardianKey(email, phone)].join("|");
}
export function familyKey(sourceBookingId: string | undefined, email: unknown, phone: unknown, pKey: string): string {
  if (sourceBookingId?.trim()) return `id:${sourceBookingId.trim()}`;
  return guardianKey(email, phone) || `solo:${pKey}`;
}

function isEmpty(v: unknown) { return v == null || v === ""; }
export function same(field: string, a: unknown, b: unknown): boolean {
  if (isEmpty(a) && isEmpty(b)) return true;
  if (NUMERIC.has(field)) return Number(a ?? 0) === Number(b ?? 0);
  if (typeof a === "boolean" || typeof b === "boolean") return a === b;
  return String(a ?? "").trim() === String(b ?? "").trim();
}

/**
 * Compute which source fields to apply to an existing row, never overwriting app-side edits.
 * A field counts as edited in the app when it no longer equals the value the last import wrote.
 * Rows from the old importer (no stored source values) are treated conservatively.
 */
export function computePatch(existing: ExistingRow, inc: Record<string, unknown>) {
  const prev = existing.source_values;
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const protectedFields: string[] = [];

  const paymentChanged = PAYMENT_FIELDS.some((f) => !same(f, existing[f], inc[f]));
  let protectPayments = false;
  if (paymentChanged) {
    if (existing.manual_override) protectPayments = true;
    else if (prev) protectPayments = PAYMENT_FIELDS.some((f) => !same(f, existing[f], prev[f]));
    // Older rows have no record of what the source last said, so any payment difference could be a
    // staff correction (part payment, refund, marked paid). Never guess: keep the app value and flag it.
    else protectPayments = true;
  }

  for (const f of SOURCE_FIELDS) {
    if (same(f, existing[f], inc[f])) continue;
    // Source hasn't changed since we last saw it: the app value is a deliberate edit, keep it quietly
    if (prev && same(f, prev[f], inc[f])) continue;
    if (isEmpty(inc[f]) && !PAYMENT_FIELDS.includes(f)) continue; // never blank out data with an empty cell
    if (PAYMENT_FIELDS.includes(f)) {
      if (protectPayments) { protectedFields.push(f); continue; }
    } else if (f === "kit_size" && existing.kit_given) {
      protectedFields.push(f); continue;
    } else if (!isEmpty(existing[f])) {
      const editedInApp = prev ? !same(f, existing[f], prev[f]) : false;
      if (editedInApp) { protectedFields.push(f); continue; }
    }
    diff[f] = { from: existing[f] ?? null, to: inc[f] ?? null };
  }
  return { diff, protectedFields };
}

/** Classify every incoming row against existing participants for one source camp. */
export function planImport(rows: Incoming[], existing: ExistingRow[]): PlannedRow[] {
  const byPid = new Map<string, ExistingRow>();
  const byKey = new Map<string, ExistingRow[]>();
  const byName = new Map<string, ExistingRow[]>();
  const byDobGuardian = new Map<string, ExistingRow[]>();
  for (const e of existing) {
    if (e.source_participant_id) byPid.set(e.source_participant_id, e);
    const k = e.participant_key || participantKey(e.child_first_name, e.child_last_name, e.date_of_birth, e.parent_email, e.parent_phone);
    byKey.set(k, [...(byKey.get(k) || []), e]);
    const n = `${normText(e.child_first_name)}|${normText(e.child_last_name)}`;
    byName.set(n, [...(byName.get(n) || []), e]);
    const dg = e.date_of_birth && guardianKey(e.parent_email, e.parent_phone);
    if (dg) { const k2 = `${e.date_of_birth}|${dg}`; byDobGuardian.set(k2, [...(byDobGuardian.get(k2) || []), e]); }
  }
  const claimed = new Map<string, number>();
  const seenKeys = new Map<string, number>();
  const deferred: (() => void)[] = [];
  const out: PlannedRow[] = [];

  rows.forEach((r, i) => {
    const inc = normaliseIncoming(r);
    const pid = r.source_participant_id?.trim() || null;
    const base: PlannedRow = {
      row_index: i, classification: "rejected", reason: null, participant_key: null, family_key: null,
      synced_booking_id: null, candidate_ids: [], normalized: { ...inc, source_participant_id: pid, source_booking_id: r.source_booking_id?.trim() || null },
      diff: null, protected_fields: [], conflict: false, family_verified: !!r.source_booking_id?.trim(),
    };
    if (!inc.child_first_name || !inc.child_last_name) {
      out.push({ ...base, reason: "Missing child first or last name" }); return;
    }
    if (!isEmpty(r.date_of_birth) && !inc.date_of_birth) {
      out.push({ ...base, reason: `Unreadable date of birth "${r.date_of_birth}"` }); return;
    }
    const pKey = participantKey(inc.child_first_name, inc.child_last_name, inc.date_of_birth, inc.parent_email, inc.parent_phone);
    base.participant_key = pKey;
    base.family_key = familyKey(r.source_booking_id, inc.parent_email, inc.parent_phone, pKey);

    const dupKey = pid ? `pid:${pid}` : pKey;
    if (seenKeys.has(dupKey)) {
      out.push({ ...base, reason: `Duplicate of row ${seenKeys.get(dupKey)! + 1} in this file` }); return;
    }
    seenKeys.set(dupKey, i);

    const finishMatch = (e: ExistingRow, how: string) => {
      claimed.set(e.id, i);
      const { diff, protectedFields } = computePatch(e, inc);
      const changed = Object.keys(diff).length > 0;
      out.push({
        ...base, synced_booking_id: e.id, diff, protected_fields: protectedFields, conflict: protectedFields.length > 0,
        classification: changed ? "updated" : "unchanged",
        reason: how + (protectedFields.length ? `; kept app edits: ${protectedFields.join(", ")}` : ""),
      });
    };

    // Pass 1: confident matches (source ID, or unique exact identity). Others wait for pass 2
    // so the outcome never depends on CSV row order.
    if (pid && byPid.has(pid)) { finishMatch(byPid.get(pid)!, "Matched by source participant ID"); return; }
    const hasIdentity = !!inc.date_of_birth || !!guardianKey(inc.parent_email, inc.parent_phone);
    const exactAll = (byKey.get(pKey) || []).filter((e) => !pid || !e.source_participant_id);
    if (exactAll.length === 1 && hasIdentity && !claimed.has(exactAll[0].id)) { finishMatch(exactAll[0], "Matched by name + DOB + guardian"); return; }

    deferred.push(() => {
      const exact = exactAll.filter((e) => !claimed.has(e.id));
      const gk = guardianKey(inc.parent_email, inc.parent_phone);
      // Same name: unclaimed records, or claimed ones from the same guardian (likely a typo duplicate)
      const nameCands = (byName.get(`${normText(inc.child_first_name)}|${normText(inc.child_last_name)}`) || [])
        .filter((e) => !claimed.has(e.id) || (gk && guardianKey(e.parent_email, e.parent_phone) === gk));
      if (exact.length > 1) {
        out.push({ ...base, classification: "ambiguous", candidate_ids: exact.map((e) => e.id), reason: `${exact.length} existing records have identical details` }); return;
      }
      if (!hasIdentity) {
        out.push({ ...base, classification: "ambiguous", candidate_ids: nameCands.filter((e) => !claimed.has(e.id)).map((e) => e.id), reason: "No date of birth or guardian contact to confirm identity" }); return;
      }
      if (nameCands.length > 0) {
        out.push({ ...base, classification: "ambiguous", candidate_ids: nameCands.filter((e) => !claimed.has(e.id)).map((e) => e.id), reason: "Same child name exists with different DOB or guardian details" }); return;
      }
      // A renamed child (spelling fix, double-barrelled surname) keeps DOB + guardian
      const renamed = inc.date_of_birth && gk ? (byDobGuardian.get(`${inc.date_of_birth}|${gk}`) || []).filter((e) => !claimed.has(e.id)) : [];
      if (renamed.length > 0) {
        out.push({ ...base, classification: "ambiguous", candidate_ids: renamed.map((e) => e.id), reason: "Different name but same DOB and guardian as an existing child" }); return;
      }
      // Same DOB + same guardian phone but changed email (or vice versa)
      const phone = normPhone(inc.parent_phone);
      const altContact = inc.date_of_birth ? existing.filter((e) => !claimed.has(e.id) && e.date_of_birth === inc.date_of_birth &&
        normText(e.child_last_name) === normText(inc.child_last_name) &&
        ((phone && normPhone(e.parent_phone) === phone) || (normEmail(inc.parent_email) && normEmail(e.parent_email) === normEmail(inc.parent_email)))) : [];
      if (altContact.length > 0) {
        out.push({ ...base, classification: "ambiguous", candidate_ids: altContact.map((e) => e.id), reason: "Matches an existing child's DOB and one guardian contact, but other details differ" }); return;
      }
      out.push({ ...base, classification: "new", reason: pid ? "New participant ID" : "No existing participant matches" });
    });
  });
  deferred.forEach((fn) => fn());
  return out.sort((a, b) => a.row_index - b.row_index);
}
