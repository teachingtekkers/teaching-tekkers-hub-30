import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Car, CheckCircle, UserPlus, XCircle, GripVertical, Zap } from "lucide-react";
import type { RosterCamp, DailyAssignment, RosterCoach, ExperienceLevel } from "@/pages/RosterPage";
import { getCampDays } from "@/pages/RosterPage";

interface Props {
  camp: RosterCamp;
  assignments: DailyAssignment[];
  coaches: RosterCoach[];
  unassignedCoaches: RosterCoach[];
  onRemove: (id: string) => void;
  onAdd: (campId: string, coachId: string, role: "head_coach" | "assistant") => void;
  onAddDay1Support: (campId: string, coachId: string) => void;
  onChangeRole: (id: string, role: "head_coach" | "assistant") => void;
  onToggleDay: (assignmentId: string, day: string) => void;
  onToggleDriving: (assignmentId: string) => void;
  onToggleCampAccess: (assignmentId: string) => void;
  onDragStart: (coachId: string, fromCampId: string | null) => void;
  onDrop: () => void;
  availabilitySet: boolean;
}

const EXP_LABELS: Record<ExperienceLevel, { short: string; color: string }> = {
  lead: { short: "L", color: "bg-purple-100 text-purple-800" },
  senior: { short: "S", color: "bg-blue-100 text-blue-800" },
  standard: { short: "St", color: "bg-emerald-100 text-emerald-800" },
  junior: { short: "J", color: "bg-amber-100 text-amber-800" },
};

