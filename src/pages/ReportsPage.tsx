import { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart3, TrendingUp, Tent, Users, Receipt, Wallet, Building2, Percent, PlusCircle, Trash2, DollarSign, PieChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";

interface CampRow { id: string; name: string; club_name: string; county: string; venue: string; start_date: string; end_date: string; price_per_child: number; }
interface BookingRow { id: string; matched_camp_id: string | null; total_amount: number | null; amount_paid: number | null; sibling_discount: number | null; amount_owed: number | null; }
interface AttendanceRow { camp_id: string; status: string; }
interface InvoiceRow { camp_id: string; total_amount: number; manual_amount: number | null; status: string; }
interface PayrollRow { camp_id: string; total_amount: number; }
interface ExpenseRow { id: string; expense_date: string; category: string; supplier: string; amount: number; season: string | null; linked_camp_id: string | null; linked_venue: string | null; notes: string | null; }

type SeasonKey = "easter" | "summer" | "halloween" | "other";

function getSeason(startDate: string): SeasonKey {
  const month = parseInt(startDate.substring(5, 7), 10);
  if (month >= 3 && month <= 4) return "easter";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 10 && month <= 11) return "halloween";
  return "other";
}

const SEASON_LABELS: Record<SeasonKey, string> = { easter: "Easter", summer: "Summer", halloween: "Halloween", other: "Other" };
const EXPENSE_CATEGORIES = ["Kit", "Equipment", "Insurance", "Printing", "Venue Costs", "Marketing", "Transport", "Admin", "Other"];
const CHART_COLORS = ["hsl(213, 94%, 45%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)", "hsl(270, 70%, 55%)", "hsl(180, 60%, 45%)", "hsl(330, 70%, 50%)", "hsl(60, 80%, 45%)"];
const fmt = (n: number) => `€${n.toLocaleString("en-IE", { minimumFractionDigits: 0 })}`;

