import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Loader2, Search } from "lucide-react";

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
  other_comments: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
}

export default function CoachSessionPlansPage() {
  const [viewPlan, setViewPlan] = useState<SessionPlanRow | null>(null);
  const [search, setSearch] = useState("");

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["all-session-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("session_plans").select("*").order("title");
      return (data || []) as unknown as SessionPlanRow[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["session-plan-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("session_plan_categories").select("id, name");
      return (data || []) as CategoryRow[];
    },
  });

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "Uncategorised";
    return categories.find(c => c.id === catId)?.name || "Uncategorised";
  };

  const filtered = plans.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) || getCategoryName(p.category_id).toLowerCase().includes(q);
  });

  // Group by category
  const grouped = filtered.reduce<Record<string, SessionPlanRow[]>>((acc, p) => {
    const cat = getCategoryName(p.category_id);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  if (plansLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-xl font-bold text-foreground">Session Plans</h1>
        <p className="text-sm text-muted-foreground">Browse all coaching drills and session plans</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search plans…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No session plans found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catPlans]) => (
            <div key={cat}>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">{cat} ({catPlans.length})</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {catPlans.map(plan => (
                  <Card key={plan.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewPlan(plan)}>
                    <CardContent className="p-4 space-y-2">
                      <h3 className="font-semibold text-sm">{plan.title}</h3>
                      <Badge variant="secondary" className="text-xs">{plan.age_group}</Badge>
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
                {viewPlan.diagram_image_url && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Diagram</p>
                    <img src={viewPlan.diagram_image_url} alt={viewPlan.title} className="w-full rounded-lg border" />
                  </div>
                )}
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
                {viewPlan.organisation && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Organisation</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{viewPlan.organisation}</p>
                  </div>
                )}
                {viewPlan.equipment && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Equipment</p>
                    <p className="text-sm text-muted-foreground">{viewPlan.equipment}</p>
                  </div>
                )}
                {viewPlan.video_url && (
                  <div>
                    <a href={viewPlan.video_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Watch Video</a>
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
