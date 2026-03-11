import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Banknote, CreditCard, Wallet, Building2, Users, TrendingUp } from "lucide-react";

interface Props {
  campId: string;
  campName: string;
  clubName: string;
}

interface BookingFinance {
  total_amount: number | null;
  sibling_discount: number | null;
  amount_paid: number | null;
  amount_owed: number | null;
  refund_amount: number | null;
  payment_type: string | null;
}

interface RosterAssignment {
  coach_id: string;
  camp_id: string;
  role: string;
  days: string[];
}

interface CoachRate {
  id: string;
  full_name: string;
  daily_rate: number;
  head_coach_daily_rate: number;
}

function calcTotalCost(b: BookingFinance): number {
  return Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0));
}

function calcOwed(b: BookingFinance): number {
  const owed = b.amount_owed ?? Math.max(0, calcTotalCost(b) - (b.amount_paid ?? 0) - (b.refund_amount ?? 0));
  return Math.max(0, owed);
}

const fmt = (n: number) => `€${n.toLocaleString("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function CampFinancialOverview({ campId, campName, clubName }: Props) {
  const [bookings, setBookings] = useState<BookingFinance[]>([]);
  const [attendedCount, setAttendedCount] = useState(0);
  const [clubRate, setClubRate] = useState(15);
  const [payrollLines, setPayrollLines] = useState<{ name: string; days: number; rate: number; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      // Fetch bookings, attendance (unique attendees), roster, and club invoice in parallel
      const [bookingsRes, attendanceRes, rosterRes, invoiceRes] = await Promise.all([
        supabase.from("synced_bookings")
          .select("total_amount, sibling_discount, amount_paid, amount_owed, refund_amount, payment_type")
          .eq("matched_camp_id", campId),
        supabase.from("attendance")
          .select("synced_booking_id")
          .eq("camp_id", campId)
          .eq("status", "present"),
        supabase.from("weekly_rosters")
          .select("assignments, status"),
        supabase.from("club_invoices")
          .select("rate_per_child")
          .eq("camp_id", campId)
          .limit(1),
      ]);

      setBookings((bookingsRes.data || []) as BookingFinance[]);

      // Unique attendees
      const uniqueAttendees = new Set((attendanceRes.data || []).map((a: any) => a.synced_booking_id).filter(Boolean));
      setAttendedCount(uniqueAttendees.size);

      // Club rate from invoice or default
      if (invoiceRes.data && invoiceRes.data.length > 0) {
        setClubRate((invoiceRes.data[0] as any).rate_per_child || 15);
      }

      // Payroll from roster assignments for this camp
      const allRosters = (rosterRes.data || []) as any[];
      const campAssignments: RosterAssignment[] = [];
      for (const roster of allRosters) {
        if (roster.status !== "finalised") continue;
        const assignments = (roster.assignments || []) as RosterAssignment[];
        for (const a of assignments) {
          if (a.camp_id === campId) campAssignments.push(a);
        }
      }

      if (campAssignments.length > 0) {
        const coachIds = [...new Set(campAssignments.map(a => a.coach_id))];
        const { data: coaches } = await supabase.from("coaches")
          .select("id, full_name, daily_rate, head_coach_daily_rate")
          .in("id", coachIds);

        const coachMap = new Map((coaches || []).map((c: any) => [c.id, c as CoachRate]));
        const lines: { name: string; days: number; rate: number; total: number }[] = [];

        for (const a of campAssignments) {
          const coach = coachMap.get(a.coach_id);
          if (!coach) continue;
          const days = a.days?.length || 0;
          const rate = a.role === "head_coach" ? coach.head_coach_daily_rate : coach.daily_rate;
          lines.push({ name: coach.full_name, days, rate, total: days * rate });
        }
        setPayrollLines(lines);
      }

      setLoading(false);
    })();
  }, [campId]);

  if (loading) return <div className="text-sm text-muted-foreground py-4">Loading financial overview…</div>;

  const totalRevenue = bookings.reduce((s, b) => s + calcTotalCost(b), 0);
  const totalPaid = bookings.reduce((s, b) => s + (b.amount_paid ?? 0), 0);
  const totalOutstanding = bookings.reduce((s, b) => s + calcOwed(b), 0);

  const onlineTotal = bookings
    .filter(b => {
      const pt = (b.payment_type || "").toLowerCase();
      return pt.includes("online") || pt.includes("card") || pt.includes("stripe");
    })
    .reduce((s, b) => s + (b.amount_paid ?? 0), 0);
  const cashTotal = bookings
    .filter(b => (b.payment_type || "").toLowerCase().includes("cash"))
    .reduce((s, b) => s + (b.amount_paid ?? 0), 0);

  const clubPaymentDue = attendedCount * clubRate;
  const totalPayroll = payrollLines.reduce((s, l) => s + l.total, 0);
  const estimatedNet = totalRevenue - clubPaymentDue - totalPayroll;

  return (
    <div className="space-y-4">
      {/* Revenue + Payment summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Users className="h-4 w-4" />} label="Booked" value={String(bookings.length)} sub={`${attendedCount} attended`} />
        <MetricCard icon={<Banknote className="h-4 w-4" />} label="Total Revenue" value={fmt(totalRevenue)} sub={`${fmt(totalPaid)} paid`} />
        <MetricCard icon={<Wallet className="h-4 w-4" />} label="Outstanding" value={fmt(totalOutstanding)} color={totalOutstanding > 0 ? "text-amber-600" : "text-emerald-600"} />
        <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Est. Net Revenue" value={fmt(estimatedNet)} color={estimatedNet >= 0 ? "text-emerald-600" : "text-destructive"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Payment Breakdown */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Breakdown</span>
            </div>
            <div className="space-y-2">
              <Row label="Online / Card" value={fmt(onlineTotal)} icon={<CreditCard className="h-3 w-3" />} />
              <Row label="Cash" value={fmt(cashTotal)} icon={<Wallet className="h-3 w-3" />} />
              {totalPaid - onlineTotal - cashTotal > 0 && (
                <Row label="Other" value={fmt(totalPaid - onlineTotal - cashTotal)} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Club Payment */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Club Payment</span>
            </div>
            <div className="space-y-2">
              <Row label="Attended" value={String(attendedCount)} />
              <Row label={`Rate per child`} value={fmt(clubRate)} />
              <div className="border-t pt-2">
                <Row label="Club Payment Due" value={fmt(clubPaymentDue)} bold />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Staff Payroll */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Staff Payroll Estimate</span>
            </div>
            {payrollLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roster data available</p>
            ) : (
              <div className="space-y-1.5">
                {payrollLines.map((l, i) => (
                  <Row key={i} label={`${l.name} (${l.days}d × ${fmt(l.rate)})`} value={fmt(l.total)} />
                ))}
                <div className="border-t pt-2">
                  <Row label="Total Payroll" value={fmt(totalPayroll)} bold />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          {icon}
          {label}
        </div>
        <p className={`text-xl font-bold ${color || "text-foreground"}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold, icon }: { label: string; value: string; bold?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={`flex items-center gap-1.5 ${bold ? "font-medium text-foreground" : "text-muted-foreground"}`}>
        {icon}
        {label}
      </span>
      <span className={`font-semibold text-foreground`}>{value}</span>
    </div>
  );
}
