/**
 * Single display rule for a child's balance. Never changes stored values.
 * - Source "Total Amount" is already after sibling discount: owed = total − paid.
 * - Refund or cancellation semantics are not established from source evidence,
 *   so those rows are "Needs review" — never coerced to €0 and never counted
 *   as a payment or discount.
 */
export interface BalanceInput {
  total_amount?: number | null;
  amount_paid?: number | null;
  amount_owed?: number | null;
  refund_amount?: number | null;
  booking_status?: string | null;
  payment_status?: string | null;
}

export type Balance =
  | { kind: "owed"; amount: number }
  | { kind: "review"; reason: "refund" | "cancelled" };

export function getBalance(b: BalanceInput): Balance {
  if ((Number(b.refund_amount) || 0) > 0) return { kind: "review", reason: "refund" };
  if (/cancel/i.test(b.booking_status || "")) return { kind: "review", reason: "cancelled" };
  if (b.amount_owed !== null && b.amount_owed !== undefined) return { kind: "owed", amount: Math.max(0, Number(b.amount_owed)) };
  return { kind: "owed", amount: Math.max(0, (Number(b.total_amount) || 0) - (Number(b.amount_paid) || 0)) };
}

/** Owed amount for determinable rows, or null when the row needs review. */
export function owedOrNull(b: BalanceInput): number | null {
  const r = getBalance(b);
  return r.kind === "owed" ? r.amount : null;
}

export interface OutstandingSummary { total: number; excluded: number }

/** Sum of determinable balances plus the count of rows left out because they need review. */
export function sumOutstanding(rows: BalanceInput[]): OutstandingSummary {
  let total = 0, excluded = 0;
  for (const r of rows) {
    const o = owedOrNull(r);
    if (o === null) excluded++; else total += o;
  }
  return { total, excluded };
}

export const REVIEW_LABEL = "Needs review";

export function balanceLabel(b: BalanceInput): string {
  const o = owedOrNull(b);
  return o === null ? REVIEW_LABEL : `€${o.toFixed(2)}`;
}

export function excludedNote(excluded: number): string {
  return excluded > 0 ? `excludes ${excluded} needing review (refund/cancelled)` : "";
}
