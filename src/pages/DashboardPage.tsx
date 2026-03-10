import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tent, Users, Banknote, AlertTriangle, ArrowRight, CheckCircle, ClipboardCheck, DollarSign, UserCog, Calendar, Building2, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfWeek, endOfWeek } from "date-fns";

interface CampRow { id: string; name: string; club_name: string; venue: string; start_date: string; end_date: string; }
interface BookingRow { id: string; matched_camp_id: string | null; amount_paid: number | null; amount_owed: number | null; total_amount: number | null; sibling_discount: number | null; refund_amount: number | null; }

const CLUB_RATE = 15;

const DashboardPage = () => {
  const [camps, setCamps] = useState<CampRow[]>([]);
  const [todayCamps, setTodayCamps] = useState<CampRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Map<string, number>>(new Map());
  const [coachCounts, setCoachCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [clubInvoiceTotal, setClubInvoiceTotal] = useState(0);
  const [clubInvoicePaid, setClubInvoicePaid] = useState(0);
  const [weekPayroll, setWeekPayroll] = useState(0);

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const wsISO = format(weekStart, "yyyy-MM-dd");
  const weISO = format(weekEnd, "yyyy-MM-dd");

  useEffect(() => {
    (async () => {
      const [campsRes, bookingsRes, attendanceRes, coachRes, invoicesRes, rosterRes] = await Promise.all([
        supabase.from("camps").select("id, name, club_name, venue, start_date, end_date").order("start_date", { ascending: false }),
        supabase.from("synced_bookings").select("id, matched_camp_id, amount_paid, amount_owed, total_amount, sibling_discount, refund_amount"),
        supabase.from("attendance").select("camp_id, status").eq("date", today).eq("status", "present"),
        supabase.from("camp_coach_assignments").select("camp_id, coach_id"),
        supabase.from("club_invoices").select("total_amount, manual_amount, status"),
        supabase.from("weekly_rosters").select("assignments, status").eq("week_start", wsISO).eq("status", "finalised").maybeSingle(),
      ]);

      const allCamps = (campsRes.data || []) as CampRow[];
      setCamps(allCamps);
      setTodayCamps(allCamps.filter((c) => c.start_date <= today && c.end_date >= today));
      setBookings((bookingsRes.data || []) as BookingRow[]);

      const aMap = new Map<string, number>();
      for (const r of (attendanceRes.data || []) as any[]) {
        aMap.set(r.camp_id, (aMap.get(r.camp_id) || 0) + 1);
      }
      setAttendanceCounts(aMap);

      const cMap = new Map<string, number>();
      for (const r of (coachRes.data || []) as any[]) {
        cMap.set(r.camp_id, (cMap.get(r.camp_id) || 0) + 1);
      }
      setCoachCounts(cMap);

      // Club invoices totals
      const invoices = (invoicesRes.data || []) as any[];
      setClubInvoiceTotal(invoices.reduce((s: number, i: any) => s + (i.manual_amount ?? i.total_amount ?? 0), 0));
      setClubInvoicePaid(invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.manual_amount ?? i.total_amount ?? 0), 0));

      // Estimated payroll from finalised roster
      if (rosterRes.data?.assignments) {
        // Simple estimate: count total coach-days × average rate (we don't have rates here, so just count)
        // Better: fetch coaches for rates
        const assignments = rosterRes.data.assignments as any[];
        const coachDays = assignments.reduce((s: number, a: any) => s + (a.days?.length || 0), 0);
        // Fetch coach rates
        const coachIds = [...new Set(assignments.map((a: any) => a.coach_id))];
        if (coachIds.length > 0) {
          const { data: coaches } = await supabase.from("coaches").select("id, daily_rate, head_coach_daily_rate").in("id", coachIds);
          const rateMap = new Map((coaches || []).map((c: any) => [c.id, c]));
          let total = 0;
          for (const a of assignments) {
            const coach = rateMap.get(a.coach_id);
            if (!coach) continue;
            const rate = a.role === "head_coach" ? coach.head_coach_daily_rate : coach.daily_rate;
            total += rate * (a.days?.length || 0);
          }
          setWeekPayroll(total);
        }
      }

      setLoading(false);
    })();
  }, [today]);

  const metrics = useMemo(() => {
    const todayCampIds = new Set(todayCamps.map((c) => c.id));
    const todayBookings = bookings.filter((b) => b.matched_camp_id && todayCampIds.has(b.matched_camp_id));

    const totalChildren = todayBookings.length;
    const presentToday = Array.from(attendanceCounts.entries())
      .filter(([id]) => todayCampIds.has(id))
      .reduce((s, [, c]) => s + c, 0);

    const totalRevenue = todayBookings.reduce((s, b) => {
      return s + Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0));
    }, 0);
    const totalOutstanding = todayBookings.reduce((s, b) => {
      const owed = b.amount_owed ?? Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0) - (b.amount_paid ?? 0) - (b.refund_amount ?? 0));
      return s + Math.max(0, owed);
    }, 0);

    return { totalChildren, presentToday, totalRevenue, totalOutstanding };
  }, [todayCamps, bookings, attendanceCounts]);

  // Weekly summary
  const weekMetrics = useMemo(() => {
    const weekCamps = camps.filter((c) => c.start_date <= weISO && c.end_date >= wsISO);
    const weekCampIds = new Set(weekCamps.map((c) => c.id));
    const weekBookings = bookings.filter((b) => b.matched_camp_id && weekCampIds.has(b.matched_camp_id));

    const totalRevenue = weekBookings.reduce((s, b) => s + Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0)), 0);
    const totalPaid = weekBookings.reduce((s, b) => s + (b.amount_paid ?? 0), 0);

    // Club payments due for this week's camps based on attendance
    const weekPresent = Array.from(attendanceCounts.entries())
      .filter(([id]) => weekCampIds.has(id))
      .reduce((s, [, c]) => s + c, 0);
    const clubPaymentsDue = weekPresent * CLUB_RATE;

    return {
      weekLabel: `${weekStart.toLocaleDateString("en-IE", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}`,
      campCount: weekCamps.length,
      childrenCount: weekBookings.length,
      totalRevenue,
      totalPaid,
      clubPaymentsDue,
    };
  }, [camps, bookings, attendanceCounts]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Week of {weekMetrics.weekLabel}</p>
      </div>

      <div className="stat-grid">
        <StatCard title="Active Camps Today" value={todayCamps.length} icon={Tent} description={`${weekMetrics.campCount} this week`} />
        <StatCard title="Children Today" value={metrics.totalChildren} icon={Users} description={`${metrics.presentToday} present`} />
        <StatCard title="Revenue (Week)" value={`€${weekMetrics.totalRevenue.toLocaleString()}`} icon={Banknote} description={`€${weekMetrics.totalPaid.toLocaleString()} paid`} />
        <StatCard
          title="Outstanding"
          value={`€${metrics.totalOutstanding.toLocaleString()}`}
          icon={AlertTriangle}
          variant={metrics.totalOutstanding > 0 ? "warning" : "success"}
          description="Across today's camps"
        />
        <StatCard title="Club Payments Due" value={`€${clubInvoiceTotal.toLocaleString()}`} icon={Building2} description={`€${clubInvoicePaid.toLocaleString()} paid`} />
        <StatCard title="Est. Staff Payroll" value={`€${weekPayroll.toLocaleString()}`} icon={Wallet} description="This week (finalised roster)" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label !mb-0">Today's Camps</p>
            <Link to="/control-centre" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              Control Centre <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Camp</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead className="text-center">Children</TableHead>
                    <TableHead className="text-center">Present</TableHead>
                    <TableHead className="text-center">Coaches</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayCamps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No camps running today.</TableCell>
                    </TableRow>
                  ) : (
                    todayCamps.map((camp) => {
                      const children = bookings.filter((b) => b.matched_camp_id === camp.id).length;
                      const present = attendanceCounts.get(camp.id) || 0;
                      const coaches = coachCounts.get(camp.id) || 0;
                      return (
                        <TableRow key={camp.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{camp.name}</p>
                            <p className="text-xs text-muted-foreground">{camp.venue}</p>
                          </TableCell>
                          <TableCell className="text-sm">{camp.club_name}</TableCell>
                          <TableCell className="text-center text-sm font-medium">{children}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={present > 0 ? "default" : "secondary"} className="text-xs gap-1">
                              <CheckCircle className="h-3 w-3" />{present}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-sm">{coaches}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div>
            <p className="section-label">Quick Actions</p>
            <div className="space-y-2">
              {[
                { label: "Control Centre", to: "/control-centre", icon: ClipboardCheck, desc: "Weekly overview" },
                { label: "Attendance", to: "/admin-attendance", icon: Calendar, desc: "Mark attendance" },
                { label: "Manage Roster", to: "/roster", icon: UserCog, desc: "Coach assignments" },
                { label: "View Payroll", to: "/payroll", icon: DollarSign, desc: "This week's payroll" },
                { label: "Club Payments", to: "/invoices", icon: Building2, desc: "Manage club payments" },
                { label: "Manage Camps", to: "/camps", icon: Tent, desc: "All camps" },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors group"
                >
                  <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <link.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{link.label}</p>
                    <p className="text-xs text-muted-foreground">{link.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="section-label">Weekly Summary</p>
            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Camps</span><span className="font-medium">{weekMetrics.campCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Children</span><span className="font-medium">{weekMetrics.childrenCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><span className="font-medium">€{weekMetrics.totalRevenue.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Collected</span><span className="font-medium text-emerald-600">€{weekMetrics.totalPaid.toLocaleString()}</span></div>
                <div className="border-t pt-2 mt-1 flex justify-between"><span className="text-muted-foreground">Club Payments Due</span><span className="font-medium">€{weekMetrics.clubPaymentsDue.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Est. Payroll</span><span className="font-medium">€{weekPayroll.toLocaleString()}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
