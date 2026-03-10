import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banknote, CreditCard, Wallet, Building2 } from "lucide-react";
import type { ParticipantData } from "./AttendanceParticipantRow";

function calcTotalCost(p: ParticipantData): number {
  return Math.max(0, (p.total_amount ?? 0) - (p.sibling_discount ?? 0));
}

interface Props {
  participants: ParticipantData[];
  clubPaymentRate?: number;
}

export default function AttendanceFinancialSummary({ participants, clubPaymentRate = 15 }: Props) {
  if (participants.length === 0) return null;

  const totalRevenue = participants.reduce((s, p) => s + calcTotalCost(p), 0);
  const totalPaid = participants.reduce((s, p) => s + (p.amount_paid ?? 0), 0);
  const totalOutstanding = participants.reduce((s, p) => {
    const owed = p.amount_owed ?? Math.max(0, calcTotalCost(p) - (p.amount_paid ?? 0) - (p.refund_amount ?? 0));
    return s + Math.max(0, owed);
  }, 0);

  const onlineTotal = participants
    .filter((p) => p.payment_type?.toLowerCase().includes("online") || p.payment_type?.toLowerCase().includes("card") || p.payment_type?.toLowerCase().includes("stripe"))
    .reduce((s, p) => s + (p.amount_paid ?? 0), 0);
  const cashTotal = participants
    .filter((p) => p.payment_type?.toLowerCase().includes("cash"))
    .reduce((s, p) => s + (p.amount_paid ?? 0), 0);
  const otherTotal = totalPaid - onlineTotal - cashTotal;

  const clubShare = participants.length * clubPaymentRate;

  const fmt = (n: number) => `€${n.toLocaleString("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue Summary</span>
          </div>
          <div className="space-y-2">
            <Row label="Total Revenue" value={fmt(totalRevenue)} bold />
            <Row label="Amount Paid" value={fmt(totalPaid)} color="text-emerald-600" />
            <Row label="Outstanding" value={fmt(totalOutstanding)} color={totalOutstanding > 0 ? "text-amber-600" : "text-emerald-600"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Breakdown</span>
          </div>
          <div className="space-y-2">
            <Row label="Online / Card" value={fmt(onlineTotal)} icon={<CreditCard className="h-3 w-3" />} />
            <Row label="Cash" value={fmt(cashTotal)} icon={<Wallet className="h-3 w-3" />} />
            {otherTotal > 0 && <Row label="Other" value={fmt(otherTotal)} />}
          </div>
          <div className="border-t pt-2 mt-2">
            <Row label={`Club Share (${participants.length} × €${clubPaymentRate})`} value={fmt(clubShare)} icon={<Building2 className="h-3 w-3" />} bold />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, bold, color, icon }: { label: string; value: string; bold?: boolean; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={`flex items-center gap-1.5 ${bold ? "font-medium text-foreground" : "text-muted-foreground"}`}>
        {icon}
        {label}
      </span>
      <span className={`font-semibold ${color || "text-foreground"}`}>{value}</span>
    </div>
  );
}
