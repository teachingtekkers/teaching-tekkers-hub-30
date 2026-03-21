import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Calendar, Loader2 } from "lucide-react";

interface SessionPlanRow {
  id: string;
  title: string;
  age_group: string;
  description: string | null;
  content: string | null;
  coaching_points: string | null;
  equipment: string | null;
  organisation: string | null;
  player_numbers: string | null;
  diagram_image_url: string | null;
  video_url: string | null;
  category_id: string | null;
}

interface AssignmentRow {
  id: string;
  camp_id: string;
  session_plan_id: string;
  camp_day: string | null;
}

interface CampRow {
  id: string;
  name: string;
  club_name: string;
}

interface CategoryRow {
  id: string;
  name: string;
}

export default function CoachSessionPlansPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [viewPlan, setViewPlan] = useState<SessionPlanRow | null>(null);
  const [groups, setGroups] = useState<{ camp: CampRow; plans: { assignment: AssignmentRow; plan: SessionPlanRow }[] }[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("coach_id").eq("id", user.id).single();
      if (!profile?.coach_id) { setLoading(false); return; }

      const { data: assignments } = await supabase.from("camp_coach_assignments").select("camp_id").eq("coach_id", profile.coach_id);
      const campIds = (assignments || []).map(a => a.camp_id);
      if (campIds.length === 0) { setLoading(false); return; }

      const [campsRes, spAssignRes, catsRes] = await Promise.all([
        supabase.from("camps").select("id, name, club_name").in("id", campIds),
        supabase.from("session_plan_assignments").select("id, camp_id, session_plan_id, camp_day").in("camp_id", campIds),
        supabase.from("session_plan_categories").select("id, name"),
      ]);

      const campsMap = new Map((campsRes.data || []).map(c => [c.id, c as CampRow]));
      setCategories((catsRes.data || []) as CategoryRow[]);

      const spIds = [...new Set((spAssignRes.data || []).map(a => a.session_plan_id))];
      let plansMap = new Map<string, SessionPlanRow>();
      if (spIds.length > 0) {
        const { data: plans } = await supabase.from("session_plans").select("*").in("id", spIds);
        plansMap = new Map((plans || []).map(p => [p.id, p as unknown as SessionPlanRow]));
      }

      const result: typeof groups = [];
      for (const campId of campIds) {
        const camp = campsMap.get(campId);
        if (!camp) continue;
        const campAssigns = (spAssignRes.data || []).filter(a => a.camp_id === campId) as AssignmentRow[];
        const planItems = campAssigns
          .map(a => ({ assignment: a, plan: plansMap.get(a.session_plan_id)! }))
          .filter(x => x.plan);
        if (planItems.length > 0) result.push({ camp, plans: planItems });
      }
      setGroups(result);
      setLoading(false);
    })();
  }, [user]);

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "Uncategorised";
    return categories.find(c => c.id === catId)?.name || "Uncategorised";
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-xl font-bold text-foreground">Session Plans</h1>
        <p className="text-sm text-muted-foreground">Your assigned camp session plans</p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No session plans assigned yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Plans will appear here when assigned to your camps</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {groups.map(({ camp, plans }) => (
            <div key={camp.id}>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">{camp.name} — {camp.club_name}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map(({ assignment, plan }) => (
                  <Card key={assignment.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewPlan(plan)}>
                    <CardContent className="p-4 space-y-2">
                      <h3 className="font-semibold text-sm">{plan.title}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{plan.age_group}</Badge>
                        <Badge variant="outline" className="text-xs">{getCategoryName(plan.category_id)}</Badge>
                      </div>
                      {assignment.camp_day && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" /> {assignment.camp_day}
                        </div>
                      )}
                      {plan.description && <p className="text-sm text-muted-foreground line-clamp-2">{plan.description}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!viewPlan} onOpenChange={() => setViewPlan(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {viewPlan && (
            <>
              <DialogHeader>
                <DialogTitle>{viewPlan.title}</DialogTitle>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="secondary">{viewPlan.age_group}</Badge>
                  <Badge variant="outline">{getCategoryName(viewPlan.category_id)}</Badge>
                </div>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {viewPlan.description && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</p>
                    <p className="text-sm text-muted-foreground">{viewPlan.description}</p>
                  </div>
                )}
                {viewPlan.content && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Session Content</p>
                    <div className="rounded-lg border p-4 bg-muted/30">
                      <pre className="text-sm whitespace-pre-wrap font-sans">{viewPlan.content}</pre>
                    </div>
                  </div>
                )}
                {viewPlan.coaching_points && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Coaching Points</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewPlan.coaching_points}</p>
                  </div>
                )}
                {viewPlan.equipment && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Equipment</p>
                    <p className="text-sm text-muted-foreground">{viewPlan.equipment}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
