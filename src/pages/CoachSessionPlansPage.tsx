import { useState } from "react";
import { BookOpen, Calendar, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mockCamps, mockCampCoaches, mockSessionPlans, mockSessionAssignments, mockSessionCategories } from "@/data/mock";
import { SessionPlan } from "@/types";

const CoachSessionPlansPage = () => {
  const [viewPlan, setViewPlan] = useState<SessionPlan | null>(null);

  // Demo: coach ID '1' (Darren Byrne)
  const myCoachId = "1";
  const myCampIds = mockCampCoaches.filter(cc => cc.coach_id === myCoachId).map(cc => cc.camp_id);
  const myAssignments = mockSessionAssignments.filter(a => myCampIds.includes(a.camp_id));

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "Uncategorised";
    return mockSessionCategories.find(c => c.id === catId)?.name || "Uncategorised";
  };

  // Group by camp
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
      <div>
        <h1 className="text-2xl font-bold">Session Plans</h1>
        <p className="text-muted-foreground">Your assigned camp session plans</p>
      </div>

      {campGroups.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No session plans assigned to your camps yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-6">
          {campGroups.map(({ camp, plans }) => (
            <div key={camp?.id}>
              <h2 className="text-lg font-semibold mb-3">{camp?.name} — {camp?.club_name}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {plans.map(({ assignment, plan }) => (
                  <Card key={assignment.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => plan && setViewPlan(plan)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{plan!.title}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{plan!.age_group}</Badge>
                        <Badge variant="outline" className="text-xs">{getCategoryName(plan!.category_id)}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {assignment.camp_day && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" /> {assignment.camp_day}
                        </div>
                      )}
                      {plan!.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{plan!.description}</p>}
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
                    <p className="text-sm font-medium mb-1">Description</p>
                    <p className="text-sm text-muted-foreground">{viewPlan.description}</p>
                  </div>
                )}
                {viewPlan.content && (
                  <div>
                    <p className="text-sm font-medium mb-1">Session Content</p>
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