export function RosterDailyGrid({
  camp, assignments, coaches, unassignedCoaches,
  onRemove, onAdd, onAddDay1Support, onChangeRole, onToggleDay, onToggleDriving, onDragStart, onDrop, availabilitySet
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [day1DialogOpen, setDay1DialogOpen] = useState(false);
  const [selCoach, setSelCoach] = useState("");
  const [selRole, setSelRole] = useState<"head_coach" | "assistant">("assistant");
  const [dragOver, setDragOver] = useState(false);

  const campDays = getCampDays(camp);
  const dayStrings = campDays.map(d => format(d, "yyyy-MM-dd"));

  const hasHeadCoach = assignments.some(a => a.role === "head_coach");
  const hasDriverThisWeek = assignments.some(a => a.driving_this_week);
  const staffed = assignments.filter(a => !a.is_day1_support).length >= camp.required_coaches;
  const status = staffed && hasHeadCoach ? "ready" : staffed && !hasHeadCoach ? "review" : "action";

  const statusBadge = () => {
    if (status === "ready") return <Badge className="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20 text-[10px]"><CheckCircle className="mr-1 h-3 w-3" />Ready</Badge>;
    if (status === "review") return <Badge className="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 text-[10px]"><AlertTriangle className="mr-1 h-3 w-3" />Review</Badge>;
    return <Badge variant="destructive" className="text-[10px]"><XCircle className="mr-1 h-3 w-3" />Needs Staff</Badge>;
  };

  const handleAdd = () => {
    if (!selCoach) return;
    onAdd(camp.id, selCoach, selRole);
    setDialogOpen(false); setSelCoach(""); setSelRole("assistant");
  };

  const handleAddDay1 = () => {
    if (!selCoach) return;
    onAddDay1Support(camp.id, selCoach);
    setDay1DialogOpen(false); setSelCoach("");
  };

  // Transport summary
  const driversThisWeek = assignments.filter(a => a.driving_this_week);
  const passengersThisWeek = assignments.filter(a => !a.driving_this_week);

  return (
    <Card
      className={`transition-colors ${dragOver ? "border-primary ring-2 ring-primary/20" : ""}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(); }}
    >
      <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{camp.name}</h3>
            <Badge variant="outline" className="text-[10px]">{camp.county}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{camp.club_name} · {camp.venue}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {statusBadge()}
          <Badge variant="secondary" className="text-[10px]">{camp.player_count} players</Badge>
          <Badge variant="outline" className="text-[10px]">{assignments.filter(a => !a.is_day1_support).length}/{camp.required_coaches} coaches</Badge>
          {!hasDriverThisWeek && assignments.length > 0 && (
            <Badge variant="destructive" className="text-[10px]"><Car className="mr-1 h-3 w-3" />No driver</Badge>
          )}
        </div>
      </div>

      <CardContent className="p-0">
        {assignments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-6 p-2"></th>
                  <th className="text-left p-2 font-semibold min-w-[150px]">Coach</th>
                  <th className="text-left p-2 font-semibold w-[90px]">Role</th>
                  <th className="text-center p-2 font-semibold w-[60px]">Drive</th>
                  {campDays.map(d => (
                    <th key={d.toISOString()} className="text-center p-2 font-semibold w-[60px]">
                      <div>{format(d, "EEE")}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{format(d, "d MMM")}</div>
                    </th>
                  ))}
                  <th className="p-2 w-[40px] text-center font-semibold">Days</th>
                  <th className="p-2 w-[40px]"></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => {
                  const coach = coaches.find(c => c.id === a.coach_id);
                  if (!coach) return null;
                  const exp = EXP_LABELS[coach.experience_level] || EXP_LABELS.standard;

                  return (
                    <tr
                      key={a.id}
                      draggable
                      onDragStart={() => onDragStart(a.coach_id, camp.id)}
                      className={`border-b last:border-b-0 cursor-grab active:cursor-grabbing hover:bg-muted/20 ${a.is_day1_support ? "bg-amber-50/50" : ""}`}
                    >
                      <td className="p-2 text-muted-foreground"><GripVertical className="h-3.5 w-3.5" /></td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{coach.full_name}</span>
                          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${exp.color}`}>{exp.short}</Badge>
                          {a.is_day1_support && (
                            <Badge className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0">D1</Badge>
                          )}
                        </div>
                        {coach.county && <span className="text-[10px] text-muted-foreground">{coach.county}</span>}
                      </td>
                      <td className="p-2">
                        <Select value={a.role} onValueChange={(v) => onChangeRole(a.id, v as "head_coach" | "assistant")}>
                          <SelectTrigger className="h-6 w-[80px] text-[10px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="head_coach">Head Coach</SelectItem>
                            <SelectItem value="assistant">Assistant</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 text-center">
                        {coach.can_drive ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => onToggleDriving(a.id)}
                                  className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors ${
                                    a.driving_this_week
                                      ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  }`}
                                >
                                  <Car className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{a.driving_this_week ? "Driving this week — click to remove" : "Can drive — click to assign as driver"}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      {dayStrings.map(day => {
                        const isActive = a.days.includes(day);
                        return (
                          <td key={day} className="p-1 text-center">
                            <button
                              onClick={() => onToggleDay(a.id, day)}
                              className={`w-full h-7 rounded transition-colors text-[10px] font-semibold ${
                                isActive
                                  ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]"
                                  : "bg-destructive/15 text-destructive"
                              }`}
                            >
                              {isActive ? "✓" : "✗"}
                            </button>
                          </td>
                        );
                      })}
                      <td className="p-2 text-center font-semibold">{a.days.length}</td>
                      <td className="p-2">
                        <Button variant="ghost" size="sm" onClick={() => onRemove(a.id)} className="text-destructive hover:text-destructive h-6 text-[10px] px-2">✗</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!hasHeadCoach && assignments.length > 0 && (
          <p className="text-xs text-destructive flex items-center gap-1 px-4 py-2 border-t">
            <AlertTriangle className="h-3 w-3" /> No head coach assigned
          </p>
        )}

        {/* Transport summary */}
        {driversThisWeek.length > 0 && passengersThisWeek.length > 0 && (
          <div className="px-4 py-1.5 border-t bg-muted/20">
            <p className="text-[10px] text-muted-foreground font-medium">
              🚗 {driversThisWeek.map(d => coaches.find(c => c.id === d.coach_id)?.full_name?.split(" ")[0]).join(", ")} → {passengersThisWeek.map(p => coaches.find(c => c.id === p.coach_id)?.full_name?.split(" ")[0]).join(", ")}
            </p>
          </div>
        )}

        {availabilitySet && (
          <div className="p-3 border-t flex flex-wrap gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-7"><UserPlus className="mr-1 h-3 w-3" /> Assign Coach</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Assign Coach to {camp.name}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Coach</Label>
                    <Select value={selCoach} onValueChange={setSelCoach}>
                      <SelectTrigger><SelectValue placeholder="Select coach" /></SelectTrigger>
                      <SelectContent>
                        {unassignedCoaches.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.full_name} {c.can_drive ? "🚗" : ""} {c.county ? `(${c.county})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={selRole} onValueChange={(v) => setSelRole(v as "head_coach" | "assistant")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="head_coach">Head Coach</SelectItem>
                        <SelectItem value="assistant">Assistant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAdd} className="w-full">Assign</Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={day1DialogOpen} onOpenChange={setDay1DialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-50">
                  <Zap className="mr-1 h-3 w-3" /> Day 1 Support
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Day 1 Support — {camp.name}</DialogTitle></DialogHeader>
                <p className="text-sm text-muted-foreground">This coach will only work the first day of camp.</p>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Coach</Label>
                    <Select value={selCoach} onValueChange={setSelCoach}>
                      <SelectTrigger><SelectValue placeholder="Select coach" /></SelectTrigger>
                      <SelectContent>
                        {unassignedCoaches.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.full_name} {c.can_drive ? "🚗" : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddDay1} className="w-full">Add Day 1 Support</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
