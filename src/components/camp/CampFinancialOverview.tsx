import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Banknote, CreditCard, Wallet, Building2, Users, TrendingUp, Pencil } from "lucide-react";
import { toast } from "sonner";

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

interface Overrides {
  override_revenue: number | null;
  override_club_payment: number | null;
  override_payroll: number | null;
  override_club_rate: number | null;
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
  const [overrides, setOverrides] = useState<Overrides>({
    override_revenue: null,
    override_club_payment: null,
    override_payroll: null,
    override_club_rate: null,
  });
  const [hasOverrideRow, setHasOverrideRow] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const [bookingsRes, attendanceRes, rosterRes, invoiceRes, overridesRes] = await Promise.all([
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
        supabase.from("camp_financial_overrides" as any)
          .select("override_revenue, override_club_payment, override_payroll, override_club_rate")
          .eq("camp_id", campId)
          .maybeSingle(),
      ]);

      setBookings((bookingsRes.data || []) as BookingFinance[]);

      const uniqueAttendees = new Set((attendanceRes.data || []).map((a: any) => a.synced_booking_id).filter(Boolean));
      setAttendedCount(uniqueAttendees.size);

      if (invoiceRes.data && invoiceRes.data.length > 0) {
        setClubRate((invoiceRes.data[0] as any).rate_per_child || 15);
      }

      // Load overrides
      if (overridesRes.data) {
        const o = overridesRes.data as any;
        setOverrides({
          override_revenue: o.override_revenue,
          override_club_payment: o.override_club_payment,
          override_payroll: o.override_payroll,
          override_club_rate: o.override_club_rate,
        });
        setHasOverrideRow(true);
      }

      // Payroll from roster
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

