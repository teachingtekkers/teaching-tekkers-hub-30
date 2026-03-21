import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tent, Users, Banknote, AlertTriangle, ArrowRight, CheckCircle, ClipboardCheck, DollarSign, UserCog, Calendar, Building2, Wallet, CloudDownload, FileText, ChevronLeft, ChevronRight, CalendarIcon, MapPin, AlertCircle, BookOpen } from "lucide-react";
import { DashboardTasksPanel } from "@/components/dashboard/DashboardTasksPanel";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isWithinInterval, isSameWeek } from "date-fns";
import { cn } from "@/lib/utils";

interface CampRow { id: string; name: string; club_name: string; venue: string; start_date: string; end_date: string; }
interface BookingRow { id: string; matched_camp_id: string | null; amount_paid: number | null; amount_owed: number | null; total_amount: number | null; sibling_discount: number | null; refund_amount: number | null; payment_status: string | null; }

const CLUB_RATE = 15;

const DashboardPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [camps, setCamps] = useState<CampRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Map<string, number>>(new Map());
  const [coachCounts, setCoachCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [clubInvoices, setClubInvoices] = useState<any[]>([]);
  const [weekPayroll, setWeekPayroll] = useState(0);
  const [syncErrors, setSyncErrors] = useState(0);
  const [rosterStatus, setRosterStatus] = useState<string | null>(null);
  const [coachAssignments, setCoachAssignments] = useState<any[]>([]);
  const [itineraries, setItineraries] = useState<any[]>([]);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const wsISO = format(weekStart, "yyyy-MM-dd");
  const weISO = format(weekEnd, "yyyy-MM-dd");
  const isCurrentWeek = isSameWeek(selectedDate, new Date(), { weekStartsOn: 1 });
  const today = new Date().toISOString().slice(0, 10);

  const handlePrevWeek = useCallback(() => setSelectedDate(d => subWeeks(d, 1)), []);
  const handleNextWeek = useCallback(() => setSelectedDate(d => addWeeks(d, 1)), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [campsRes, bookingsRes, coachAssignRes, invoicesRes, rosterRes, errorsRes, itinRes] = await Promise.all([
        supabase.from("camps").select("id, name, club_name, venue, start_date, end_date").order("start_date", { ascending: false }),
        supabase.from("synced_bookings").select("id, matched_camp_id, amount_paid, amount_owed, total_amount, sibling_discount, refund_amount, payment_status"),
        supabase.from("camp_coach_assignments").select("camp_id, coach_id"),
        supabase.from("club_invoices").select("camp_id, total_amount, manual_amount, status"),
        supabase.from("weekly_rosters").select("assignments, status").eq("week_start", wsISO).maybeSingle(),
        supabase.from("import_errors").select("id", { count: "exact", head: true }),
        supabase.from("itineraries").select("id, linked_camp_id"),
      ]);

      const allCamps = (campsRes.data || []) as CampRow[];
      setCamps(allCamps);
      setBookings((bookingsRes.data || []) as BookingRow[]);
      setCoachAssignments(coachAssignRes.data || []);
      setClubInvoices(invoicesRes.data || []);
      setSyncErrors(errorsRes.count || 0);
      setRosterStatus(rosterRes.data?.status || null);
      setItineraries(itinRes.data || []);

      // Attendance for the week
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("camp_id, status, date")
        .gte("date", wsISO)
        .lte("date", weISO)
        .eq("status", "present");

      const aMap = new Map<string, number>();
      for (const r of (attendanceData || []) as any[]) {
        aMap.set(r.camp_id, (aMap.get(r.camp_id) || 0) + 1);
      }
      setAttendanceCounts(aMap);

      const cMap = new Map<string, number>();
      for (const r of (coachAssignRes.data || []) as any[]) {
        cMap.set(r.camp_id, (cMap.get(r.camp_id) || 0) + 1);
      }
      setCoachCounts(cMap);

      // Payroll from roster
      if (rosterRes.data?.assignments && rosterRes.data.status === "finalised") {
        const assignments = rosterRes.data.assignments as any[];
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
        } else {
          setWeekPayroll(0);
        }
      } else {
        setWeekPayroll(0);
      }

      setLoading(false);
    })();
  }, [wsISO, weISO]);

  // Week camps
  const weekCamps = useMemo(() =>
    camps.filter(c => c.start_date <= weISO && c.end_date >= wsISO),
    [camps, wsISO, weISO]
  );
  const weekCampIds = useMemo(() => new Set(weekCamps.map(c => c.id)), [weekCamps]);

  // Week bookings & metrics
  const weekMetrics = useMemo(() => {
    const weekBookings = bookings.filter(b => b.matched_camp_id && weekCampIds.has(b.matched_camp_id));
    const totalRevenue = weekBookings.reduce((s, b) => s + Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0)), 0);
    const totalPaid = weekBookings.reduce((s, b) => s + (b.amount_paid ?? 0), 0);
    const totalOutstanding = weekBookings.reduce((s, b) => {
      const owed = b.amount_owed ?? Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0) - (b.amount_paid ?? 0) - (b.refund_amount ?? 0));
      return s + Math.max(0, owed);
    }, 0);
    const unpaidCount = weekBookings.filter(b => {
      const st = b.payment_status?.toLowerCase();
      return st === "pending" || st === "partial";
    }).length;

    const weekPresent = Array.from(attendanceCounts.entries())
      .filter(([id]) => weekCampIds.has(id))
      .reduce((s, [, c]) => s + c, 0);
    const clubPaymentsDue = weekPresent * CLUB_RATE;

    return { childrenCount: weekBookings.length, totalRevenue, totalPaid, totalOutstanding, unpaidCount, clubPaymentsDue, weekPresent };
  }, [bookings, weekCampIds, attendanceCounts]);

  // Club invoices for this week's camps
  const weekInvoiceMetrics = useMemo(() => {
    const weekInvs = clubInvoices.filter((i: any) => weekCampIds.has(i.camp_id));
    const total = weekInvs.reduce((s: number, i: any) => s + (i.manual_amount ?? i.total_amount ?? 0), 0);
    const paid = weekInvs.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.manual_amount ?? i.total_amount ?? 0), 0);
    const draftCount = weekInvs.filter((i: any) => i.status === "draft").length;
    return { total, paid, draftCount };
  }, [clubInvoices, weekCampIds]);

  // System-generated workflow reminders
  const systemReminders = useMemo(() => {
    const items: { label: string; detail: string; to: string; variant: "warning" | "destructive" | "default"; icon: React.ElementType }[] = [];

    if (weekCamps.length === 0) return items;

    // Roster not finalised
    if (rosterStatus !== "finalised") {
      items.push({ label: "Roster not finalised", detail: `Week of ${format(weekStart, "d MMM")} — no finalised roster`, to: "/roster", variant: "warning", icon: UserCog });
    }

    // Camps without coach assignments
    const campsNoCoach = weekCamps.filter(c => !coachCounts.has(c.id));
    if (campsNoCoach.length > 0) {
      items.push({ label: "Coaches not assigned", detail: `${campsNoCoach.length} camp${campsNoCoach.length > 1 ? "s" : ""} without coaches`, to: "/camps", variant: "warning", icon: Users });
    }

    // Camps without attendance (only relevant for current/past weeks)
    if (weekEnd <= new Date() || isCurrentWeek) {
      const campsNoAttendance = weekCamps.filter(c => !attendanceCounts.has(c.id));
      if (campsNoAttendance.length > 0) {
        items.push({ label: "Attendance not completed", detail: `${campsNoAttendance.length} camp${campsNoAttendance.length > 1 ? "s" : ""} this week`, to: "/attendance", variant: "warning", icon: ClipboardCheck });
      }
    }

    // No club payments generated
    const campsWithInvoices = new Set(clubInvoices.filter((i: any) => weekCampIds.has(i.camp_id)).map((i: any) => i.camp_id));
    const campsNoInvoice = weekCamps.filter(c => !campsWithInvoices.has(c.id));
    if (campsNoInvoice.length > 0) {
      items.push({ label: "Club payments not generated", detail: `${campsNoInvoice.length} camp${campsNoInvoice.length > 1 ? "s" : ""} without invoices`, to: "/invoices", variant: "warning", icon: Building2 });
    }

    // Draft invoices
    if (weekInvoiceMetrics.draftCount > 0) {
      items.push({ label: "Draft club payments", detail: `${weekInvoiceMetrics.draftCount} invoice${weekInvoiceMetrics.draftCount > 1 ? "s" : ""} pending review`, to: "/invoices", variant: "warning", icon: FileText });
    }

    // Payroll not generated
    if (weekPayroll === 0) {
      items.push({ label: "Payroll not generated", detail: "No payroll calculated for this week", to: "/payroll", variant: "warning", icon: DollarSign });
    }

    // Unpaid bookings
    if (weekMetrics.unpaidCount > 0) {
      items.push({ label: "Unpaid bookings", detail: `${weekMetrics.unpaidCount} pending/partial`, to: "/players", variant: "destructive", icon: Banknote });
    }

    // Sync errors (global)
    if (syncErrors > 0) {
      items.push({ label: "Sync errors", detail: `${syncErrors} import error${syncErrors > 1 ? "s" : ""}`, to: "/booking-sync", variant: "destructive", icon: CloudDownload });
    }

    // Itineraries not created
    const campsWithItinerary = new Set((itineraries || []).filter((i: any) => i.linked_camp_id && weekCampIds.has(i.linked_camp_id)).map((i: any) => i.linked_camp_id));
    const campsNoItinerary = weekCamps.filter(c => !campsWithItinerary.has(c.id));
    if (campsNoItinerary.length > 0) {
      items.push({ label: "Itinerary not created", detail: `${campsNoItinerary.length} camp${campsNoItinerary.length > 1 ? "s" : ""} without itineraries`, to: "/itineraries", variant: "default", icon: BookOpen });
    }

    return items;
  }, [weekCamps, rosterStatus, coachCounts, attendanceCounts, clubInvoices, weekCampIds, weekInvoiceMetrics, weekPayroll, weekMetrics, syncErrors, itineraries, weekStart, weekEnd, isCurrentWeek]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const weekLabel = `${format(weekStart, "d MMM")} — ${format(weekEnd, "d MMM yyyy")}`;

  return (
    <div className="space-y-8">
      {/* Header with week selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="page-header !mb-0">
          <h1>Dashboard</h1>
          <p>Week of {weekLabel}{isCurrentWeek && <Badge variant="secondary" className="ml-2 text-[10px]">Current Week</Badge>}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevWeek}><ChevronLeft className="h-4 w-4" /></Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal text-sm")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarPicker mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={handleNextWeek}><ChevronRight className="h-4 w-4" /></Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())} className="text-xs">Today</Button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <StatCard title="Camps This Week" value={weekCamps.length} icon={Tent} />
        <StatCard title="Children Booked" value={weekMetrics.childrenCount} icon={Users} description={`${weekMetrics.weekPresent} attended`} />
        <StatCard title="Revenue (Week)" value={`€${weekMetrics.totalRevenue.toLocaleString()}`} icon={Banknote} description={`€${weekMetrics.totalPaid.toLocaleString()} paid`} />
        <StatCard
          title="Outstanding"
          value={`€${weekMetrics.totalOutstanding.toLocaleString()}`}
          icon={AlertTriangle}
          variant={weekMetrics.totalOutstanding > 0 ? "warning" : "success"}
        />
        <StatCard title="Club Payments" value={`€${weekInvoiceMetrics.total.toLocaleString()}`} icon={Building2} description={`€${weekInvoiceMetrics.paid.toLocaleString()} paid`} />
        <StatCard title="Est. Staff Payroll" value={`€${weekPayroll.toLocaleString()}`} icon={Wallet} description={rosterStatus === "finalised" ? "Finalised roster" : "No finalised roster"} />
      </div>

      {/* System reminders + Action Items */}
      {systemReminders.length > 0 && (
        <div>
          <p className="section-label">Action Required — Week of {format(weekStart, "d MMM")}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {systemReminders.map((item, i) => (
              <Link key={i} to={item.to} className="group">
                <Card className={`border-l-4 ${item.variant === "destructive" ? "border-l-destructive" : item.variant === "warning" ? "border-l-amber-500" : "border-l-primary"} hover:bg-accent/50 transition-colors`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.variant === "destructive" ? "bg-destructive/10" : item.variant === "warning" ? "bg-amber-500/10" : "bg-primary/10"}`}>
                      <item.icon className={`h-4 w-4 ${item.variant === "destructive" ? "text-destructive" : item.variant === "warning" ? "text-amber-600" : "text-primary"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tasks & Reminders */}
      <DashboardTasksPanel />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label !mb-0">Camps This Week</p>
            <Link to="/camps" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
              All Camps <ArrowRight className="h-3 w-3" />
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
                    <TableHead className="text-center">Attended</TableHead>
                    <TableHead className="text-center">Coaches</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekCamps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No camps running this week.</TableCell>
                    </TableRow>
                  ) : (
                    weekCamps.map((camp) => {
                      const children = bookings.filter(b => b.matched_camp_id === camp.id).length;
                      const present = attendanceCounts.get(camp.id) || 0;
                      const coaches = coachCounts.get(camp.id) || 0;
                      return (
                        <TableRow key={camp.id}>
                          <TableCell>
                            <Link to={`/camps/${camp.id}`} className="hover:underline">
                              <p className="font-medium text-sm">{camp.name}</p>
                              <p className="text-xs text-muted-foreground">{camp.venue}</p>
                            </Link>
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
                { label: "Attendance", to: "/attendance", icon: ClipboardCheck, desc: "Mark attendance" },
                { label: "Manage Roster", to: "/roster", icon: UserCog, desc: "Coach assignments" },
                { label: "View Payroll", to: "/payroll", icon: DollarSign, desc: "This week's payroll" },
                { label: "Club Payments", to: "/invoices", icon: Building2, desc: "Manage club payments" },
                { label: "Booking Sync", to: "/booking-sync", icon: CloudDownload, desc: syncErrors > 0 ? `${syncErrors} errors` : "Import bookings" },
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
                <div className="flex justify-between"><span className="text-muted-foreground">Camps</span><span className="font-medium">{weekCamps.length}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Children</span><span className="font-medium">{weekMetrics.childrenCount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><span className="font-medium">€{weekMetrics.totalRevenue.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Collected</span><span className="font-medium text-[hsl(var(--success))]">€{weekMetrics.totalPaid.toLocaleString()}</span></div>
                <div className="border-t pt-2 mt-1 flex justify-between"><span className="text-muted-foreground">Club Payments Due</span><span className="font-medium">€{weekMetrics.clubPaymentsDue.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Est. Payroll</span><span className="font-medium">€{weekPayroll.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Roster Status</span>
                  <Badge variant={rosterStatus === "finalised" ? "default" : "secondary"} className="text-[10px]">
                    {rosterStatus === "finalised" ? "Finalised" : "Not Finalised"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
