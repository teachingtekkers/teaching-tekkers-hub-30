import { useState } from "react";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { CalendarIcon, Eye, ClipboardCheck, DollarSign, FileText, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronRight, Car, UserCog } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/StatCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { mockCamps, mockBookings, mockCampCoaches, mockCoaches, mockPayrollRecords, mockAttendance, getCoachesRequired, getCampDays } from "@/data/mock";
import { Tent, Users } from "lucide-react";

const ControlCentrePage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date("2026-03-09"));
  const [expandedCamp, setExpandedCamp] = useState<string | null>(null);
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

    const camp = mockCamps.find(c => c.id === campId)!;
    const days = getCampDays(camp.start_date, camp.end_date);
    const estPayroll = assigned.reduce((sum, a) => {
      const coach = mockCoaches.find(c => c.id === a.coach_id);
      if (!coach) return sum;
      const rate = a.role === "head_coach" ? coach.head_coach_daily_rate : coach.daily_rate;
      return sum + rate * days + (coach.fuel_allowance_eligible ? 20 : 0);
    }, 0);

    const attendanceCount = new Set(
      mockAttendance.filter(a => a.camp_id === campId && a.status === "present").map(a => a.player_id)
    ).size;
    const estClubPayment = attendanceCount * 15;

    return { playerCount, required, assigned, hasHeadCoach, status, estPayroll, estClubPayment, assignedCount: assigned.length };
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] text-xs gap-1"><CheckCircle className="h-3 w-3" />Ready</Badge>;
      case "review":
        return <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] text-xs gap-1"><AlertTriangle className="h-3 w-3" />Review</Badge>;
      default:
        return <Badge variant="destructive" className="text-xs gap-1"><XCircle className="h-3 w-3" />Action</Badge>;
    }
  };

  // Summary stats
  const totalPlayers = weekCamps.reduce((sum, c) => sum + mockBookings.filter(b => b.camp_id === c.id).length, 0);
  const totalPayroll = weekCamps.reduce((sum, c) => sum + getCampData(c.id).estPayroll, 0);
  const totalClubPayments = weekCamps.reduce((sum, c) => sum + getCampData(c.id).estClubPayment, 0);
  const actionCount = weekCamps.filter(c => getCampData(c.id).status === "action").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="page-header !mb-0">
          <h1>Weekly Control Centre</h1>
          <p>Week of {format(weekStart, "d MMM")} — {format(weekEnd, "d MMM yyyy")}</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[200px] justify-start text-left font-normal text-sm">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "PPP")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      <div className="stat-grid">
        <StatCard title="Camps" value={weekCamps.length} icon={Tent} description="This week" />
        <StatCard title="Total Players" value={totalPlayers} icon={Users} description="Booked across all camps" />
        <StatCard title="Est. Payroll" value={`€${totalPayroll.toLocaleString()}`} icon={DollarSign} description="Coach payments" />
        <StatCard
          title="Actions Needed"
          value={actionCount}
          icon={AlertTriangle}
          description="Camps need attention"
          variant={actionCount > 0 ? "destructive" : "success"}
        />
      </div>

      {weekCamps.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Tent className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No camps scheduled this week</p>
            <p className="text-sm text-muted-foreground mt-1">Select a different week to view camps.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {weekCamps.map(camp => {
            const data = getCampData(camp.id);
            const isExpanded = expandedCamp === camp.id;

            return (
              <Card key={camp.id} className={cn(
                "transition-shadow",
                data.status === "action" && "border-destructive/30",
                data.status === "review" && "border-[hsl(var(--warning)/0.3)]"
              )}>
                <Collapsible open={isExpanded} onOpenChange={() => setExpandedCamp(isExpanded ? null : camp.id)}>
                  <CollapsibleTrigger asChild>
                    <CardContent className="p-4 cursor-pointer hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="text-muted-foreground">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                            <p className="font-semibold text-sm">{camp.name}</p>
                            <span className="text-xs text-muted-foreground">{camp.club_name} • {camp.venue}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{camp.start_date} — {camp.end_date}</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Players</p>
                            <p className="font-semibold">{data.playerCount}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Coaches</p>
                            <p className={cn("font-semibold", data.assignedCount < data.required && "text-destructive")}>
                              {data.assignedCount}/{data.required}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Payroll</p>
                            <p className="font-semibold">€{data.estPayroll}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">Club</p>
                            <p className="font-semibold">€{data.estClubPayment}</p>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {statusBadge(data.status)}
                        </div>
                      </div>
                      {/* Mobile stats */}
                      <div className="grid grid-cols-4 gap-2 mt-3 sm:hidden text-xs text-center">
                        <div><span className="text-muted-foreground block">Players</span><span className="font-semibold">{data.playerCount}</span></div>
                        <div><span className="text-muted-foreground block">Coaches</span><span className="font-semibold">{data.assignedCount}/{data.required}</span></div>
                        <div><span className="text-muted-foreground block">Payroll</span><span className="font-semibold">€{data.estPayroll}</span></div>
                        <div><span className="text-muted-foreground block">Club</span><span className="font-semibold">€{data.estClubPayment}</span></div>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t px-4 py-4 bg-muted/30">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {/* Assigned Coaches */}
                        <div>
                          <p className="section-label">Assigned Coaches</p>
                          {data.assigned.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No coaches assigned.</p>
                          ) : (
                            <div className="space-y-2">
                              {data.assigned.map(a => {
                                const coach = mockCoaches.find(c => c.id === a.coach_id);
                                if (!coach) return null;
                                return (
                                  <div key={a.id} className="flex items-center gap-2 text-sm">
                                    <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-xs font-medium text-accent-foreground">
                                      {coach.full_name.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm">{coach.full_name}</p>
                                    </div>
                                    <div className="flex gap-1">
                                      {a.role === 'head_coach' && <Badge variant="default" className="text-[10px] px-1.5 py-0">HC</Badge>}
                                      {coach.can_drive && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Car className="h-2.5 w-2.5" /></Badge>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {!data.hasHeadCoach && (
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-[hsl(var(--warning))]">
                              <AlertTriangle className="h-3 w-3" /> No head coach assigned
                            </div>
                          )}
                        </div>

                        {/* Financial Preview */}
                        <div>
                          <p className="section-label">Financial Summary</p>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Est. Payroll</span>
                              <span className="font-medium">€{data.estPayroll}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Est. Club Payment</span>
                              <span className="font-medium">€{data.estClubPayment}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                              <span className="text-muted-foreground">Net</span>
                              <span className="font-semibold">€{data.estClubPayment - data.estPayroll}</span>
                            </div>
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div>
                          <p className="section-label">Actions</p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" className="justify-start text-xs" onClick={() => navigate("/roster")}>
                              <Eye className="mr-1.5 h-3 w-3" />Roster
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start text-xs" onClick={() => navigate("/attendance")}>
                              <ClipboardCheck className="mr-1.5 h-3 w-3" />Attendance
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start text-xs" onClick={() => navigate("/payroll")}>
                              <DollarSign className="mr-1.5 h-3 w-3" />Payroll
                            </Button>
                            <Button variant="outline" size="sm" className="justify-start text-xs" onClick={() => navigate("/invoices")}>
                              <FileText className="mr-1.5 h-3 w-3" />Invoice
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ControlCentrePage;
