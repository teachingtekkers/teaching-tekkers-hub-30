import { describe, it, expect } from "vitest";
import { planImport, normaliseIncoming, participantKey, type ExistingRow } from "../../supabase/functions/booking-import/logic";

// Synthetic test records only
const csv = [
  { child_first_name: "Aoife", child_last_name: "Testerson", date_of_birth: "01/02/2016", parent_email: "fam1@example.test", parent_phone: "087 111 1111", total_amount: "170", sibling_discount: "10", amount_paid: "160", payment_status: "Paid", kit_size: "S" },
  { child_first_name: "Cian", child_last_name: "Testerson", date_of_birth: "05/06/2018", parent_email: "fam1@example.test", parent_phone: "087 111 1111", total_amount: "0", amount_paid: "0", payment_status: "Paid", kit_size: "XS" },
  { child_first_name: "Sean", child_last_name: "Murphy", date_of_birth: "03/03/2015", parent_email: "murphyA@example.test", total_amount: "85", amount_paid: "0", payment_status: "Pending" },
  { child_first_name: "Sean", child_last_name: "Murphy", date_of_birth: "09/09/2017", parent_email: "murphyB@example.test", total_amount: "85", amount_paid: "85", payment_status: "Paid" },
];

function asExisting(rows: typeof csv, overrides: Partial<ExistingRow>[] = []): ExistingRow[] {
  return rows.map((r, i) => {
    const n = normaliseIncoming(r);
    return {
      id: `db-${i}`, ...n, source_participant_id: null,
      participant_key: participantKey(n.child_first_name, n.child_last_name, n.date_of_birth, n.parent_email, n.parent_phone),
      source_values: n, manual_override: false, kit_given: false, staff_notes: null,
      ...(overrides[i] || {}),
    } as ExistingRow;
  });
}

describe("booking import planner", () => {
  it("first import: all new, siblings share one family, identical names stay separate", () => {
    const plan = planImport(csv, []);
    expect(plan.map((p) => p.classification)).toEqual(["new", "new", "new", "new"]);
    expect(new Set(plan.map((p) => p.family_key)).size).toBe(3);
    expect(plan[0].family_key).toBe(plan[1].family_key);
    expect(plan[2].participant_key).not.toBe(plan[3].participant_key);
  });

  it("repeat import is unchanged and reordered rows still match the same records", () => {
    const existing = asExisting(csv);
    const reordered = [csv[3], csv[1], csv[0], csv[2]];
    const plan = planImport(reordered, existing);
    expect(plan.every((p) => p.classification === "unchanged")).toBe(true);
    expect(plan.map((p) => p.synced_booking_id)).toEqual(["db-3", "db-1", "db-0", "db-2"]);
  });

  it("source changes apply; app-side payment and kit edits are kept", () => {
    const existing = asExisting(csv, [
      { kit_given: true },
      {},
      { amount_paid: 85, amount_owed: 0, payment_status: "paid" }, // marked paid by staff
    ]);
    const changed = csv.map((r) => ({ ...r }));
    changed[0].kit_size = "M";
    changed[1].parent_phone = "087 999 9999";
    changed[2].payment_status = "Pending";
    changed[2].total_amount = "90";
    const plan = planImport(changed, existing);
    expect(plan[0].classification).toBe("unchanged");
    expect(plan[0].protected_fields).toContain("kit_size");
    expect(plan[1].classification).toBe("updated");
    expect(plan[1].diff?.parent_phone).toBeTruthy();
    expect(plan[2].protected_fields).toEqual(expect.arrayContaining(["total_amount", "payment_status"]));
    expect(plan[2].diff?.payment_status).toBeUndefined();
  });

  it("changed DOB on a known name goes to review, not a silent new record", () => {
    const existing = asExisting(csv);
    const row = { ...csv[0], date_of_birth: "01/02/2017" };
    const [p] = planImport([row], existing);
    expect(p.classification).toBe("ambiguous");
    expect(p.candidate_ids).toEqual(["db-0"]);
  });

  it("rows without DOB or guardian contact go to review; missing names and in-file duplicates are rejected", () => {
    const plan = planImport([
      { child_first_name: "No", child_last_name: "Identity" },
      { child_first_name: "", child_last_name: "Blank" },
      csv[0], csv[0],
    ], []);
    expect(plan.map((p) => p.classification)).toEqual(["ambiguous", "rejected", "new", "rejected"]);
  });

  it("source participant IDs win over names", () => {
    const existing = asExisting(csv, [{ source_participant_id: "P-1" }]);
    const [p] = planImport([{ ...csv[0], child_first_name: "Aoife-Marie", source_participant_id: "P-1" }], existing);
    expect(p.synced_booking_id).toBe("db-0");
    expect(p.classification).toBe("updated");
  });
});
