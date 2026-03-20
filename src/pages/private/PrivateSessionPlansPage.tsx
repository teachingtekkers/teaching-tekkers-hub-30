import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Plus, Trash2, GripVertical, Clock, ChevronLeft, ChevronRight, Save, ExternalLink, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const PROGRAMME_TYPES = [
  { value: "academy", label: "Teaching Tekkers Academy" },
  { value: "small_group", label: "Teaching Tekkers Small Group Session" },
  { value: "individual", label: "Teaching Tekkers Individual Session" },
  { value: "community", label: "Teaching Tekkers Community Session" },
];

const PRACTICE_TYPES = [
  "Warm Up", "Sport Science", "Technical", "Tactical", "Small Sided Game",
  "Shooting", "Passing", "Dribbling", "1v1", "Goalkeeping", "Cool Down",
  "Fun Game", "Match Play", "Fitness", "Other",
];

interface WeeklyPlan {
  id: string;
  week_number: number;
  programme_type: string;
  week_date: string | null;
  notes: string;
}

interface PlanDrill {
  id: string;
  weekly_plan_id: string;
  sort_order: number;
  practice_type: string;
  duration_minutes: number;
  session_plan_id: string | null;
  custom_drill_name: string;
  notes: string;
  session_plans?: any;
}

export default function PrivateSessionPlansPage() {
  const qc = useQueryClient();
  const [weekNumber, setWeekNumber] = useState(1);
  const [programmeType, setProgrammeType] = useState("academy");
  const [addDrillOpen, setAddDrillOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [drillPracticeType, setDrillPracticeType] = useState("Warm Up");
  const [drillDuration, setDrillDuration] = useState(15);
  const [drillNotes, setDrillNotes] = useState("");
  const [expandedDrill, setExpandedDrill] = useState<string | null>(null);

  // Fetch the weekly plan for current week+programme
  const { data: plan } = useQuery({
    queryKey: ["private-weekly-plan", weekNumber, programmeType],
    queryFn: async () => {
      const { data } = await supabase
        .from("private_weekly_plans")
        .select("*")
        .eq("week_number", weekNumber)
        .eq("programme_type", programmeType)
        .maybeSingle();
      return data as WeeklyPlan | null;
    },
  });

  // Fetch drills for this plan
  const { data: drills = [] } = useQuery({
    queryKey: ["private-weekly-plan-drills", plan?.id],
    queryFn: async () => {
      if (!plan?.id) return [];
      const { data } = await supabase
        .from("private_weekly_plan_drills")
        .select("*, session_plans(id, title, age_group, description, organisation, other_comments, coaching_points, equipment, diagram_image_url, video_url, content, player_numbers, category_id, session_plan_categories(name))")
        .eq("weekly_plan_id", plan.id)
        .order("sort_order");
      return (data || []) as PlanDrill[];
    },
    enabled: !!plan?.id,
  });

  // Fetch all session plans for picker
  const { data: allPlans = [] } = useQuery({
    queryKey: ["session-plans-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("session_plans")
        .select("id, title, age_group, category_id, session_plan_categories(name)")
        .order("title");
      return data || [];
    },
  });

  // Create plan if it doesn't exist
  const ensurePlan = useMutation({
    mutationFn: async () => {
      if (plan) return plan;
      const { data, error } = await supabase
        .from("private_weekly_plans")
        .insert({ week_number: weekNumber, programme_type: programmeType })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-weekly-plan", weekNumber, programmeType] });
    },
  });

  // Add drill
  const addDrill = useMutation({
    mutationFn: async () => {
      let planId = plan?.id;
      if (!planId) {
        const created = await ensurePlan.mutateAsync();
        planId = created.id;
      }
      const nextOrder = drills.length;
      const selectedSession = allPlans.find((p: any) => p.id === selectedPlanId);
      const { error } = await supabase.from("private_weekly_plan_drills").insert({
        weekly_plan_id: planId,
        sort_order: nextOrder,
        practice_type: drillPracticeType,
        duration_minutes: drillDuration,
        session_plan_id: selectedPlanId || null,
        custom_drill_name: selectedPlanId ? "" : drillNotes,
        notes: drillNotes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-weekly-plan-drills"] });
      qc.invalidateQueries({ queryKey: ["private-weekly-plan"] });
      toast.success("Drill added");
      setAddDrillOpen(false);
      setSelectedPlanId("");
      setDrillNotes("");
      setDrillDuration(15);
    },
    onError: () => toast.error("Failed to add drill"),
  });

  // Remove drill
  const removeDrill = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("private_weekly_plan_drills").delete().eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-weekly-plan-drills"] });
      toast.success("Drill removed");
    },
  });

  const totalDuration = drills.reduce((s, d) => s + d.duration_minutes, 0);

  const getDrillName = (d: PlanDrill) => {
    if (d.session_plans?.title) return d.session_plans.title;
    return d.custom_drill_name || "Unnamed Drill";
  };

  const programmeLabel = PROGRAMME_TYPES.find(p => p.value === programmeType)?.label || programmeType;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Weekly Session Planner</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Plan weekly coaching sessions using the Session Plans library
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Programme Type</Label>
          <Select value={programmeType} onValueChange={setProgrammeType}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROGRAMME_TYPES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Week</Label>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9"
              onClick={() => setWeekNumber(Math.max(1, weekNumber - 1))}
              disabled={weekNumber <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[80px] text-center">Week {weekNumber}</span>
            <Button variant="outline" size="icon" className="h-9 w-9"
              onClick={() => setWeekNumber(weekNumber + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Programme header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{programmeLabel}</CardTitle>
              <CardDescription>Week {weekNumber} · {drills.length} drill{drills.length !== 1 ? "s" : ""} · {totalDuration} min total</CardDescription>
            </div>
            <Button size="sm" onClick={() => {
              setAddDrillOpen(true);
              setSelectedPlanId("");
              setDrillPracticeType("Warm Up");
              setDrillDuration(15);
              setDrillNotes("");
            }}>
              <Plus className="h-4 w-4 mr-1" />Add Drill
            </Button>
          </div>
        </CardHeader>

        {/* Overview table */}
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Practice Type</TableHead>
                <TableHead>Drill Name</TableHead>
                <TableHead className="text-center w-24">Duration</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No drills added yet. Add drills from the Session Plans library.
                  </TableCell>
                </TableRow>
              ) : drills.map((d, idx) => (
                <TableRow
                  key={d.id}
                  className={`cursor-pointer transition-colors ${expandedDrill === d.id ? "bg-muted/50" : "hover:bg-muted/30"}`}
                  onClick={() => setExpandedDrill(expandedDrill === d.id ? null : d.id)}
                >
                  <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{d.practice_type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-1.5">
                      {d.session_plans && <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />}
                      {getDrillName(d)}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="flex items-center justify-center gap-1 text-sm">
                      <Clock className="h-3 w-3 text-muted-foreground" />{d.duration_minutes}m
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); removeDrill.mutate(d.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {drills.length > 0 && (
                <TableRow className="bg-muted/30">
                  <TableCell colSpan={3} className="text-right text-sm font-medium text-muted-foreground">Total Duration</TableCell>
                  <TableCell className="text-center font-bold text-sm">{totalDuration}m</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Expanded drill detail */}
      {expandedDrill && (() => {
        const d = drills.find(dr => dr.id === expandedDrill);
        if (!d?.session_plans) return (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground text-sm">
              This drill is not linked to a Session Plan. Link it to see full details.
            </CardContent>
          </Card>
        );
        const sp = d.session_plans;
        return (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{sp.title}</CardTitle>
                  <div className="flex gap-2 mt-1">
                    {sp.age_group && <Badge variant="outline">{sp.age_group}</Badge>}
                    {sp.session_plan_categories?.name && <Badge variant="secondary">{sp.session_plan_categories.name}</Badge>}
                    {sp.player_numbers && <Badge variant="outline" className="text-xs">Players: {sp.player_numbers}</Badge>}
                  </div>
                </div>
                {sp.video_url && (
                  <a href={sp.video_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />Watch Video
                    </Button>
                  </a>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Left: text details */}
                <div className="space-y-3">
                  {sp.description && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</h4>
                      <p className="text-sm whitespace-pre-line">{sp.description}</p>
                    </div>
                  )}
                  {sp.organisation && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Organisation</h4>
                      <p className="text-sm whitespace-pre-line">{sp.organisation}</p>
                    </div>
                  )}
                  {sp.coaching_points && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Coaching Points</h4>
                      <p className="text-sm whitespace-pre-line">{sp.coaching_points}</p>
                    </div>
                  )}
                  {sp.other_comments && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Other Comments</h4>
                      <p className="text-sm whitespace-pre-line">{sp.other_comments}</p>
                    </div>
                  )}
                  {sp.equipment && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Equipment</h4>
                      <p className="text-sm">{sp.equipment}</p>
                    </div>
                  )}
                </div>
                {/* Right: diagram */}
                <div>
                  {sp.diagram_image_url ? (
                    <div className="rounded-lg overflow-hidden border">
                      <img src={sp.diagram_image_url} alt={sp.title} className="w-full h-auto" />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed flex items-center justify-center h-48 text-muted-foreground">
                      <div className="text-center">
                        <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p className="text-xs">No diagram available</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Add Drill Dialog */}
      <Dialog open={addDrillOpen} onOpenChange={setAddDrillOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Drill to Week {weekNumber}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Practice Type</Label>
              <Select value={drillPracticeType} onValueChange={setDrillPracticeType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRACTICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Session Plan (from library)</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger><SelectValue placeholder="Select a session plan…" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {allPlans.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title} {p.session_plan_categories?.name ? `(${p.session_plan_categories.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input type="number" value={drillDuration} onChange={e => setDrillDuration(parseInt(e.target.value) || 15)} min={1} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={drillNotes} onChange={e => setDrillNotes(e.target.value)} rows={2} placeholder="Optional notes…" />
            </div>
            <Button className="w-full" disabled={addDrill.isPending} onClick={() => addDrill.mutate()}>
              {addDrill.isPending ? "Adding…" : "Add Drill"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
