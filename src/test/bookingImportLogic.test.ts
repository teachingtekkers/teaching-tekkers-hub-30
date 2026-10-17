import { describe, it, expect } from "vitest";
import { planImport, normaliseIncoming, participantKey, type ExistingRow } from "../../supabase/functions/_shared/booking-logic";

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
    expect(plan[2].protected_fields).toContain("total_amount");
    expect(plan[2].conflict).toBe(true);
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
      { child_first_name: "No", child_last_name: "Identity", total_amount: "85", amount_paid: "0" },
      { child_first_name: "", child_last_name: "Blank", total_amount: "85", amount_paid: "0" },
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

describe("order independence", () => {
  it("a different child with the same name is new regardless of row order", () => {
    const existing = asExisting([csv[0]]);
    const other = { child_first_name: "Aoife", child_last_name: "Testerson", date_of_birth: "01/02/2017", parent_email: "other@example.test", total_amount: "85", amount_paid: "0" };
    const a = planImport([csv[0], other], existing);
    const b = planImport([other, csv[0]], existing);
    expect(a.map((p) => p.classification)).toEqual(["unchanged", "new"]);
    expect(b.map((p) => p.classification)).toEqual(["new", "unchanged"]);
  });
  it("same name + same guardian with a different DOB goes to review", () => {
    const existing = asExisting([csv[0]]);
    const typo = { ...csv[0], date_of_birth: "02/01/2016" };
    expect(planImport([csv[0], typo], existing)[1].classification).toBe("ambiguous");
  });
});

describe("changed details", () => {
  const existing = () => asExisting([csv[0], csv[2]], [{}, { source_values: null }]);
  it("changed first name with same DOB + guardian goes to review", () => {
    const [p] = planImport([{ ...csv[0], child_first_name: "Aoibhe" }], existing());
    expect(p.classification).toBe("ambiguous");
    expect(p.candidate_ids).toEqual(["db-0"]);
  });
  it("changed phone with same email is a safe update", () => {
    const [p] = planImport([{ ...csv[0], parent_phone: "0861234567" }], existing());
    expect(p.classification).toBe("updated");
  });
  it("changed email can use unchanged normalized phone as identity proof", () => {
    const [p] = planImport([{ ...csv[0], parent_email: "new@example.test" }], existing());
    expect(p.classification).toBe("updated");
  });
  it("missing DOB goes to review, not a new duplicate", () => {
    const [p] = planImport([{ ...csv[0], date_of_birth: "" }], existing());
    expect(p.classification).toBe("ambiguous");
  });
  it("older rows: any payment difference is kept and flagged, whichever amount is larger", () => {
    const [, p] = planImport([csv[0], { ...csv[2], amount_paid: "85", payment_status: "Paid" }], existing());
    expect(p.conflict).toBe(true);
    expect(p.diff?.amount_paid).toBeUndefined();
  });
  it("staff part-payment and refund are kept when the source changes", () => {
    const ex = asExisting([csv[2]], [{ amount_paid: 40, amount_owed: 45, payment_status: "partial" }]);
    const [p] = planImport([{ ...csv[2], amount_paid: "0", total_amount: "80" }], ex);
    expect(p.conflict).toBe(true);
    expect(p.protected_fields).toContain("total_amount");
    expect(p.diff?.amount_paid).toBeUndefined();
    const ex2 = asExisting([csv[3]], [{ refund_amount: 85, payment_status: "refunded" }]);
    const r2 = planImport([{ ...csv[3], payment_type: "Card" }], ex2)[0];
    expect(r2.protected_fields).toContain("payment_type");
    expect(r2.diff?.refund_amount).toBeUndefined();
  });
  it("source payment change applies when staff never touched it", () => {
    const [p] = planImport([{ ...csv[0], amount_paid: "170" }], asExisting([csv[0]]));
    expect(p.diff?.amount_paid).toBeTruthy();
    expect(p.conflict).toBe(false);
  });
  it("families from guardian contact are estimates; source booking IDs are verified", () => {
    const plan = planImport([csv[0], { ...csv[1], source_booking_id: "B-9" }], []);
    expect(plan.map((p) => p.family_verified)).toEqual([false, true]);
  });
});

