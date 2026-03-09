import { useState } from "react";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { CalendarIcon, Eye, ClipboardCheck, DollarSign, FileText, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { mockCamps, mockBookings, mockCampCoaches, mockCoaches, mockPayrollRecords, mockAttendance, getCoachesRequired, getCampDays } from "@/data/mock";

const ControlCentrePage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date("2026-03-09"));
  const navigate = useNavigate();

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  const weekCamps = mockCamps.filter(camp => {
    const campStart = parseISO(camp.start_date);
    const campEnd = parseISO(camp.end_date);
    return campStart <= weekEnd && campEnd >= weekStart;
  });

  const getCampData = (campId: string) => {
    const playerCount = mockBookings.filter(b => b.camp_id === campId).length;
    const required = getCoachesRequired(playerCount);
    const assigned = mockCampCoaches.filter(a => a.camp_id === campId);
    const hasHeadCoach = assigned.some(a => a.role === "head_coach");

    let status: "ready" | "review" | "action";
    if (assigned.length >= required && hasHeadCoach) status = "ready";
    else if (assigned.length >= required && !hasHeadCoach) status = "review";
    else status = "action";

    // Estimated payroll
    const camp = mockCamps.find(c => c.id === campId)!;
    const days = getCampDays(camp.start_date, camp.end_date);
    const estPayroll = assigned.reduce((sum, a) => {
      const coach = mockCoaches.find(c => c.id === a.coach_id);
      if (!coach) return sum;
      const rate = a.role === "head_coach" ? coach.head_coach_daily_rate : coach.daily_rate;
      return sum + rate * days + (coach.fuel_allowance_eligible ? 20 : 0);
    }, 0);

    // Estimated club payment (attendance-based)
    const attendanceCount = new Set(
      mockAttendance.filter(a => a.camp_id === campId && a.status === "present").map(a => a.player_id)
    ).size;
    const estClubPayment = attendanceCount * 15;

    return { playerCount, required, assigned: assigned.length, hasHeadCoach, status, estPayroll, estClubPayment };
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]"><CheckCircle className="mr-1 h-3 w-3" />Ready</Badge>;
      case "review":
        return <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]"><AlertTriangle className="mr-1 h-3 w-3" />Review</Badge>;
      default:
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Action</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Weekly Control Centre</h1>
          <p className="text-muted-foreground">Week of {format(weekStart, "d MMM")} — {format(weekEnd, "d MMM yyyy")}</p>
        </div>
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
      </div>

      {weekCamps.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No camps scheduled this week.</p></CardContent></Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid gap-4 sm:hidden">
            {weekCamps.map(camp => {
              const data = getCampData(camp.id);
              return (
                <Card key={camp.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{camp.name}</p>
                        <p className="text-sm text-muted-foreground">{camp.club_name}</p>
                      </div>
                      {statusBadge(data.status)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Players:</span> {data.playerCount}</div>
                      <div><span className="text-muted-foreground">Coaches:</span> {data.assigned}/{data.required}</div>
                      <div><span className="text-muted-foreground">Est. Payroll:</span> €{data.estPayroll}</div>
                      <div><span className="text-muted-foreground">Club Payment:</span> €{data.estClubPayment}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate("/roster")}><Eye className="mr-1 h-3 w-3" />Roster</Button>
                      <Button variant="outline" size="sm" onClick={() => navigate("/attendance")}><ClipboardCheck className="mr-1 h-3 w-3" />Attendance</Button>
                      <Button variant="outline" size="sm" onClick={() => navigate("/payroll")}><DollarSign className="mr-1 h-3 w-3" />Payroll</Button>
                      <Button variant="outline" size="sm" onClick={() => navigate("/invoices")}><FileText className="mr-1 h-3 w-3" />Invoice</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Camp</TableHead>
                    <TableHead>Club</TableHead>
                    <TableHead>Players</TableHead>
                    <TableHead>Coaches</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Est. Payroll</TableHead>
                    <TableHead>Est. Club Payment</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekCamps.map(camp => {
                    const data = getCampData(camp.id);
                    return (
                      <TableRow key={camp.id}>
                        <TableCell className="font-medium">{camp.name}</TableCell>
                        <TableCell>{camp.club_name}</TableCell>
                        <TableCell>{data.playerCount}</TableCell>
                        <TableCell>{data.assigned}/{data.required}</TableCell>
                        <TableCell>{statusBadge(data.status)}</TableCell>
                        <TableCell>€{data.estPayroll}</TableCell>
                        <TableCell>€{data.estClubPayment}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" title="View Roster" onClick={() => navigate("/roster")}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Attendance" onClick={() => navigate("/attendance")}><ClipboardCheck className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Payroll" onClick={() => navigate("/payroll")}><DollarSign className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" title="Invoice" onClick={() => navigate("/invoices")}><FileText className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ControlCentrePage;
