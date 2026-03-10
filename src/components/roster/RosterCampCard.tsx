import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Car, CheckCircle, UserPlus, XCircle, GripVertical, MapPin } from "lucide-react";
import type { RosterCamp, RosterAssignment, RosterCoach } from "@/pages/RosterPage";

interface Props {
  camp: RosterCamp;
  assignments: RosterAssignment[];
  coaches: RosterCoach[];
  allCoaches: RosterCoach[];
  unassignedCoaches: RosterCoach[];
  onRemove: (id: string) => void;
  onAdd: (campId: string, coachId: string, role: "head_coach" | "assistant") => void;
  onChangeRole: (id: string, role: "head_coach" | "assistant") => void;
  onDragStart: (coachId: string, fromCampId: string | null) => void;
  onDrop: () => void;
  availabilitySet: boolean;
}

export function RosterCampCard({
  camp, assignments, coaches, unassignedCoaches,
  onRemove, onAdd, onChangeRole, onDragStart, onDrop, availabilitySet
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selCoach, setSelCoach] = useState("");
  const [selRole, setSelRole] = useState<"head_coach" | "assistant">("assistant");
  const [dragOver, setDragOver] = useState(false);

  const hasHeadCoach = assignments.some(a => a.role === "head_coach");
  const hasDriver = assignments.some(a => {
    const c = coaches.find(co => co.id === a.coach_id);
    return c?.can_drive;
  });
  const staffed = assignments.length >= camp.required_coaches;

  const status = staffed && hasHeadCoach ? "ready" : staffed && !hasHeadCoach ? "review" : "action";

  const statusBadge = () => {
    if (status === "ready") return <Badge className="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20 text-[10px]"><CheckCircle className="mr-1 h-3 w-3" />Ready</Badge>;
    if (status === "review") return <Badge className="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 text-[10px]"><AlertTriangle className="mr-1 h-3 w-3" />Review</Badge>;
    return <Badge variant="destructive" className="text-[10px]"><XCircle className="mr-1 h-3 w-3" />Needs Staff</Badge>;
  };

  const handleAdd = () => {
    if (!selCoach) return;
    onAdd(camp.id, selCoach, selRole);
    setDialogOpen(false);
    setSelCoach("");
    setSelRole("assistant");
  };

  return (
    <Card
      className={`transition-colors ${dragOver ? "border-primary ring-2 ring-primary/20" : ""}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(); }}
    >
      {/* Header */}
      <div className="p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{camp.name}</h3>
            <Badge variant="outline" className="text-[10px]">{camp.county}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{camp.club_name} · {camp.venue}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {statusBadge()}
          <Badge variant="secondary" className="text-xs">{camp.player_count} players</Badge>
          <Badge variant="outline" className="text-xs">{assignments.length}/{camp.required_coaches} coaches</Badge>
          {!hasDriver && assignments.length > 0 && (
            <Badge variant="destructive" className="text-[10px]"><Car className="mr-1 h-3 w-3" />No driver</Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4 sm:p-5 space-y-3">
        {assignments.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Pickups</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map(a => {
                  const coach = coaches.find(c => c.id === a.coach_id);
                  if (!coach) return null;
                  return (
                    <TableRow
                      key={a.id}
                      draggable
                      onDragStart={() => onDragStart(a.coach_id, camp.id)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <TableCell className="w-8 text-muted-foreground"><GripVertical className="h-4 w-4" /></TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{coach.full_name}</span>
                          {coach.county && <span className="text-xs text-muted-foreground ml-1.5">({coach.county})</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select value={a.role} onValueChange={(v) => onChangeRole(a.id, v as "head_coach" | "assistant")}>
                          <SelectTrigger className="h-7 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="head_coach">Head Coach</SelectItem>
                            <SelectItem value="assistant">Assistant</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {coach.can_drive ? (
                          <Badge variant="secondary" className="text-[10px]"><Car className="h-3 w-3 mr-1" />Yes</Badge>
                        ) : <span className="text-xs text-muted-foreground">No</span>}
                      </TableCell>
                      <TableCell>
                        {coach.pickup_locations && coach.pickup_locations.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {coach.pickup_locations.slice(0, 2).map((loc, i) => (
                              <Badge key={i} variant="outline" className="text-[10px]"><MapPin className="h-2.5 w-2.5 mr-0.5" />{loc}</Badge>
                            ))}
                            {coach.pickup_locations.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{coach.pickup_locations.length - 2}</Badge>
                            )}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => onRemove(a.id)} className="text-destructive hover:text-destructive h-7 text-xs">
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {!hasHeadCoach && assignments.length > 0 && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> No head coach assigned
          </p>
        )}

        {availabilitySet && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="mr-2 h-4 w-4" /> Assign Coach
              </Button>
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
                          {c.full_name} {c.can_drive ? "🚗" : ""} {(c.is_head_coach || c.role_type === "head_coach") ? "⭐" : ""}
                          {c.county ? ` (${c.county})` : ""}
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
        )}
      </CardContent>
    </Card>
  );
}