  const saveOverride = useCallback(async (field: keyof Overrides, value: number | null) => {
    const newOverrides = { ...overrides, [field]: value };
    setOverrides(newOverrides);

    const payload = {
      camp_id: campId,
      ...newOverrides,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (hasOverrideRow) {
      const res = await supabase.from("camp_financial_overrides" as any).update(payload).eq("camp_id", campId);
      error = res.error;
    } else {
      const res = await supabase.from("camp_financial_overrides" as any).insert(payload);
      error = res.error;
      if (!error) setHasOverrideRow(true);
    }

    if (error) {
      toast.error("Failed to save override");
    } else {
      toast.success("Override saved");
    }
  }, [campId, overrides, hasOverrideRow]);

  if (loading) return <div className="text-sm text-muted-foreground py-4">Loading financial overview…</div>;

  // Calculated values
  const calcRevenue = bookings.reduce((s, b) => s + calcTotalCost(b), 0);
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

  const calcPayroll = payrollLines.reduce((s, l) => s + l.total, 0);
  const effectiveClubRate = overrides.override_club_rate ?? clubRate;
  const calcClubPayment = attendedCount * effectiveClubRate;

  // Effective values (override takes priority)
  const effectiveRevenue = overrides.override_revenue ?? calcRevenue;
  const effectiveClubPayment = overrides.override_club_payment ?? calcClubPayment;
  const effectivePayroll = overrides.override_payroll ?? calcPayroll;
  const estimatedNet = effectiveRevenue - effectiveClubPayment - effectivePayroll;

  return (
    <div className="space-y-4">
      {/* Revenue + Payment summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Users className="h-4 w-4" />} label="Booked" value={String(bookings.length)} sub={`${attendedCount} attended`} />
        <OverridableMetricCard
          icon={<Banknote className="h-4 w-4" />}
          label="Total Revenue"
          calculatedValue={calcRevenue}
          overrideValue={overrides.override_revenue}
          onOverride={(v) => saveOverride("override_revenue", v)}
          sub={`${fmt(totalPaid)} paid`}
        />
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
              <OverrideRow
                label="Rate per child"
                calculatedValue={clubRate}
                overrideValue={overrides.override_club_rate}
                onOverride={(v) => saveOverride("override_club_rate", v)}
                prefix="€"
              />
              <div className="border-t pt-2">
                <OverrideRow
                  label="Club Payment Due"
                  calculatedValue={calcClubPayment}
                  overrideValue={overrides.override_club_payment}
                  onOverride={(v) => saveOverride("override_club_payment", v)}
                  prefix="€"
                  bold
                />
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
            {payrollLines.length === 0 && overrides.override_payroll == null ? (
              <p className="text-sm text-muted-foreground">No roster data available</p>
            ) : (
              <div className="space-y-1.5">
                {payrollLines.map((l, i) => (
                  <Row key={i} label={`${l.name} (${l.days}d × ${fmt(l.rate)})`} value={fmt(l.total)} />
                ))}
                <div className="border-t pt-2">
                  <OverrideRow
                    label="Total Payroll"
                    calculatedValue={calcPayroll}
                    overrideValue={overrides.override_payroll}
                    onOverride={(v) => saveOverride("override_payroll", v)}
                    prefix="€"
                    bold
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Override indicator */}
      {(overrides.override_revenue != null || overrides.override_club_payment != null || overrides.override_payroll != null || overrides.override_club_rate != null) && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Pencil className="h-3 w-3" />
          Manual overrides are active. Clear the override field to revert to automatic calculations.
        </p>
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

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

function OverridableMetricCard({
  icon, label, calculatedValue, overrideValue, onOverride, sub
}: {
  icon: React.ReactNode; label: string; calculatedValue: number; overrideValue: number | null;
  onOverride: (v: number | null) => void; sub?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(overrideValue != null ? String(overrideValue) : "");
  const isOverridden = overrideValue != null;
  const displayValue = overrideValue ?? calculatedValue;

  const commit = () => {
    setEditing(false);
    const num = draft === "" ? null : Number(draft);
    if (num !== overrideValue) onOverride(isNaN(num as number) ? null : num);
  };

  return (
    <Card className={isOverridden ? "ring-1 ring-primary/30" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          {icon}
          {label}
          {isOverridden && <Badge variant="outline" className="text-[10px] ml-1 px-1 py-0">Override</Badge>}
        </div>
        {editing ? (
          <Input
            type="number"
            className="h-8 w-full font-mono text-lg font-bold"
            value={draft}
            autoFocus
            placeholder={String(calculatedValue)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && commit()}
          />
        ) : (
          <p
            className="text-xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors group flex items-center gap-1"
            onClick={() => { setDraft(overrideValue != null ? String(overrideValue) : ""); setEditing(true); }}
          >
            {fmt(displayValue)}
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
          </p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        {isOverridden && <p className="text-[10px] text-muted-foreground">Calculated: {fmt(calculatedValue)}</p>}
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
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function OverrideRow({
  label, calculatedValue, overrideValue, onOverride, prefix = "", bold
}: {
  label: string; calculatedValue: number; overrideValue: number | null;
  onOverride: (v: number | null) => void; prefix?: string; bold?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(overrideValue != null ? String(overrideValue) : "");
  const isOverridden = overrideValue != null;
  const displayValue = overrideValue ?? calculatedValue;

  const commit = () => {
    setEditing(false);
    const num = draft === "" ? null : Number(draft);
    if (num !== overrideValue) onOverride(isNaN(num as number) ? null : num);
  };

  return (
    <div className="flex items-center justify-between text-sm">
      <span className={`flex items-center gap-1.5 ${bold ? "font-medium text-foreground" : "text-muted-foreground"}`}>
        {label}
        {isOverridden && <Badge variant="outline" className="text-[9px] px-1 py-0">Override</Badge>}
      </span>
      {editing ? (
        <Input
          type="number"
          className="h-6 w-24 text-right font-mono text-sm font-semibold"
          value={draft}
          autoFocus
          placeholder={String(calculatedValue)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
      ) : (
        <span
          className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors group flex items-center gap-1"
          onClick={() => { setDraft(overrideValue != null ? String(overrideValue) : ""); setEditing(true); }}
        >
          {prefix}{displayValue.toLocaleString("en-IE")}
          <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
        </span>
      )}
    </div>
  );
}
