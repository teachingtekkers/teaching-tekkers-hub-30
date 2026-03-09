import { Tent, Users, UserCog, ArrowRight, AlertTriangle, CheckCircle, ClipboardCheck, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockCamps, mockBookings, mockCoaches, mockCampCoaches, mockAttendance, mockPayrollRecords, getCoachesRequired } from "@/data/mock";

const DashboardPage = () => {
  const thisWeekCamps = mockCamps.filter(c => c.start_date <= '2026-03-13' && c.end_date >= '2026-03-09');
  const thisWeekPlayerCount = mockBookings.filter(b => thisWeekCamps.some(c => c.id === b.camp_id)).length;

  // Coaches assigned this week
  const thisWeekAssignments = mockCampCoaches.filter(a => thisWeekCamps.some(c => c.id === a.camp_id));
  const uniqueCoachesThisWeek = new Set(thisWeekAssignments.map(a => a.coach_id)).size;

  // Coaches required
  const totalRequired = thisWeekCamps.reduce((sum, camp) => {
    const players = mockBookings.filter(b => b.camp_id === camp.id).length;
    return sum + getCoachesRequired(players);
  }, 0);

  // Attendance completion
  const totalAttendanceExpected = thisWeekCamps.reduce((sum, camp) => {
    return sum + mockBookings.filter(b => b.camp_id === camp.id).length;
  }, 0);
  const attendanceMarked = mockAttendance.filter(a =>
    thisWeekCamps.some(c => c.id === a.camp_id) && a.date === '2026-03-09'
  ).length;

  // Estimated payroll
  const weekPayroll = mockPayrollRecords
    .filter(p => p.week_start === '2026-03-09')
    .reduce((sum, p) => sum + p.total_amount, 0);

  // Camps needing action
  const campsNeedingAction = thisWeekCamps.filter(camp => {
    const players = mockBookings.filter(b => b.camp_id === camp.id).length;
    const required = getCoachesRequired(players);
    const assigned = mockCampCoaches.filter(a => a.camp_id === camp.id);
    const hasHead = assigned.some(a => a.role === 'head_coach');
    return assigned.length < required || !hasHead;
  });

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Week of 9 – 13 March 2026</p>
      </div>

      <div className="stat-grid">
        <StatCard title="Camps This Week" value={thisWeekCamps.length} icon={Tent} description={`${thisWeekCamps.length} active`} />
        <StatCard title="Players Booked" value={thisWeekPlayerCount} icon={Users} description="Across all camps" />
        <StatCard
          title="Coaches"
          value={`${uniqueCoachesThisWeek} / ${totalRequired}`}
          icon={UserCog}
          description="Assigned / Required"
          variant={uniqueCoachesThisWeek < totalRequired ? "warning" : "success"}
        />
        <StatCard
          title="Est. Payroll"
          value={`€${weekPayroll.toLocaleString()}`}
          icon={DollarSign}
          description="This week"
        />
      </div>

      {/* Alerts */}
      {campsNeedingAction.length > 0 && (
        <Card className="border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.04)]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-[hsl(var(--warning))] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">Attention Required</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {campsNeedingAction.length} camp{campsNeedingAction.length > 1 ? 's' : ''} need staffing attention:{" "}
                  {campsNeedingAction.map(c => c.name).join(", ")}
                </p>
                <Link to="/roster" className="text-sm text-primary font-medium hover:underline mt-1 inline-block">
                  Open Roster →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* This Week's Camps - takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label !mb-0">This Week's Camps</p>
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
                    <TableHead className="text-center">Players</TableHead>
                    <TableHead className="text-center">Coaches</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {thisWeekCamps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No camps scheduled this week.
                      </TableCell>
                    </TableRow>
                  ) : (
                    thisWeekCamps.map(camp => {
                      const players = mockBookings.filter(b => b.camp_id === camp.id).length;
                      const required = getCoachesRequired(players);
                      const assigned = mockCampCoaches.filter(a => a.camp_id === camp.id);
                      const hasHead = assigned.some(a => a.role === 'head_coach');
                      const isReady = assigned.length >= required && hasHead;

                      return (
                        <TableRow key={camp.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{camp.name}</p>
                            <p className="text-xs text-muted-foreground">{camp.venue}</p>
                          </TableCell>
                          <TableCell className="text-sm">{camp.club_name}</TableCell>
                          <TableCell className="text-center text-sm font-medium">{players}</TableCell>
                          <TableCell className="text-center text-sm">
                            <span className={assigned.length < required ? "text-destructive font-medium" : ""}>
                              {assigned.length}/{required}
                            </span>
                          </TableCell>
                          <TableCell>
                            {isReady ? (
                              <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] text-xs">
                                <CheckCircle className="mr-1 h-3 w-3" />Ready
                              </Badge>
                            ) : (
                              <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] text-xs">
                                <AlertTriangle className="mr-1 h-3 w-3" />Review
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div>
            <p className="section-label">Quick Actions</p>
            <div className="space-y-2">
              {[
                { label: "Control Centre", to: "/control-centre", icon: ClipboardCheck, desc: "Weekly overview" },
                { label: "Manage Roster", to: "/roster", icon: UserCog, desc: "Coach assignments" },
                { label: "View Payroll", to: "/payroll", icon: DollarSign, desc: "This week's payroll" },
                { label: "Manage Camps", to: "/camps", icon: Tent, desc: "All camps" },
              ].map(link => (
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
            <p className="section-label">Attendance Today</p>
            <Card>
              <CardContent className="p-4 space-y-3">
                {thisWeekCamps.map(camp => {
                  const players = mockBookings.filter(b => b.camp_id === camp.id).length;
                  const marked = mockAttendance.filter(a => a.camp_id === camp.id && a.date === '2026-03-09').length;
                  const pct = players > 0 ? Math.round((marked / players) * 100) : 0;
                  return (
                    <div key={camp.id} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{camp.name}</span>
                        <span className="text-muted-foreground">{marked}/{players}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {thisWeekCamps.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">No camps today</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
