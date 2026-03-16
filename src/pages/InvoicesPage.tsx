import { useState, useEffect, useMemo, useCallback } from "react";
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks, parseISO } from "date-fns";
import { FileText, Plus, Wallet, Users, Tent, CalendarIcon, ChevronLeft, ChevronRight, Wand2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { ClubPaymentExport } from "@/components/payments/ClubPaymentExport";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";

// ---- Types ----

interface ClubRef {
  id: string;
  name: string;
}

interface InvoiceRow {
  id: string;
  camp_id: string;
  club_name: string;       // legacy from club_invoices
  attendance_count: number;
  rate_per_child: number;
  total_amount: number;
  manual_amount: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  camp_name?: string;
  camp_start?: string;
  camp_end?: string;
  resolved_club_name?: string;  // from clubs table via camp.club_id
  resolved_club_id?: string | null;
}

interface CampRow {
  id: string;
  name: string;
  club_name: string;
  club_id: string | null;
  start_date: string;
  end_date: string;
}

type InvoiceStatus = "draft" | "ready" | "sent" | "paid";

// ---- Component ----

const InvoicesPage = () => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [camps, setCamps] = useState<CampRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCamp, setFilterCamp] = useState<string>("all");

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  const [clubs, setClubs] = useState<ClubRef[]>([]);

  // Load invoices, camps, and clubs
  const loadData = useCallback(async () => {
    setLoading(true);
    const [invoicesRes, campsRes, clubsRes] = await Promise.all([
      supabase.from("club_invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("camps").select("id, name, club_name, club_id, start_date, end_date").order("start_date", { ascending: false }),
      supabase.from("clubs").select("id, name").order("name"),
    ]);

    if (invoicesRes.error || campsRes.error) {
      toast({ title: "Error loading data", variant: "destructive" });
      setLoading(false);
      return;
    }

    const clubsList = (clubsRes.data || []) as ClubRef[];
    setClubs(clubsList);
    const clubMap = new Map(clubsList.map(cl => [cl.id, cl.name]));
    const campMap = new Map((campsRes.data || []).map((c: any) => [c.id, c]));

    const enriched = (invoicesRes.data || []).map((inv: any) => {
      const camp = campMap.get(inv.camp_id);
      const resolvedClubName = camp?.club_id ? (clubMap.get(camp.club_id) || camp?.club_name || "Unknown") : (camp?.club_name || "Unassigned");
      return {
        ...inv,
        camp_name: camp?.name || "Unknown",
        camp_start: camp?.start_date,
        camp_end: camp?.end_date,
        resolved_club_name: resolvedClubName,
        resolved_club_id: camp?.club_id || null,
      };
    });

    setInvoices(enriched);
    setCamps((campsRes.data || []) as CampRow[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Generate payments for camps this week from attendance data
  const generateForWeek = useCallback(async () => {
    setGenerating(true);
    const wsISO = format(weekStart, "yyyy-MM-dd");
    const weISO = format(weekEnd, "yyyy-MM-dd");

    // Get camps this week
    const { data: weekCamps } = await supabase.from("camps")
      .select("id, name, club_name, start_date, end_date")
      .lte("start_date", weISO).gte("end_date", wsISO);

    if (!weekCamps || weekCamps.length === 0) {
      sonnerToast.error("No camps found this week");
      setGenerating(false);
      return;
    }

    // Check which already have invoices
    const existingCampIds = new Set(invoices.map(i => i.camp_id));
    const newCamps = weekCamps.filter(c => !existingCampIds.has(c.id));

    if (newCamps.length === 0) {
      sonnerToast.info("All camps this week already have payments generated");
      setGenerating(false);
      return;
    }

    // Get attendance for these camps
    const campIds = newCamps.map(c => c.id);
    const { data: attendanceData } = await supabase.from("attendance")
      .select("camp_id, player_id, status")
      .in("camp_id", campIds)
      .eq("status", "present");

    // Count unique players per camp
    const attendanceCounts: Record<string, Set<string>> = {};
    (attendanceData || []).forEach((a: { camp_id: string; player_id: string }) => {
      if (!attendanceCounts[a.camp_id]) attendanceCounts[a.camp_id] = new Set();
      attendanceCounts[a.camp_id].add(a.player_id);
    });

    // Create invoice records
    const newInvoices = newCamps.map(camp => {
      const count = attendanceCounts[camp.id]?.size || 0;
      const rate = 15;
      return {
        camp_id: camp.id,
        club_name: camp.club_name,
        attendance_count: count,
        rate_per_child: rate,
        total_amount: count * rate,
        manual_amount: null as number | null,
        status: "draft" as const,
        notes: null as string | null,
      };
    });

    const { error } = await supabase.from("club_invoices").insert(newInvoices);
    if (error) {
      toast({ title: "Error generating payments", description: error.message, variant: "destructive" });
    } else {
      sonnerToast.success(`Generated ${newInvoices.length} club payments`);
      await loadData();
    }
    setGenerating(false);
  }, [weekStart, weekEnd, invoices, toast, loadData]);

  // Update invoice field
  const updateInvoice = useCallback(async (id: string, updates: Record<string, unknown>) => {
    const { error } = await supabase.from("club_invoices").update(updates).eq("id", id);
    if (error) {
      toast({ title: "Error updating", description: error.message, variant: "destructive" });
    } else {
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } as InvoiceRow : inv));
    }
  }, [toast]);

  const updateStatus = useCallback((id: string, status: InvoiceStatus) => {
    updateInvoice(id, { status });
  }, [updateInvoice]);

  const updateRate = useCallback((id: string, rate: number) => {
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    const total = inv.attendance_count * rate;
    updateInvoice(id, { rate_per_child: rate, total_amount: total });
  }, [invoices, updateInvoice]);

  const updateManualAmount = useCallback((id: string, value: string) => {
    const amount = value === "" ? null : Number(value);
    updateInvoice(id, { manual_amount: amount });
  }, [updateInvoice]);

  const updateNotes = useCallback((id: string, notes: string) => {
    updateInvoice(id, { notes: notes || null });
  }, [updateInvoice]);

  const getEffective = (inv: InvoiceRow) => inv.manual_amount ?? inv.total_amount;

  // Filtered views
  const weekInvoices = useMemo(() => {
    const wsISO = format(weekStart, "yyyy-MM-dd");
    const weISO = format(weekEnd, "yyyy-MM-dd");
    return invoices.filter(inv => {
      if (!inv.camp_start) return false;
      return inv.camp_start <= weISO && (inv.camp_end || inv.camp_start) >= wsISO;
    });
  }, [invoices, weekStart, weekEnd]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (filterStatus !== "all" && inv.status !== filterStatus) return false;
      if (filterCamp !== "all" && inv.camp_id !== filterCamp) return false;
      return true;
    });
  }, [invoices, filterStatus, filterCamp]);

  const clubGroups = useMemo(() => {
    const map = new Map<string, InvoiceRow[]>();
    filteredInvoices.forEach(inv => {
      const key = inv.resolved_club_id || `legacy_${inv.resolved_club_name || inv.club_name}`;
      const name = inv.resolved_club_name || inv.club_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(inv);
    });
    return Array.from(map.entries())
      .map(([key, invs]) => [invs[0].resolved_club_name || invs[0].club_name, invs] as [string, InvoiceRow[]])
      .sort(([a], [b]) => a.localeCompare(b));
  }, [filteredInvoices]);

  const totalAll = filteredInvoices.reduce((s, i) => s + getEffective(i), 0);
  const totalPaid = filteredInvoices.filter(i => i.status === "paid").reduce((s, i) => s + getEffective(i), 0);
  const totalOutstanding = filteredInvoices.filter(i => i.status !== "paid").reduce((s, i) => s + getEffective(i), 0);
  const weekTotal = weekInvoices.reduce((s, i) => s + getEffective(i), 0);

  const statusBadge = (status: string) => {
    switch (status) {
      case "draft": return <Badge variant="secondary" className="text-xs">Draft</Badge>;
      case "ready": return <Badge className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">Ready</Badge>;
      case "sent": return <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">Sent</Badge>;
      case "paid": return <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Paid</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  const statusSelect = (inv: InvoiceRow) => (
    <Select value={inv.status} onValueChange={(v) => updateStatus(inv.id, v as InvoiceStatus)}>
      <SelectTrigger className="h-8 w-[100px] text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="draft">Draft</SelectItem>
        <SelectItem value="ready">Ready</SelectItem>
        <SelectItem value="sent">Sent</SelectItem>
        <SelectItem value="paid">Paid</SelectItem>
      </SelectContent>
    </Select>
  );

  const exportRows = (rows: InvoiceRow[]) => rows.map(inv => ({
    clubName: inv.club_name,
    campName: inv.camp_name || "",
    attendance: inv.attendance_count,
    rate: inv.rate_per_child,
    total: getEffective(inv),
    status: inv.status,
  }));

  // Unique camps list for the camp filter
  const campOptions = useMemo(() => {
    const seen = new Set<string>();
    return invoices.reduce<CampRow[]>((acc, inv) => {
      if (!seen.has(inv.camp_id)) {
        seen.add(inv.camp_id);
        const camp = camps.find(c => c.id === inv.camp_id);
        if (camp) acc.push(camp);
      }
      return acc;
    }, []);
  }, [invoices, camps]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Club Payments</h1>
          <p className="text-muted-foreground text-sm">Track amounts owed to partner clubs based on attendance</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard label="Total Owed" value={`€${totalAll.toLocaleString()}`} icon={Wallet} />
        <StatCard label="Paid" value={`€${totalPaid.toLocaleString()}`} icon={FileText} />
        <StatCard label="Outstanding" value={`€${totalOutstanding.toLocaleString()}`} icon={AlertCircle} />
        <StatCard label="This Week" value={`€${weekTotal.toLocaleString()}`} icon={Tent} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCamp} onValueChange={setFilterCamp}>
          <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="Camp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Camps</SelectItem>
            {campOptions.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterStatus !== "all" || filterCamp !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus("all"); setFilterCamp("all"); }}>
            Clear filters
          </Button>
        )}
      </div>

      <Tabs defaultValue="weekly">
        <TabsList>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="club">By Club</TabsTrigger>
          <TabsTrigger value="season">Season</TabsTrigger>
        </TabsList>

        {/* ---- WEEKLY VIEW ---- */}
        <TabsContent value="weekly" className="space-y-4 mt-4">
          {/* Week selector */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(subWeeks(selectedDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[220px] justify-start text-left font-normal h-9")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(weekStart, "d MMM")} — {format(weekEnd, "d MMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(addWeeks(selectedDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={generateForWeek} disabled={generating} className="gap-2 ml-2">
              <Wand2 className="h-4 w-4" /> {generating ? "Generating…" : "Generate for Week"}
            </Button>
            {weekInvoices.length > 0 && (
              <ClubPaymentExport
                payments={exportRows(weekInvoices)}
                title={`Club Payments — Week of ${format(weekStart, "d MMM yyyy")}`}
                totalAmount={weekTotal}
              />
            )}
          </div>

          {weekInvoices.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No payments for this week</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Click "Generate for Week" to create payments from attendance data</p>
            </CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Club</TableHead>
                    <TableHead>Camp</TableHead>
                    <TableHead className="text-center">Attendance</TableHead>
                    <TableHead className="text-right w-24">Rate</TableHead>
                    <TableHead className="text-right">Calculated</TableHead>
                    <TableHead className="text-right w-28">Override</TableHead>
                    <TableHead className="text-right">Effective</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekInvoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.club_name}</TableCell>
                      <TableCell className="text-sm">{inv.camp_name}</TableCell>
                      <TableCell className="text-center">{inv.attendance_count}</TableCell>
                      <TableCell className="text-right">
                        <Input type="number" className="w-20 h-8 text-right font-mono" value={inv.rate_per_child}
                          onChange={(e) => updateRate(inv.id, Number(e.target.value))} />
                      </TableCell>
                      <TableCell className="text-right font-mono">€{inv.total_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Input type="number" className="w-24 h-8 text-right font-mono" placeholder="—"
                          value={inv.manual_amount ?? ""} onChange={(e) => updateManualAmount(inv.id, e.target.value)} />
                      </TableCell>
                      <TableCell className="text-right font-semibold font-mono">€{getEffective(inv).toFixed(2)}</TableCell>
                      <TableCell>
                        <Input className="w-32 h-8 text-xs" placeholder="Notes…" value={inv.notes || ""}
                          onChange={(e) => updateNotes(inv.id, e.target.value)} />
                      </TableCell>
                      <TableCell>{statusSelect(inv)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={6} className="text-right font-semibold">Week Total</TableCell>
                    <TableCell className="text-right font-bold font-mono">€{weekTotal.toFixed(2)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ---- BY CLUB VIEW ---- */}
        <TabsContent value="club" className="space-y-4 mt-4">
          {clubGroups.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No payment records yet.</CardContent></Card>
          ) : clubGroups.map(([clubName, clubInvs]) => {
            const clubTotal = clubInvs.reduce((s, i) => s + getEffective(i), 0);
            const paidTotal = clubInvs.filter(i => i.status === "paid").reduce((s, i) => s + getEffective(i), 0);
            return (
              <Card key={clubName}>
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{clubName}</h3>
                    <p className="text-xs text-muted-foreground">{clubInvs.length} payments · €{paidTotal.toFixed(2)} paid</p>
                  </div>
                  <Badge variant="secondary" className="font-mono text-sm">€{clubTotal.toFixed(2)}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Camp</TableHead>
                      <TableHead className="text-center">Attendance</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clubInvs.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.camp_name}</TableCell>
                        <TableCell className="text-center">{inv.attendance_count}</TableCell>
                        <TableCell className="text-right font-mono">€{inv.rate_per_child}</TableCell>
                        <TableCell className="text-right font-semibold font-mono">€{getEffective(inv).toFixed(2)}</TableCell>
                        <TableCell>{statusBadge(inv.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            );
          })}
          {clubGroups.length > 0 && (
            <ClubPaymentExport
              payments={exportRows(filteredInvoices)}
              title="Club Payments — All Clubs"
              totalAmount={totalAll}
            />
          )}
        </TabsContent>

        {/* ---- SEASON SUMMARY ---- */}
        <TabsContent value="season" className="space-y-4 mt-4">
          <Card>
            <div className="p-4 border-b">
              <h3 className="font-semibold">Season Summary</h3>
              <p className="text-sm text-muted-foreground">All club payments across the season</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Club</TableHead>
                  <TableHead className="text-center">Camps</TableHead>
                  <TableHead className="text-center">Total Attendance</TableHead>
                  <TableHead className="text-right">Total Owed</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clubGroups.map(([clubName, clubInvs]) => {
                  const total = clubInvs.reduce((s, i) => s + getEffective(i), 0);
                  const paid = clubInvs.filter(i => i.status === "paid").reduce((s, i) => s + getEffective(i), 0);
                  const totalAttendance = clubInvs.reduce((s, i) => s + i.attendance_count, 0);
                  return (
                    <TableRow key={clubName}>
                      <TableCell className="font-medium">{clubName}</TableCell>
                      <TableCell className="text-center">{clubInvs.length}</TableCell>
                      <TableCell className="text-center">{totalAttendance}</TableCell>
                      <TableCell className="text-right font-mono">€{total.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">€{paid.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">€{(total - paid).toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
                {clubGroups.length > 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-semibold">Totals</TableCell>
                    <TableCell className="text-center font-semibold">{filteredInvoices.length}</TableCell>
                    <TableCell className="text-center font-semibold">{filteredInvoices.reduce((s, i) => s + i.attendance_count, 0)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">€{totalAll.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-600">€{totalPaid.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-bold">€{totalOutstanding.toFixed(2)}</TableCell>
                  </TableRow>
                )}
                {clubGroups.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payment data yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
          {filteredInvoices.length > 0 && (
            <ClubPaymentExport
              payments={exportRows(filteredInvoices)}
              title="Club Payments — Season Summary"
              totalAmount={totalAll}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InvoicesPage;