describe("settled differences", () => {
  it("an app edit is not re-flagged while the source value stays the same", () => {
    const ex = asExisting([csv[2]], [{ amount_paid: 40, amount_owed: 45, payment_status: "partial" }]);
    const [p] = planImport([csv[2]], ex);
    expect(p.classification).toBe("unchanged");
    expect(p.conflict).toBe(false);
  });
  it("twins (same DOB and parent, different names) in the same file are separate children", () => {
    const twin = { ...csv[0], child_first_name: "Aisling" };
    const plan = planImport([csv[0], twin], asExisting([csv[0]]));
    expect(plan.map((p) => p.classification)).toEqual(["unchanged", "new"]);
  });
});

import { computeOwed } from "../../supabase/functions/_shared/booking-logic";
// Semantics established from the real Portmarnock Halloween (95 rows) and Monasterevin (71 rows) exports:
// Total + Siblings Discount = €85 list price on every row, and every "Paid" row has Amount Paid = Total.
describe("computeOwed — evidence-backed cases", () => {
  it("2nd child €75 (list €85 − €10) unpaid owes €75, discount not taken twice", () => expect(computeOwed({ total: 75, paid: 0, refund: 0 })).toBe(75));
  it("3rd child €65 paid online €65 owes 0 (export: Status Paid, Amount Paid = Total)", () => expect(computeOwed({ total: 65, paid: 65, refund: 0 })).toBe(0));
  it("part payment €40 of €85 owes €45", () => expect(computeOwed({ total: 85, paid: 40, refund: 0 })).toBe(45));
});
describe("computeOwed — refunds and cancellations are not established, so never guessed", () => {
  // Partial refund on an active booking: total 85, paid 85, refund 20. If paid is gross, owed = 20 (85 − (85 − 20));
  // if paid is net or total is reduced, owed = 0. The exports contain no refunds, so the answer must be "unknown".
  it("partial refund on active booking is undetermined", () => expect(computeOwed({ total: 85, paid: 85, refund: 20 })).toBeNull());
  it("refund is never counted as a payment", () => expect(computeOwed({ total: 85, paid: 0, refund: 20 })).not.toBe(65));
  // Cancellation: whether the family owes nothing, keeps a fee, or is due money back depends on the provider's ledger.
  it("cancelled booking is undetermined", () => expect(computeOwed({ total: 85, paid: 0, refund: 0, cancelled: true })).toBeNull());
});

describe("confirmed duplicate bookings (Monasterevin Best family, source bookings 6757/6758/6759)", () => {
  const dylan = { child_first_name: "Dylan", child_last_name: "Dupe", date_of_birth: "18/11/2015", parent_email: "dupe@example.test", total_amount: "85", amount_paid: "0", payment_status: "Unpaid" };
  const brandon = { ...dylan, child_first_name: "Brandon", date_of_birth: "27/03/2019", total_amount: "75", sibling_discount: "10" };
  const file = ["6757", "6758", "6759"].flatMap((b) => [{ ...dylan, source_booking_id: b }, { ...brandon, source_booking_id: b }]);
  it("first import creates two participants and rejects the four repeats", () => {
    expect(planImport(file, []).map((p) => p.classification)).toEqual(["new", "new", "rejected", "rejected", "rejected", "rejected"]);
  });
  it("re-import against the retained records never recreates duplicates", () => {
    const plan = planImport(file, asExisting([dylan, brandon] as any));
    expect(plan.filter((p) => p.classification === "new")).toHaveLength(0);
    expect(plan.filter((p) => p.classification === "unchanged").map((p) => p.synced_booking_id)).toEqual(["db-0", "db-1"]);
  });
});
