import { useState } from "react";
import { BookOpen, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mockCamps, mockCampCoaches, mockSessionPlans, mockSessionAssignments, mockSessionCategories } from "@/data/mock";
import { SessionPlan } from "@/types";

const CoachSessionPlansPage = () => {
  const [viewPlan, setViewPlan] = useState<SessionPlan | null>(null);

  const myCoachId = "1";
  const myCampIds = mockCampCoaches.filter(cc => cc.coach_id === myCoachId).map(cc => cc.camp_id);
  const myAssignments = mockSessionAssignments.filter(a => myCampIds.includes(a.camp_id));

  const getCategoryName = (catId: string | null) => !catId ? "Uncategorised" : mockSessionCategories.find(c => c.id === catId)?.name || "Uncategorised";

  const campGroups = myCampIds.map(campId => {
    const camp = mockCamps.find(c => c.id === campId);
    const campAssignments = myAssignments.filter(a => a.camp_id === campId);
    const plans = campAssignments.map(a => ({
      assignment: a,
      plan: mockSessionPlans.find(p => p.id === a.session_plan_id),
    })).filter(x => x.plan);
    return { camp, plans };
  }).filter(g => g.plans.length > 0);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Session Plans</h1>
          <p className="text-muted-foreground text-sm">Your assigned camp session plans</p>
        </div>
      </div>

      {campGroups.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No session plans assigned yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Plans will appear here when assigned to your camps</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {campGroups.map(({ camp, plans }) => (
            <div key={camp?.id}>
              <p className="section-label mb-3">{camp?.name} — {camp?.club_name}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map(({ assignment, plan }) => (
                  <Card key={assignment.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => plan && setViewPlan(plan)}>
                    <CardContent className="p-4 space-y-2">
                      <h3 className="font-semibold text-sm">{plan!.title}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{plan!.age_group}</Badge>
                        <Badge variant="outline" className="text-xs">{getCategoryName(plan!.category_id)}</Badge>
                      </div>
                      {assignment.camp_day && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" /> {assignment.camp_day}
                        </div>
                      )}
                      {plan!.description && <p className="text-sm text-muted-foreground line-clamp-2">{plan!.description}</p>}
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
                    <p className="section-label">Description</p>
                    <p className="text-sm text-muted-foreground">{viewPlan.description}</p>
                  </div>
                )}
                {viewPlan.content && (
                  <div>
                    <p className="section-label">Session Content</p>
                    <div className="rounded-lg border p-4 bg-muted/30">
                      <pre className="text-sm whitespace-pre-wrap font-sans">{viewPlan.content}</pre>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoachSessionPlansPage;