const ReportsPage = () => {
  const [camps, setCamps] = useState<CampRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(() => new Date().getFullYear().toString());
  const [seasonFilter, setSeasonFilter] = useState<string>("all");
  const [countyFilter, setCountyFilter] = useState("All");
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ expense_date: new Date().toISOString().substring(0, 10), category: "Other", supplier: "", amount: "", season: "", linked_camp_id: "", linked_venue: "", notes: "" });

  const loadData = useCallback(async () => {
    const [campsRes, bookingsRes, attendanceRes, invoicesRes, payrollRes, expensesRes] = await Promise.all([
      supabase.from("camps").select("id, name, club_name, county, venue, start_date, end_date, price_per_child").order("start_date", { ascending: false }),
      supabase.from("synced_bookings").select("id, matched_camp_id, total_amount, amount_paid, sibling_discount, amount_owed"),
      supabase.from("attendance").select("camp_id, status"),
      supabase.from("club_invoices").select("camp_id, total_amount, manual_amount, status"),
      supabase.from("payroll_records").select("camp_id, total_amount"),
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
    ]);
    setCamps((campsRes.data || []) as CampRow[]);
    setBookings((bookingsRes.data || []) as BookingRow[]);
    setAttendance((attendanceRes.data || []) as AttendanceRow[]);
    setInvoices((invoicesRes.data || []) as InvoiceRow[]);
    setPayroll((payrollRes.data || []) as PayrollRow[]);
    setExpenses((expensesRes.data || []) as ExpenseRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const years = useMemo(() => {
    const s = new Set(camps.map((c) => c.start_date.substring(0, 4)));
    return Array.from(s).sort().reverse();
  }, [camps]);

  const counties = useMemo(() => ["All", ...Array.from(new Set(camps.map((c) => c.county).filter(Boolean)))], [camps]);

  const filteredCamps = useMemo(() => camps.filter((c) => {
    if (c.start_date.substring(0, 4) !== yearFilter) return false;
    if (countyFilter !== "All" && c.county !== countyFilter) return false;
    if (seasonFilter !== "all" && getSeason(c.start_date) !== seasonFilter) return false;
    return true;
  }), [camps, yearFilter, countyFilter, seasonFilter]);

  const campIds = useMemo(() => new Set(filteredCamps.map((c) => c.id)), [filteredCamps]);

  const filteredExpenses = useMemo(() => expenses.filter((e) => {
    const eYear = e.expense_date.substring(0, 4);
    if (eYear !== yearFilter) return false;
    if (seasonFilter !== "all" && e.season && e.season.toLowerCase() !== seasonFilter) return false;
    return true;
  }), [expenses, yearFilter, seasonFilter]);

  const stats = useMemo(() => {
    const fb = bookings.filter((b) => b.matched_camp_id && campIds.has(b.matched_camp_id));
    const fi = invoices.filter((i) => campIds.has(i.camp_id));
    const fp = payroll.filter((p) => campIds.has(p.camp_id));
    const totalChildren = fb.length;
    const totalRevenue = fb.reduce((s, b) => s + Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0)), 0);
    const totalPaid = fb.reduce((s, b) => s + (b.amount_paid ?? 0), 0);
    const outstanding = fb.reduce((s, b) => s + (b.amount_owed ?? 0), 0);
    const totalClubPayments = fi.reduce((s, i) => s + (i.manual_amount ?? i.total_amount ?? 0), 0);
    const totalPayroll = fp.reduce((s, p) => s + (p.total_amount ?? 0), 0);
    const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0);
    const totalExpenditure = totalClubPayments + totalPayroll + totalExpenses;
    const estimatedProfit = totalRevenue - totalExpenditure;
    return { totalChildren, totalRevenue, totalPaid, outstanding, totalClubPayments, totalPayroll, totalExpenses, totalExpenditure, estimatedProfit };
  }, [bookings, invoices, payroll, campIds, filteredExpenses]);

  // Year-on-year data
  const yoyData = useMemo(() => {
    return years.map((yr) => {
      const yc = camps.filter((c) => c.start_date.substring(0, 4) === yr);
      const ids = new Set(yc.map((c) => c.id));
      const yb = bookings.filter((b) => b.matched_camp_id && ids.has(b.matched_camp_id));
      const rev = yb.reduce((s, b) => s + Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0)), 0);
      const club = invoices.filter((i) => ids.has(i.camp_id)).reduce((s, i) => s + (i.manual_amount ?? i.total_amount ?? 0), 0);
      const pay = payroll.filter((p) => ids.has(p.camp_id)).reduce((s, p) => s + (p.total_amount ?? 0), 0);
      const exp = expenses.filter((e) => e.expense_date.substring(0, 4) === yr).reduce((s, e) => s + e.amount, 0);
      return { year: yr, camps: yc.length, children: yb.length, revenue: rev, avgRevPerCamp: yc.length > 0 ? Math.round(rev / yc.length) : 0, avgChildrenPerCamp: yc.length > 0 ? Math.round(yb.length / yc.length) : 0, clubPayments: club, payroll: pay, expenses: exp, profit: rev - club - pay - exp };
    });
  }, [years, camps, bookings, invoices, payroll, expenses]);

  // Venue comparison
  const venueData = useMemo(() => {
    const venueMap = new Map<string, { camps: string[]; club: string }>();
    filteredCamps.forEach((c) => {
      const key = c.venue || c.club_name;
      if (!venueMap.has(key)) venueMap.set(key, { camps: [], club: c.club_name });
      venueMap.get(key)!.camps.push(c.id);
    });
    return Array.from(venueMap.entries()).map(([venue, { camps: ids, club }]) => {
      const idSet = new Set(ids);
      const vb = bookings.filter((b) => b.matched_camp_id && idSet.has(b.matched_camp_id));
      const rev = vb.reduce((s, b) => s + Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0)), 0);
      const clubPay = invoices.filter((i) => idSet.has(i.camp_id)).reduce((s, i) => s + (i.manual_amount ?? i.total_amount ?? 0), 0);
      const pay = payroll.filter((p) => idSet.has(p.camp_id)).reduce((s, p) => s + (p.total_amount ?? 0), 0);
      return { venue, club, campCount: ids.length, children: vb.length, revenue: rev, clubPayments: clubPay, payroll: pay, profit: rev - clubPay - pay };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [filteredCamps, bookings, invoices, payroll]);

  // Camp comparison
  const campComparison = useMemo(() => {
    return filteredCamps.map((camp) => {
      const cb = bookings.filter((b) => b.matched_camp_id === camp.id);
      const rev = cb.reduce((s, b) => s + Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0)), 0);
      const clubPay = invoices.filter((i) => i.camp_id === camp.id).reduce((s, i) => s + (i.manual_amount ?? i.total_amount ?? 0), 0);
      const pay = payroll.filter((p) => p.camp_id === camp.id).reduce((s, p) => s + (p.total_amount ?? 0), 0);
      const att = attendance.filter((a) => a.camp_id === camp.id);
      const present = att.filter((a) => a.status === "present").length;
      return { ...camp, children: cb.length, revenue: rev, clubPayments: clubPay, payroll: pay, profit: rev - clubPay - pay, attendanceRate: att.length > 0 ? Math.round((present / att.length) * 100) : 0 };
    }).sort((a, b) => b.children - a.children);
  }, [filteredCamps, bookings, invoices, payroll, attendance]);

  // Season breakdown
  const seasonBreakdown = useMemo(() => {
    const seasons: SeasonKey[] = ["easter", "summer", "halloween", "other"];
    return seasons.map((sk) => {
      const sc = filteredCamps.filter((c) => getSeason(c.start_date) === sk);
      if (sc.length === 0) return null;
      const ids = new Set(sc.map((c) => c.id));
      const sb = bookings.filter((b) => b.matched_camp_id && ids.has(b.matched_camp_id));
      const revenue = sb.reduce((s, b) => s + Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0)), 0);
      const club = invoices.filter((i) => ids.has(i.camp_id)).reduce((s, i) => s + (i.manual_amount ?? i.total_amount ?? 0), 0);
      const pay = payroll.filter((p) => ids.has(p.camp_id)).reduce((s, p) => s + (p.total_amount ?? 0), 0);
      const exp = filteredExpenses.filter((e) => e.season?.toLowerCase() === sk).reduce((s, e) => s + e.amount, 0);
      return { season: SEASON_LABELS[sk], camps: sc.length, children: sb.length, revenue, clubPayments: club, payroll: pay, expenses: exp, profit: revenue - club - pay - exp };
    }).filter(Boolean) as any[];
  }, [filteredCamps, bookings, invoices, payroll, filteredExpenses]);

  const handleAddExpense = async () => {
    const { error } = await supabase.from("expenses").insert({
      expense_date: expenseForm.expense_date,
      category: expenseForm.category,
      supplier: expenseForm.supplier,
      amount: parseFloat(expenseForm.amount) || 0,
      season: expenseForm.season || null,
      linked_camp_id: expenseForm.linked_camp_id || null,
      linked_venue: expenseForm.linked_venue || null,
      notes: expenseForm.notes || null,
    });
    if (error) { toast.error("Failed to add expense"); return; }
    toast.success("Expense added");
    setExpenseDialogOpen(false);
    setExpenseForm({ expense_date: new Date().toISOString().substring(0, 10), category: "Other", supplier: "", amount: "", season: "", linked_camp_id: "", linked_venue: "", notes: "" });
    loadData();
  };

  const handleDeleteExpense = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    toast.success("Expense deleted");
    loadData();
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm">Business insights, comparisons & profitability</p>
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

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Revenue" value={fmt(stats.totalRevenue)} icon={Receipt} description={`${fmt(stats.totalPaid)} collected`} />
        <StatCard label="Camps" value={filteredCamps.length} icon={Tent} />
        <StatCard label="Children" value={stats.totalChildren} icon={Users} />
        <StatCard label="Outstanding" value={fmt(stats.outstanding)} icon={Wallet} />
        <StatCard label="Club Payments" value={fmt(stats.totalClubPayments)} icon={Building2} />
        <StatCard label="Staff Payroll" value={fmt(stats.totalPayroll)} icon={DollarSign} />
        <StatCard label="Other Expenses" value={fmt(stats.totalExpenses)} icon={PieChart} />
        <StatCard label="Est. Profit" value={fmt(stats.estimatedProfit)} icon={TrendingUp} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="yoy">Year-on-Year</TabsTrigger>
          <TabsTrigger value="venues">Venues / Clubs</TabsTrigger>
          <TabsTrigger value="camps">Camps</TabsTrigger>
          <TabsTrigger value="expenses">Expenditure</TabsTrigger>
          <TabsTrigger value="profitability">Profitability</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4">
          {seasonBreakdown.length > 0 && (
            <Card>
              <div className="p-4 border-b"><h3 className="font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Season Breakdown — {yearFilter}</h3></div>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Season</TableHead>
                      <TableHead className="text-center">Camps</TableHead>
                      <TableHead className="text-center">Children</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Club Pay</TableHead>
                      <TableHead className="text-right">Payroll</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seasonBreakdown.map((row: any) => (
                      <TableRow key={row.season}>
                        <TableCell className="font-medium">{row.season}</TableCell>
                        <TableCell className="text-center">{row.camps}</TableCell>
                        <TableCell className="text-center">{row.children}</TableCell>
                        <TableCell className="text-right">{fmt(row.revenue)}</TableCell>
                        <TableCell className="text-right">{fmt(row.clubPayments)}</TableCell>
                        <TableCell className="text-right">{fmt(row.payroll)}</TableCell>
                        <TableCell className="text-right">{fmt(row.expenses)}</TableCell>
                        <TableCell className={`text-right font-medium ${row.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(row.profit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* YEAR-ON-YEAR TAB */}
        <TabsContent value="yoy" className="space-y-4">
          <Card>
            <div className="p-4 border-b"><h3 className="font-semibold">Year-on-Year Comparison</h3></div>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead className="text-center">Camps</TableHead>
                    <TableHead className="text-center">Children</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg/Camp</TableHead>
                    <TableHead className="text-center">Avg Kids/Camp</TableHead>
                    <TableHead className="text-right">Expenditure</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {yoyData.map((row) => (
                    <TableRow key={row.year}>
                      <TableCell className="font-medium">{row.year}</TableCell>
                      <TableCell className="text-center">{row.camps}</TableCell>
                      <TableCell className="text-center">{row.children}</TableCell>
                      <TableCell className="text-right">{fmt(row.revenue)}</TableCell>
                      <TableCell className="text-right">{fmt(row.avgRevPerCamp)}</TableCell>
                      <TableCell className="text-center">{row.avgChildrenPerCamp}</TableCell>
                      <TableCell className="text-right">{fmt(row.clubPayments + row.payroll + row.expenses)}</TableCell>
                      <TableCell className={`text-right font-medium ${row.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(row.profit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {yoyData.length > 1 && (
            <Card>
              <div className="p-4 border-b"><h3 className="font-semibold">Revenue & Children by Year</h3></div>
              <CardContent className="p-4">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yoyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="year" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", fontSize: "0.875rem" }} />
                      <Legend />
                      <Bar yAxisId="left" dataKey="revenue" name="Revenue (€)" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="children" name="Children" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* VENUES / CLUBS TAB */}
        <TabsContent value="venues" className="space-y-4">
          <Card>
            <div className="p-4 border-b"><h3 className="font-semibold">Venue / Club Comparison — {yearFilter}</h3></div>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venue</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead className="text-center">Camps</TableHead>
                    <TableHead className="text-center">Children</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Club Pay</TableHead>
                    <TableHead className="text-right">Payroll</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venueData.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No venue data.</TableCell></TableRow>
                  ) : venueData.map((v, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{v.venue}{i === 0 && venueData.length > 1 && <Badge className="ml-2 text-xs" variant="default">Top</Badge>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{v.club}</TableCell>
                      <TableCell className="text-center">{v.campCount}</TableCell>
                      <TableCell className="text-center">{v.children}</TableCell>
                      <TableCell className="text-right">{fmt(v.revenue)}</TableCell>
                      <TableCell className="text-right">{fmt(v.clubPayments)}</TableCell>
                      <TableCell className="text-right">{fmt(v.payroll)}</TableCell>
                      <TableCell className={`text-right font-medium ${v.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(v.profit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          {venueData.length > 0 && (
            <Card>
              <div className="p-4 border-b"><h3 className="font-semibold">Venue Revenue Chart</h3></div>
              <CardContent className="p-4">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={venueData.slice(0, 12)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis type="number" />
                      <YAxis dataKey="venue" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))", fontSize: "0.875rem" }} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                      <Bar dataKey="profit" name="Profit" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CAMPS TAB */}
        <TabsContent value="camps" className="space-y-4">
          <Card>
            <div className="p-4 border-b"><h3 className="font-semibold">Camp Comparison — {yearFilter}</h3></div>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Camp</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead className="text-center">Children</TableHead>
                    <TableHead className="text-center">Attendance</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Club Pay</TableHead>
                    <TableHead className="text-right">Payroll</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campComparison.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No camps.</TableCell></TableRow>
                  ) : campComparison.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.club_name}</TableCell>
                      <TableCell className="text-center">{c.children}</TableCell>
                      <TableCell className="text-center"><Badge variant={c.attendanceRate >= 85 ? "default" : "secondary"}>{c.attendanceRate}%</Badge></TableCell>
                      <TableCell className="text-right">{fmt(c.revenue)}</TableCell>
                      <TableCell className="text-right">{fmt(c.clubPayments)}</TableCell>
                      <TableCell className="text-right">{fmt(c.payroll)}</TableCell>
                      <TableCell className={`text-right font-medium ${c.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(c.profit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXPENDITURE TAB */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Manual Expenditure — {yearFilter}</h3>
            <Dialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><PlusCircle className="h-4 w-4 mr-1" />Add Expense</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date</Label><Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} /></div>
                    <div><Label>Amount (€)</Label><Input type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Category</Label>
                      <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Supplier / Payee</Label><Input value={expenseForm.supplier} onChange={(e) => setExpenseForm({ ...expenseForm, supplier: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Season</Label>
                      <Select value={expenseForm.season} onValueChange={(v) => setExpenseForm({ ...expenseForm, season: v })}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easter">Easter</SelectItem>
                          <SelectItem value="summer">Summer</SelectItem>
                          <SelectItem value="halloween">Halloween</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Linked Venue</Label><Input value={expenseForm.linked_venue} onChange={(e) => setExpenseForm({ ...expenseForm, linked_venue: e.target.value })} placeholder="Optional" /></div>
                  </div>
                  <div><Label>Notes</Label><Textarea value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} rows={2} /></div>
                  <Button onClick={handleAddExpense} className="w-full">Save Expense</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Expense summary by category */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(filteredExpenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
              <Card key={cat}><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">{cat}</p><p className="text-lg font-bold">{fmt(total)}</p></CardContent></Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Season</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No expenses recorded for {yearFilter}.</TableCell></TableRow>
                  ) : filteredExpenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm">{e.expense_date}</TableCell>
                      <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                      <TableCell className="text-sm">{e.supplier}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(e.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.season ? SEASON_LABELS[e.season as SeasonKey] || e.season : "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.linked_venue || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{e.notes || "—"}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROFITABILITY TAB */}
        <TabsContent value="profitability" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-xl font-bold">{fmt(stats.totalRevenue)}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Total Expenditure</p><p className="text-xl font-bold">{fmt(stats.totalExpenditure)}</p><p className="text-xs text-muted-foreground mt-1">Club {fmt(stats.totalClubPayments)} · Payroll {fmt(stats.totalPayroll)} · Other {fmt(stats.totalExpenses)}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Estimated Profit</p><p className={`text-xl font-bold ${stats.estimatedProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(stats.estimatedProfit)}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">Profit Margin</p><p className={`text-xl font-bold ${stats.estimatedProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{stats.totalRevenue > 0 ? Math.round((stats.estimatedProfit / stats.totalRevenue) * 100) : 0}%</p></CardContent></Card>
          </div>

          {/* Season profitability */}
          {seasonBreakdown.length > 0 && (
            <Card>
              <div className="p-4 border-b"><h3 className="font-semibold">Season Profitability — {yearFilter}</h3></div>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Season</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Club Pay</TableHead>
                      <TableHead className="text-right">Payroll</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seasonBreakdown.map((row: any) => (
                      <TableRow key={row.season}>
                        <TableCell className="font-medium">{row.season}</TableCell>
                        <TableCell className="text-right">{fmt(row.revenue)}</TableCell>
                        <TableCell className="text-right">{fmt(row.clubPayments)}</TableCell>
                        <TableCell className="text-right">{fmt(row.payroll)}</TableCell>
                        <TableCell className="text-right">{fmt(row.expenses)}</TableCell>
                        <TableCell className={`text-right font-medium ${row.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(row.profit)}</TableCell>
                        <TableCell className="text-right">{row.revenue > 0 ? Math.round((row.profit / row.revenue) * 100) : 0}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Top 5 most profitable venues */}
          {venueData.length > 0 && (
            <Card>
              <div className="p-4 border-b"><h3 className="font-semibold">Most Profitable Venues — {yearFilter}</h3></div>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Venue</TableHead>
                      <TableHead className="text-center">Children</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Costs</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...venueData].sort((a, b) => b.profit - a.profit).slice(0, 8).map((v, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{i + 1}</TableCell>
                        <TableCell className="font-medium">{v.venue}</TableCell>
                        <TableCell className="text-center">{v.children}</TableCell>
                        <TableCell className="text-right">{fmt(v.revenue)}</TableCell>
                        <TableCell className="text-right">{fmt(v.clubPayments + v.payroll)}</TableCell>
                        <TableCell className={`text-right font-medium ${v.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(v.profit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
