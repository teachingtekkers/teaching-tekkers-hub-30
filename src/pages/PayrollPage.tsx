import { useState } from "react";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { CalendarIcon, DollarSign, Wallet, Users, Tent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";
import { mockCamps, mockCampCoaches, mockCoaches, mockPayrollRecords, getCampDays } from "@/data/mock";
import { PayrollRecord } from "@/types";
import { toast } from "sonner";

const PayrollPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date("2026-03-09"));
  const [payroll, setPayroll] = useState<PayrollRecord[]>(mockPayrollRecords);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  const weekPayroll = payroll.filter(p => p.week_start === weekStartStr);

  const weekCamps = mockCamps.filter(camp => {
    const campStart = parseISO(camp.start_date);
    const campEnd = parseISO(camp.end_date);
    return campStart <= weekEnd && campEnd >= weekStart;
  });

  const handleGenerate = () => {
    const existing = payroll.filter(p => p.week_start === weekStartStr);
    if (existing.length > 0) { toast.error("Payroll already generated for this week"); return; }

    const newRecords: PayrollRecord[] = [];
    weekCamps.forEach(camp => {
      const campAssignments = mockCampCoaches.filter(a => a.camp_id === camp.id);
      const days = getCampDays(camp.start_date, camp.end_date);
      campAssignments.forEach(assignment => {
        const coach = mockCoaches.find(c => c.id === assignment.coach_id);
        if (!coach) return;
        const rate = assignment.role === "head_coach" ? coach.head_coach_daily_rate : coach.daily_rate;
        const fuel = coach.fuel_allowance_eligible ? 20 : 0;
        const total = rate * days + fuel;
        newRecords.push({
          id: String(payroll.length + newRecords.length + 1),
          coach_id: coach.id, camp_id: camp.id, week_start: weekStartStr,
          days_worked: days, daily_rate_used: rate, fuel_allowance: fuel,
          manual_adjustment: 0, total_amount: total, notes: null,
          created_at: new Date().toISOString(),
        });
      });
    });
    setPayroll([...payroll, ...newRecords]);
    toast.success(`Generated payroll for ${newRecords.length} assignments`);
  };

  const updateField = (id: string, field: keyof PayrollRecord, value: number) => {
    setPayroll(payroll.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      updated.total_amount = updated.daily_rate_used * updated.days_worked + updated.fuel_allowance + updated.manual_adjustment;
      return updated;
    }));
  };

  const coachSummary = mockCoaches.map(coach => {
    const records = weekPayroll.filter(p => p.coach_id === coach.id);
    const total = records.reduce((sum, r) => sum + r.total_amount, 0);
    return { coach, records, total };
  }).filter(s => s.records.length > 0);

  const weekTotal = coachSummary.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground text-sm">Week of {format(weekStart, "d MMM")} — {format(weekEnd, "d MMM yyyy")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[220px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
          <Button onClick={handleGenerate}><DollarSign className="mr-2 h-4 w-4" />Generate</Button>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Payroll" value={`€${weekTotal.toLocaleString()}`} icon={Wallet} />
        <StatCard label="Coaches Paid" value={coachSummary.length} icon={Users} />
        <StatCard label="Camps Covered" value={weekCamps.length} icon={Tent} />
      </div>

      {weekPayroll.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No payroll generated for this week</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Click "Generate" to create payroll from coach assignments</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="coach">
          <TabsList>
            <TabsTrigger value="coach">By Coach</TabsTrigger>
            <TabsTrigger value="camp">By Camp</TabsTrigger>
          </TabsList>

          <TabsContent value="coach" className="space-y-4 mt-4">
            {coachSummary.map(({ coach, records, total }) => (
              <Card key={coach.id}>
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold">{coach.full_name}</h3>
                  <Badge variant="secondary" className="font-mono">€{total.toFixed(2)}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Camp</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Fuel</TableHead>
                      <TableHead>Adj.</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map(r => {
                      const camp = mockCamps.find(c => c.id === r.camp_id);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{camp?.name}</TableCell>
                          <TableCell>{r.days_worked}</TableCell>
                          <TableCell>€{r.daily_rate_used}</TableCell>
                          <TableCell>
                            <Input type="number" className="w-20 h-8" value={r.fuel_allowance} onChange={(e) => updateField(r.id, "fuel_allowance", Number(e.target.value))} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" className="w-20 h-8" value={r.manual_adjustment} onChange={(e) => updateField(r.id, "manual_adjustment", Number(e.target.value))} />
                          </TableCell>
                          <TableCell className="font-semibold font-mono">€{r.total_amount.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="camp" className="space-y-4 mt-4">
            {weekCamps.map(camp => {
              const campRecords = weekPayroll.filter(p => p.camp_id === camp.id);
              const campTotal = campRecords.reduce((sum, r) => sum + r.total_amount, 0);
              return (
                <Card key={camp.id}>
                  <div className="p-4 border-b flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{camp.name}</h3>
                      <p className="text-sm text-muted-foreground">{camp.club_name}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">€{campTotal.toFixed(2)}</Badge>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coach</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campRecords.map(r => {
                        const coach = mockCoaches.find(c => c.id === r.coach_id);
                        const assignment = mockCampCoaches.find(a => a.camp_id === camp.id && a.coach_id === r.coach_id);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{coach?.full_name}</TableCell>
                            <TableCell><Badge variant={assignment?.role === "head_coach" ? "default" : "secondary"}>{assignment?.role === "head_coach" ? "Head" : "Asst"}</Badge></TableCell>
                            <TableCell>{r.days_worked}</TableCell>
                            <TableCell>€{r.daily_rate_used}</TableCell>
                            <TableCell className="font-semibold font-mono">€{r.total_amount.toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default PayrollPage;
