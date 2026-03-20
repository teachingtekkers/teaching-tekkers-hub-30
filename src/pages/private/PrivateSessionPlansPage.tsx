import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Plus, Trash2, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { toast } from "sonner";

export default function PrivateSessionPlansPage() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [assignDialog, setAssignDialog] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("");
  const weekDateStr = format(weekStart, "yyyy-MM-dd");

  const { data: sessions = [] } = useQuery({
    queryKey: ["private-sessions"],
    queryFn: async () => {
      const { data } = await supabase.from("private_session_groups").select("*, private_venues(name)").eq("status", "active").order("day_of_week");
      return data || [];
    },
  });

  const { data: planLinks = [] } = useQuery({
    queryKey: ["private-plan-links", weekDateStr],
    queryFn: async () => {
      const { data } = await supabase.from("private_session_plan_links")
        .select("*, session_plans(id, title, age_group, category_id, session_plan_categories(name))")
        .eq("week_date", weekDateStr);
      return data || [];
    },
  });

  const { data: allPlans = [] } = useQuery({
    queryKey: ["session-plans-list"],
    queryFn: async () => {
      const { data } = await supabase.from("session_plans").select("id, title, age_group, category_id, session_plan_categories(name)").order("title");
      return data || [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignDialog || !selectedPlan) return;
      const { error } = await supabase.from("private_session_plan_links").upsert({
        session_group_id: assignDialog,
        session_plan_id: selectedPlan,
        week_date: weekDateStr,
      }, { onConflict: "session_group_id,week_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-plan-links"] });
      toast.success("Session plan assigned");
      setAssignDialog(null); setSelectedPlan("");
    },
    onError: () => toast.error("Failed to assign"),
  });

  const removeMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await supabase.from("private_session_plan_links").delete().eq("id", linkId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-plan-links"] });
      toast.success("Plan unlinked");
    },
  });

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const byDay = DAYS.map(day => ({
    day,
    sessions: sessions.filter((s: any) => s.day_of_week === day),
  })).filter(d => d.sessions.length > 0);

  const getLinkForGroup = (groupId: string) => planLinks.find((l: any) => l.session_group_id === groupId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Session Plans</h1>
        <p className="text-sm text-muted-foreground mt-1">Plan weekly sessions using the existing Session Plans library</p>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium min-w-[200px] text-center">
          Week of {format(weekStart, "dd MMM yyyy")}
        </span>
        <Button variant="outline" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {byDay.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No session groups created yet. Add sessions first.</CardContent></Card>
      ) : (
        byDay.map(({ day, sessions: daySessions }) => (
          <div key={day} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{day}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {daySessions.map((s: any) => {
                const link = getLinkForGroup(s.id);
                const plan = link?.session_plans;
                return (
                  <Card key={s.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{s.group_name || "Unnamed"}</CardTitle>
                      <CardDescription>{(s.private_venues as any)?.name} · {s.start_time}–{s.end_time}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {plan ? (
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium flex items-center gap-1">
                                <BookOpen className="h-3.5 w-3.5 text-primary" />{plan.title}
                              </p>
                              <div className="flex gap-1 mt-1">
                                {plan.age_group && <Badge variant="outline" className="text-xs">{plan.age_group}</Badge>}
                                {(plan as any).session_plan_categories?.name && <Badge variant="secondary" className="text-xs">{(plan as any).session_plan_categories.name}</Badge>}
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeMutation.mutate(link.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="w-full" onClick={() => { setAssignDialog(s.id); setSelectedPlan(""); }}>
                          <Plus className="h-3.5 w-3.5 mr-1" />Assign Session Plan
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Session Plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Select Session Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger><SelectValue placeholder="Choose a plan…" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {allPlans.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} {(p as any).session_plan_categories?.name ? `(${(p as any).session_plan_categories.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!selectedPlan || assignMutation.isPending} onClick={() => assignMutation.mutate()}>
              {assignMutation.isPending ? "Assigning…" : "Assign Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
