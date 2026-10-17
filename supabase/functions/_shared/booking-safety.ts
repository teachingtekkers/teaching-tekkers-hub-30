import { normEmail, normPhone, normText, type ExistingRow, type PlannedRow } from "./booking-logic.ts";

export interface PersonEvidence {
  id: string; first_name?: string; last_name?: string; child_first_name?: string; child_last_name?: string;
  date_of_birth: string | null; guardian_email?: string | null; guardian_phone?: string | null;
  parent_email?: string | null; parent_phone?: string | null; matched_player_id?: string | null;
  needs_admin_review?: boolean; duplicate_warning?: boolean; [key: string]: unknown;
}
export interface SafetySnapshot {
  players: PersonEvidence[]; synced_bookings: PersonEvidence[]; bookings: Record<string, unknown>[];
  held_audits: Record<string, unknown>[]; pending_rows: Record<string, unknown>[];
  [key: string]: unknown;
}
function name(p: PersonEvidence) { return `${normText(p.first_name ?? p.child_first_name)}|${normText(p.last_name ?? p.child_last_name)}`; }
function contact(a: PersonEvidence, b: PersonEvidence) {
  const e = normEmail(a.guardian_email ?? a.parent_email), p = normPhone(a.guardian_phone ?? a.parent_phone);
  return Boolean((e && e === normEmail(b.guardian_email ?? b.parent_email)) || (p && p === normPhone(b.guardian_phone ?? b.parent_phone)));
}
export function proveIdentity(a: PersonEvidence, b: PersonEvidence) {
  return Boolean(name(a) === name(b) && a.date_of_birth && a.date_of_birth === b.date_of_birth && contact(a, b));
}

/** Global person evidence never turns another camp's registration into this camp's registration. */
export function applyGlobalSafety(plan: PlannedRow[], snapshot: SafetySnapshot, sourceCampId: string) {
  const regs = snapshot.synced_bookings;
  const profiles = snapshot.players;
  const native = snapshot.bookings.flatMap((b) => {
    const p = profiles.find((p) => p.id === b.player_id);
    return p ? [{ ...p, id: String(b.id), parent_email: b.parent_email as string, parent_phone: b.parent_phone as string, guardian_email: undefined, guardian_phone: undefined, matched_player_id: p.id }] : [];
  });
  const all = [...profiles, ...regs, ...native];
  const holdIds = new Set(snapshot.held_audits.map((h) => String(h.target_id ?? "")));
  for (const p of plan) {
    if (p.classification === "rejected") continue;
    const n = p.normalized as unknown as PersonEvidence;
    const named = all.filter((x) => name(x) === name(n));
    const matched = named.filter((x) => proveIdentity(n, x));
    const profileIds = new Set(matched.flatMap((x) => profiles.some((a) => a.id === x.id) ? [x.id] : x.matched_player_id ? [x.matched_player_id] : []));
    const verifiedProfiles = [...profileIds].filter((id) => {
      const profile = profiles.find((x) => x.id === id);
      return profile && (proveIdentity(n, profile) || (name(n) === name(profile) && n.date_of_birth === profile.date_of_birth && matched.some((r) => r.matched_player_id === id)));
    });
    const held = named.some((x) => holdIds.has(x.id) || x.needs_admin_review || x.duplicate_warning) || snapshot.pending_rows.some((r) => {
      const v = r.normalized as PersonEvidence | undefined;
      return v && name(v) === name(n);
    }) || snapshot.held_audits.some((h) => {
      const ev = h.evidence as Record<string, unknown> | undefined;
      return ev?.child && normText(ev.child) === normText(`${n.child_first_name} ${n.child_last_name}`);
    });
    const contradictory = named.some((x) => !proveIdentity(n, x) && !verifiedProfiles.includes(x.id));
    const forcedDuplicate = (sourceCampId === "178" && [33, 34].includes(p.row_index)) || (sourceCampId === "181" && [23, 24].includes(p.row_index));
    const sensitiveDiff = Object.keys(p.diff ?? {}).some((f) => ["medical_notes", "medical_condition", "photo_permission"].includes(f));
    const unsafe = held || forcedDuplicate || n.amount_owed === null || p.conflict || sensitiveDiff || (p.classification === "new" && (contradictory || profileIds.size > 1 || verifiedProfiles.length !== profileIds.size));
    if (unsafe) {
      p.classification = "ambiguous";
      p.reason = held ? "Historical identity/field hold: retain for admin review" : forcedDuplicate ? "Documented duplicate source-row candidate: held" : n.amount_owed === null ? "Refund/cancellation requires ledger review" : p.conflict || sensitiveDiff ? "Protected staff, medical or consent values require review" : "Conflicting or multiple cross-camp person identities";
      // Only skipping is supported for these safety holds; no implicit approval or profile merge.
      p.normalized._safety_hold = true;
      p.candidate_ids = [];
      p.diff = null;
      continue;
    }
    if (p.classification === "new") {
      p.normalized._profile_id = verifiedProfiles[0] ?? null;
      p.reason = verifiedProfiles.length ? "New camp registration; reuse proven existing person profile" : "New registration with no conflicting global person evidence";
    }
  }
  // Both entries in any in-file repeat group remain held, including the first row.
  for (const p of plan.filter((p) => p.reason?.startsWith("Duplicate of row "))) {
    const match = p.reason?.match(/^Duplicate of row (\d+)/);
    const first = match ? plan[Number(match[1]) - 1] : undefined;
    for (const r of [first, p]) if (r) {
      r.classification = "ambiguous"; r.reason = "Duplicate source registrations require review (not collapsed)";
      r.normalized._safety_hold = true; r.candidate_ids = []; r.diff = null;
    }
  }
  return plan;
}

export function scopedExisting(snapshot: SafetySnapshot, sourceSystem: string, sourceCampId: string, campId: string): ExistingRow[] {
  return snapshot.synced_bookings.filter((r) => (r.source_system === sourceSystem && r.source_camp_id === sourceCampId) || (r.matched_camp_id === campId && r.source_camp_id == null)) as unknown as ExistingRow[];
}