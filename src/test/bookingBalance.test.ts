import { describe, it, expect } from "vitest";
import { getBalance, owedOrNull, sumOutstanding, balanceLabel } from "@/lib/bookingBalance";

describe("display balance rule", () => {
  it("unpaid sibling owes discounted total (discount not taken twice)", () =>
    expect(owedOrNull({ total_amount: 75, amount_paid: 0, amount_owed: null })).toBe(75));
  it("stored balance is shown as stored, never recomputed", () =>
    expect(owedOrNull({ total_amount: 85, amount_paid: 0, amount_owed: 65 })).toBe(65));
  it("refund row is Needs review even if a stored balance of 0 exists", () => {
    expect(getBalance({ total_amount: 85, amount_paid: 85, refund_amount: 20, amount_owed: 0 })).toEqual({ kind: "review", reason: "refund" });
    expect(balanceLabel({ total_amount: 85, amount_paid: 85, refund_amount: 20, amount_owed: 0 })).toBe("Needs review");
  });
  it("refund is never treated as a payment (old formula gave 65)", () =>
    expect(owedOrNull({ total_amount: 85, amount_paid: 0, refund_amount: 20, amount_owed: null })).toBeNull());
  it("cancelled row is Needs review, not €0", () =>
    expect(owedOrNull({ total_amount: 85, amount_paid: 0, booking_status: "Cancelled", amount_owed: 0 })).toBeNull());
  it("totals exclude and disclose unresolved rows", () => {
    expect(sumOutstanding([
      { total_amount: 85, amount_paid: 0, amount_owed: null },
      { total_amount: 85, amount_paid: 40, amount_owed: 45 },
      { total_amount: 85, amount_paid: 85, refund_amount: 20 },
      { total_amount: 85, booking_status: "cancelled" },
    ])).toEqual({ total: 130, excluded: 2 });
  });
});
