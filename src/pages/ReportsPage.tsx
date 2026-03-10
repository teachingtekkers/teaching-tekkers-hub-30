import { useState, useEffect, useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown, Minus, Tent, Users, Receipt, Wallet, Building2, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface CampRow { id: string; name: string; club_name: string; county: string; start_date: string; end_date: string; price_per_child: number; }
interface BookingRow { id: string; matched_camp_id: string | null; total_amount: number | null; amount_paid: number | null; sibling_discount: number | null; }
interface AttendanceRow { camp_id: string; status: string; }
interface InvoiceRow { camp_id: string; total_amount: number; manual_amount: number | null; status: string; }
interface PayrollRow { camp_id: string; total_amount: number; }

type SeasonKey = "easter" | "summer" | "halloween" | "other";

function getSeason(startDate: string): SeasonKey {
  const month = parseInt(startDate.substring(5, 7), 10);
  const day = parseInt(startDate.substring(8, 10), 10);
  if (month >= 3 && month <= 4) return "easter";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 10 && month <= 11) return "halloween";
  return "other";
}

const SEASON_LABELS: Record<SeasonKey, string> = { easter: "Easter", summer: "Summer", halloween: "Halloween", other: "Other" };

const ReportsPage = () => {
  const [camps, setCamps] = useState<CampRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [yearFilter, setYearFilter] = useState(() => new Date().getFullYear().toString());
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [countyFilter, setCountyFilter] = useState("All");

  useEffect(() => {
    (async () => {
      const [campsRes, bookingsRes, attendanceRes, invoicesRes, payrollRes] = await Promise.all([
        supabase.from("camps").select("id, name, club_name, county, start_date, end_date, price_per_child").order("start_date", { ascending: false }),
        supabase.from("synced_bookings").select("id, matched_camp_id, total_amount, amount_paid, sibling_discount"),
        supabase.from("attendance").select("camp_id, status"),
        supabase.from("club_invoices").select("camp_id, total_amount, manual_amount, status"),
        supabase.from("payroll_records").select("camp_id, total_amount"),
      ]);
      setCamps((campsRes.data || []) as CampRow[]);
      setBookings((bookingsRes.data || []) as BookingRow[]);
      setAttendance((attendanceRes.data || []) as AttendanceRow[]);
      setInvoices((invoicesRes.data || []) as InvoiceRow[]);
      setPayroll((payrollRes.data || []) as PayrollRow[]);
      setLoading(false);
    })();
  }, []);

  const years = useMemo(() => {
    const s = new Set(camps.map((c) => c.start_date.substring(0, 4)));
    return Array.from(s).sort().reverse();
  }, [camps]);

  const counties = useMemo(() => ["All", ...new Set(camps.map((c) => c.county).filter(Boolean))], [camps]);

  const filteredCamps = useMemo(() => {
    return camps.filter((c) => {
      if (c.start_date.substring(0, 4) !== yearFilter) return false;
      if (countyFilter !== "All" && c.county !== countyFilter) return false;
      if (seasonFilter !== "all" && getSeason(c.start_date) !== seasonFilter) return false;
      return true;
    });
  }, [camps, yearFilter, countyFilter, seasonFilter]);

  const campIds = useMemo(() => new Set(filteredCamps.map((c) => c.id)), [filteredCamps]);

  const stats = useMemo(() => {
    const fb = bookings.filter((b) => b.matched_camp_id && campIds.has(b.matched_camp_id));
    const fa = attendance.filter((a) => campIds.has(a.camp_id));
    const fi = invoices.filter((i) => campIds.has(i.camp_id));
    const fp = payroll.filter((p) => campIds.has(p.camp_id));

    const totalChildren = fb.length;
    const totalRevenue = fb.reduce((s, b) => s + Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0)), 0);
    const totalPaid = fb.reduce((s, b) => s + (b.amount_paid ?? 0), 0);
    const totalPresent = fa.filter((a) => a.status === "present").length;
    const totalRecords = fa.length;
    const attendanceRate = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;
    const totalClubPayments = fi.reduce((s, i) => s + (i.manual_amount ?? i.total_amount ?? 0), 0);
    const totalPayroll = fp.reduce((s, p) => s + (p.total_amount ?? 0), 0);

    return { totalChildren, totalRevenue, totalPaid, attendanceRate, totalClubPayments, totalPayroll };
  }, [bookings, attendance, invoices, payroll, campIds]);

  // Season breakdown table
  const seasonBreakdown = useMemo(() => {
    const seasons: SeasonKey[] = ["easter", "summer", "halloween", "other"];
    return seasons.map((sk) => {
      const sc = filteredCamps.filter((c) => getSeason(c.start_date) === sk);
      if (sc.length === 0) return null;
      const ids = new Set(sc.map((c) => c.id));
      const sb = bookings.filter((b) => b.matched_camp_id && ids.has(b.matched_camp_id));
      const sa = attendance.filter((a) => ids.has(a.camp_id));
      const present = sa.filter((a) => a.status === "present").length;
      const revenue = sb.reduce((s, b) => s + Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0)), 0);
      const club = invoices.filter((i) => ids.has(i.camp_id)).reduce((s, i) => s + (i.manual_amount ?? i.total_amount ?? 0), 0);
      const pay = payroll.filter((p) => ids.has(p.camp_id)).reduce((s, p) => s + (p.total_amount ?? 0), 0);
      return {
        season: SEASON_LABELS[sk],
        camps: sc.length,
        children: sb.length,
        revenue,
        attendanceRate: sa.length > 0 ? Math.round((present / sa.length) * 100) : 0,
        clubPayments: club,
        payroll: pay,
      };
    }).filter(Boolean) as { season: string; camps: number; children: number; revenue: number; attendanceRate: number; clubPayments: number; payroll: number }[];
  }, [filteredCamps, bookings, attendance, invoices, payroll]);

  // Club growth chart data
  const clubGrowth = useMemo(() => {
    const yrs = Array.from(new Set(camps.map((c) => c.start_date.substring(0, 4)))).sort();
    const clubs = Array.from(new Set(camps.map((c) => c.club_name)));
    const chartData = yrs.map((yr) => {
      const entry: Record<string, string | number> = { year: yr };
      clubs.forEach((club) => {
        const clubCamps = camps.filter((c) => c.start_date.substring(0, 4) === yr && c.club_name === club);
        const ids = new Set(clubCamps.map((c) => c.id));
        entry[club] = bookings.filter((b) => b.matched_camp_id && ids.has(b.matched_camp_id)).length;
      });
      return entry;
    });
    return { clubs, chartData, years: yrs };
  }, [camps, bookings]);

  const CHART_COLORS = ["hsl(213, 94%, 45%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)", "hsl(270, 70%, 55%)", "hsl(180, 60%, 45%)"];

  const fmt = (n: number) => `€${n.toLocaleString("en-IE", { minimumFractionDigits: 0 })}`;

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm">Operational insights from live camp data</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Seasons</SelectItem>
              <SelectItem value="easter">Easter</SelectItem>
              <SelectItem value="summer">Summer</SelectItem>
              <SelectItem value="halloween">Halloween</SelectItem>
            </SelectContent>
          </Select>
          <Select value={countyFilter} onValueChange={setCountyFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{counties.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Camps" value={filteredCamps.length} icon={Tent} />
        <StatCard label="Children" value={stats.totalChildren} icon={Users} />
        <StatCard label="Revenue" value={fmt(stats.totalRevenue)} icon={Receipt} description={`${fmt(stats.totalPaid)} paid`} />
        <StatCard label="Attendance Rate" value={`${stats.attendanceRate}%`} icon={Percent} />
        <StatCard label="Club Payments" value={fmt(stats.totalClubPayments)} icon={Building2} />
        <StatCard label="Staff Payroll" value={fmt(stats.totalPayroll)} icon={Wallet} />
      </div>

      {/* Season Breakdown */}
      {seasonBreakdown.length > 0 && (
        <Card>
          <div className="p-4 sm:p-5 border-b">
            <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Season Breakdown — {yearFilter}</h3>
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Season</TableHead>
                  <TableHead className="text-center">Camps</TableHead>
                  <TableHead className="text-center">Children</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-center">Attendance</TableHead>
                  <TableHead className="text-right">Club Payments</TableHead>
                  <TableHead className="text-right">Payroll</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasonBreakdown.map((row) => (
                  <TableRow key={row.season}>
                    <TableCell className="font-medium">{row.season}</TableCell>
                    <TableCell className="text-center">{row.camps}</TableCell>
                    <TableCell className="text-center">{row.children}</TableCell>
                    <TableCell className="text-right">{fmt(row.revenue)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.attendanceRate >= 90 ? "default" : "secondary"}>{row.attendanceRate}%</Badge>
                    </TableCell>
                    <TableCell className="text-right">{fmt(row.clubPayments)}</TableCell>
                    <TableCell className="text-right">{fmt(row.payroll)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Growth Chart */}
      {clubGrowth.chartData.length > 0 && clubGrowth.clubs.length > 0 && (
        <Card>
          <div className="p-4 sm:p-5 border-b">
            <h3 className="font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Player Growth by Club</h3>
          </div>
          <CardContent className="p-4 sm:p-5">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clubGrowth.chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="year" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", fontSize: "0.875rem" }} />
                  <Legend />
                  {clubGrowth.clubs.slice(0, 8).map((club, i) => (
                    <Bar key={club} dataKey={club} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-camp detail table */}
      <Card>
        <div className="p-4 sm:p-5 border-b">
          <h3 className="font-semibold">Camp Detail — {yearFilter}{seasonFilter !== "all" ? ` (${SEASON_LABELS[seasonFilter as SeasonKey]})` : ""}</h3>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Camp</TableHead>
                <TableHead>Club</TableHead>
                <TableHead className="text-center">Children</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCamps.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No camps found.</TableCell></TableRow>
              ) : (
                filteredCamps.map((camp) => {
                  const cb = bookings.filter((b) => b.matched_camp_id === camp.id);
                  const rev = cb.reduce((s, b) => s + Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0)), 0);
                  const paid = cb.reduce((s, b) => s + (b.amount_paid ?? 0), 0);
                  return (
                    <TableRow key={camp.id}>
                      <TableCell className="font-medium">{camp.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{camp.club_name}</TableCell>
                      <TableCell className="text-center">{cb.length}</TableCell>
                      <TableCell className="text-right">{fmt(rev)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{fmt(paid)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
