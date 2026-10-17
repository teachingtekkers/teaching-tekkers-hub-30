import { describe, expect, it } from "vitest";
import { planImport, parseMoney, safeParseDate, normaliseIncoming } from "../../supabase/functions/_shared/booking-logic";
import { applyGlobalSafety, proveIdentity, type PersonEvidence, type SafetySnapshot } from "../../supabase/functions/_shared/booking-safety";

const row = { child_first_name: "Synthetic", child_last_name: "Child", date_of_birth: "29/02/2016", parent_email: "parent@example.test", parent_phone: "0871234567", total_amount: "75", sibling_discount: "10", amount_paid: "20" };
const profile: PersonEvidence = { id: "profile-a", first_name: "Synthetic", last_name: "Child", date_of_birth: "2016-02-29", guardian_email: "PARENT@example.test", guardian_phone: "0871234567" };
function state(p: PersonEvidence[] = [], registrations: PersonEvidence[] = []): SafetySnapshot { return { players: p, synced_bookings: registrations, bookings: [], held_audits: [], pending_rows: [] }; }
function preview(s: SafetySnapshot, rows = [row], source = "test") { return applyGlobalSafety(planImport(rows, []), s, source); }

describe("global CSV identity safeguards", () => {
  it("allows another camp and reuses one proven profile without merging registrations", () => {
    const reg = { ...normaliseIncoming(row), id: "reg-other", matched_player_id: profile.id, matched_camp_id: "other" } as PersonEvidence;
    const [p] = preview(state([profile], [reg]));
    expect(p.classification).toBe("new"); expect(p.normalized._profile_id).toBe("profile-a");
  });
  it("normalized phone OR email proves identity, never DOB alone", () => {
    const n = { ...normaliseIncoming(row), id: "n" } as PersonEvidence;
    expect(proveIdentity(n, { ...profile, guardian_email: "changed@example.test", guardian_phone: "+353871234567" })).toBe(true);
    expect(proveIdentity(n, { ...profile, guardian_email: null, guardian_phone: null })).toBe(false);
    expect(preview(state(), [{ ...row, parent_email: "", parent_phone: "" }])[0].classification).toBe("ambiguous");
  });
  it.each([
    { ...profile, date_of_birth: "2016-02-28" },
    { ...profile, guardian_email: "other@example.test", guardian_phone: "0879999999" },
  ])("holds same-name conflicting DOB/contact", (p) => expect(preview(state([p]))[0].classification).toBe("ambiguous"));
  it("holds multiple candidate profiles even if both match", () => expect(preview(state([profile, { ...profile, id: "profile-b" }]))[0].classification).toBe("ambiguous"));
  it("does not override contradictory profile contact using linked registration evidence", () => {
    const wrong = { ...profile, guardian_email: "wrong@example.test", guardian_phone: "0899999999" };
    const reg = { ...normaliseIncoming(row), id: "reg", matched_player_id: profile.id } as PersonEvidence;
    expect(preview(state([wrong], [reg]))[0].classification).toBe("ambiguous");
  });
  it("checks profiles beyond row 1000", () => {
    const unrelated = Array.from({ length: 1500 }, (_, i) => ({ ...profile, id: `p${i}`, first_name: `Other${i}` }));
    expect(preview(state([...unrelated, profile]))[0].normalized._profile_id).toBe("profile-a");
  });
  it("holds audited records and pending identity evidence", () => {
    const s = state([profile]); s.held_audits = [{ target_id: profile.id }];
    expect(preview(s)[0].classification).toBe("ambiguous");
    const other = state(); other.pending_rows = [{ normalized: normaliseIncoming(row) }];
    expect(preview(other)[0].classification).toBe("ambiguous");
  });
  it.each(["Noah Byrnes", "Conall Bishop", "Caden Moore"])("keeps documented identity %s held", (name) => {
    const [first, last] = name.split(" "); expect(preview(state(), [{ ...row, child_first_name: first, child_last_name: last }])[0].classification).toBe("ambiguous");
  });
  it("holds both in-file duplicates, no row is silently retained as a verified registration", () => expect(preview(state(), [row, row]).map((r) => r.classification)).toEqual(["ambiguous", "ambiguous"]));
  it("holds matching identities even with different email but matching phone within one file", () => expect(preview(state(), [row, { ...row, parent_email: "another@example.test" }]).map((r) => r.classification)).toEqual(["ambiguous", "ambiguous"]));
  it.each([["178", 33], ["178", 34], ["181", 23], ["181", 24]])("preserves documented source %s zero-based row %s hold", (source, index) => {
    const p = planImport([row], []); p[0].row_index = Number(index);
    expect(applyGlobalSafety(p, state(), String(source))[0].classification).toBe("ambiguous");
  });
  it.each([{ refund_amount: "20" }, { booking_status: "Cancelled" }])("holds refund/cancellation without guessing ledger", (extra) => expect(preview(state(), [{ ...row, ...extra }])[0].classification).toBe("ambiguous"));
  it("uses total after discount: 75 minus paid20 equals55, not45", () => expect(normaliseIncoming(row).amount_owed).toBe(55));
});
describe("strict input validation", () => {
  it.each(["NaN", "Infinity", "85oops", "1,2", "€", "-1", "1e2", "12.345", "1000001"])("rejects malformed money %s", (money) => {
    expect(() => parseMoney(money)).toThrow(); expect(preview(state(), [{ ...row, total_amount: money }])[0].classification).toBe("rejected");
  });
  it("rejects nonfinite numeric money", () => { expect(() => parseMoney(NaN)).toThrow(); expect(() => parseMoney(Infinity)).toThrow(); });
  it("accepts bounded whole money and proper currency/grouping", () => { expect(parseMoney("€1,234.50")).toBe(1234.5); expect(parseMoney(0)).toBe(0); });
  it.each(["29/02/1900", "29/02/2019", "31/04/2026", "2026-02-30", "2026-10-17junk"])("rejects impossible/full-string dates %s", (date) => {
    expect(safeParseDate(date)).toBeNull(); expect(preview(state(), [{ ...row, booking_date: date }])[0].classification).toBe("rejected");
  });
  it("accepts leap years including century 2000", () => { expect(safeParseDate("29/02/2000")).toBe("2000-02-29"); expect(safeParseDate("29/02/2016")).toBe("2016-02-29"); });
});