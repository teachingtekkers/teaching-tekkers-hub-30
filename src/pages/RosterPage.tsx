import { useState } from "react";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { CalendarIcon, UserPlus, AlertTriangle, CheckCircle, XCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatCard } from "@/components/StatCard";
import { cn } from "@/lib/utils";
import { mockCamps, mockBookings, mockCoaches, mockCampCoaches, getCoachesRequired } from "@/data/mock";
import { CampCoachAssignment } from "@/types";

const RosterPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date("2026-03-09"));
  const [assignments, setAssignments] = useState<CampCoachAssignment[]>(mockCampCoaches);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedCampId, setSelectedCampId] = useState<string>("");
  const [selectedCoachId, setSelectedCoachId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<"head_coach" | "assistant">("assistant");
  const [assignNotes, setAssignNotes] = useState("");

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  const weekCamps = mockCamps.filter(camp => {
    const campStart = parseISO(camp.start_date);
    const campEnd = parseISO(camp.end_date);
    return campStart <= weekEnd && campEnd >= weekStart;
  });

  const getPlayerCount = (campId: string) => mockBookings.filter(b => b.camp_id === campId).length;
  const getCampAssignments = (campId: string) => assignments.filter(a => a.camp_id === campId);

  const getStaffingStatus = (campId: string) => {
    const playerCount = getPlayerCount(campId);
    const required = getCoachesRequired(playerCount);
    const assigned = getCampAssignments(campId);
    const hasHeadCoach = assigned.some(a => a.role === "head_coach");
    if (assigned.length >= required && hasHeadCoach) return "ready";
    if (assigned.length >= required && !hasHeadCoach) return "review";
    return "action";
  };

  const handleAssign = () => {
    if (!selectedCampId || !selectedCoachId) return;
    const existing = assignments.find(a => a.camp_id === selectedCampId && a.coach_id === selectedCoachId);
    if (existing) return;
    const newAssignment: CampCoachAssignment = {
      id: String(assignments.length + 1),
      camp_id: selectedCampId,
      coach_id: selectedCoachId,
      role: selectedRole,
      notes: assignNotes || null,
      created_at: new Date().toISOString(),
    };
    setAssignments([...assignments, newAssignment]);
    setAssignDialogOpen(false);
    setSelectedCoachId("");
    setSelectedRole("assistant");
    setAssignNotes("");
  };

  const handleRemove = (assignmentId: string) => {
    setAssignments(assignments.filter(a => a.id !== assignmentId));
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "ready":
        return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]"><CheckCircle className="mr-1 h-3 w-3" />Ready</Badge>;
      case "review":
        return <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]"><AlertTriangle className="mr-1 h-3 w-3" />Review</Badge>;
      default:
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Action Needed</Badge>;
    }
  };

  const availableCoaches = (campId: string) => {
    const assigned = getCampAssignments(campId).map(a => a.coach_id);
    return mockCoaches.filter(c => !assigned.includes(c.id));
  };

  const readyCount = weekCamps.filter(c => getStaffingStatus(c.id) === "ready").length;
  const totalAssigned = weekCamps.reduce((sum, c) => sum + getCampAssignments(c.id).length, 0);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Coach Roster</h1>
          <p className="text-muted-foreground text-sm">Week of {format(weekStart, "d MMM")} — {format(weekEnd, "d MMM yyyy")}</p>
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

      <div className="stat-grid">
        <StatCard label="Camps This Week" value={weekCamps.length} />
        <StatCard label="Coaches Assigned" value={totalAssigned} />
        <StatCard label="Fully Staffed" value={`${readyCount}/${weekCamps.length}`} />
      </div>

      {weekCamps.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No camps scheduled this week</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Select a different week to view the roster</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {weekCamps.map(camp => {
            const playerCount = getPlayerCount(camp.id);
            const required = getCoachesRequired(playerCount);
            const campAssignments = getCampAssignments(camp.id);
            const status = getStaffingStatus(camp.id);

            return (
              <Card key={camp.id}>
                <div className="p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{camp.name}</h3>
                    <p className="text-sm text-muted-foreground">{camp.club_name} · {camp.venue}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusBadge(status)}
                    <Badge variant="secondary">{playerCount} players</Badge>
                    <Badge variant="outline">{campAssignments.length}/{required} coaches</Badge>
                  </div>
                </div>
                <CardContent className="p-4 sm:p-5 space-y-3">
                  {campAssignments.length > 0 && (
                    <Card className="border shadow-none">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Coach</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Driver</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {campAssignments.map(a => {
                            const coach = mockCoaches.find(c => c.id === a.coach_id);
                            return (
                              <TableRow key={a.id}>
                                <TableCell className="font-medium">{coach?.full_name}</TableCell>
                                <TableCell>
                                  <Badge variant={a.role === "head_coach" ? "default" : "secondary"}>
                                    {a.role === "head_coach" ? "Head Coach" : "Assistant"}
                                  </Badge>
                                </TableCell>
                                <TableCell>{coach?.can_drive ? "🚗 Yes" : "No"}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{a.notes || "—"}</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" onClick={() => handleRemove(a.id)} className="text-destructive hover:text-destructive">Remove</Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </Card>
                  )}

                  {!campAssignments.some(a => a.role === "head_coach") && (
                    <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> No head coach assigned</p>
                  )}

                  <Dialog open={assignDialogOpen && selectedCampId === camp.id} onOpenChange={(open) => { setAssignDialogOpen(open); if (open) setSelectedCampId(camp.id); }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" onClick={() => setSelectedCampId(camp.id)}>
                        <UserPlus className="mr-2 h-4 w-4" />Assign Coach
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Assign Coach to {camp.name}</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label>Coach</Label>
                          <Select value={selectedCoachId} onValueChange={setSelectedCoachId}>
                            <SelectTrigger><SelectValue placeholder="Select coach" /></SelectTrigger>
                            <SelectContent>
                              {availableCoaches(camp.id).map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.full_name} {c.can_drive ? "🚗" : ""} {c.is_head_coach ? "⭐" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "head_coach" | "assistant")}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="head_coach">Head Coach</SelectItem>
                              <SelectItem value="assistant">Assistant</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Input value={assignNotes} onChange={(e) => setAssignNotes(e.target.value)} placeholder="Optional notes" />
                        </div>
                        <Button onClick={handleAssign} className="w-full">Assign</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RosterPage;
