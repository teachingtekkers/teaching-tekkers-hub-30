import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function PrivateAttendancePage() {
  const qc = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState("");
  const [sessionDate, setSessionDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: sessions = [] } = useQuery({
    queryKey: ["private-sessions"],
    queryFn: async () => {
      const { data } = await supabase.from("private_session_groups").select("*, private_venues(name)").order("day_of_week");
      return data || [];
    },
  });

  const { data: childAssignments = [] } = useQuery({
    queryKey: ["private-child-assignments"],
    queryFn: async () => {
      const { data } = await supabase.from("private_child_assignments").select("*, private_children(id, first_name, last_name, medical_notes)");
      return data || [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["private-attendance", selectedGroup, sessionDate],
    queryFn: async () => {
      if (!selectedGroup) return [];
      const { data } = await supabase.from("private_attendance")
        .select("*")
        .eq("session_group_id", selectedGroup)
        .eq("session_date", sessionDate);
      return data || [];
    },
    enabled: !!selectedGroup,
  });

  const groupChildren = useMemo(() => {
    if (!selectedGroup) return [];
    return childAssignments
      .filter(a => a.session_group_id === selectedGroup)
      .map(a => a.private_children)
      .filter(Boolean);
  }, [childAssignments, selectedGroup]);

  const markMutation = useMutation({
    mutationFn: async ({ childId, status }: { childId: string; status: string }) => {
      const existing = attendance.find(a => a.child_id === childId);
      if (existing) {
        await supabase.from("private_attendance").update({ status }).eq("id", existing.id);
      } else {
        await supabase.from("private_attendance").insert({
          child_id: childId, session_group_id: selectedGroup, session_date: sessionDate, status,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["private-attendance", selectedGroup, sessionDate] }),
    onError: () => toast.error("Failed to save attendance"),
  });

  const getStatus = (childId: string) => attendance.find(a => a.child_id === childId)?.status;
  const selectedSession = sessions.find((s: any) => s.id === selectedGroup);
  const presentCount = groupChildren.filter(c => getStatus(c.id) === "present").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">Track private coaching attendance by session</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="w-72">
          <Label>Session Group</Label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
            <SelectContent>
              {sessions.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.day_of_week} – {s.group_name || "Unnamed"} ({(s.private_venues as any)?.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Session Date</Label>
          <Input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} className="w-44" />
        </div>
      </div>

      {selectedGroup && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                {selectedSession?.group_name || "Session"} — {format(new Date(sessionDate), "EEE dd MMM yyyy")}
              </CardTitle>
              <Badge variant="outline">{presentCount}/{groupChildren.length} present</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child</TableHead>
                  <TableHead>Medical</TableHead>
                  <TableHead className="text-center w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupChildren.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No children assigned to this session.</TableCell></TableRow>
                ) : groupChildren.map((c: any) => {
                  const status = getStatus(c.id);
                  return (
                    <TableRow key={c.id} className={status === "present" ? "bg-blue-50/60" : ""}>
                      <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                      <TableCell>
                        {c.medical_notes ? <Badge variant="destructive" className="text-xs">Medical</Badge> : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button size="sm" variant={status === "present" ? "default" : "outline"}
                            className="h-8 w-8 p-0" onClick={() => markMutation.mutate({ childId: c.id, status: "present" })}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant={status === "absent" ? "destructive" : "outline"}
                            className="h-8 w-8 p-0" onClick={() => markMutation.mutate({ childId: c.id, status: "absent" })}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
