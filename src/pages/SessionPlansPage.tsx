import { useState } from "react";
import { Plus, BookOpen, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockCamps, mockSessionCategories, mockSessionPlans, mockSessionAssignments } from "@/data/mock";
import { SessionPlan, SessionPlanAssignment, SessionPlanCategory } from "@/types";
import { toast } from "sonner";

const SessionPlansPage = () => {
  const [plans, setPlans] = useState<SessionPlan[]>(mockSessionPlans);
  const [categories] = useState<SessionPlanCategory[]>(mockSessionCategories);
  const [assignments, setAssignments] = useState<SessionPlanAssignment[]>(mockSessionAssignments);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [viewPlan, setViewPlan] = useState<SessionPlan | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const [form, setForm] = useState({ title: "", category_id: "", age_group: "U8-U12", description: "", content: "" });
  const [assignForm, setAssignForm] = useState({ session_plan_id: "", camp_id: "", camp_day: "" });

  const handleCreate = () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    const newPlan: SessionPlan = {
      id: String(plans.length + 1),
      title: form.title,
      category_id: form.category_id || null,
      age_group: form.age_group,
      description: form.description || null,
      content: form.content || null,
      created_at: new Date().toISOString(),
    };
    setPlans([...plans, newPlan]);
    setCreateOpen(false);
    setForm({ title: "", category_id: "", age_group: "U8-U12", description: "", content: "" });
    toast.success("Session plan created");
  };

  const handleAssign = () => {
    if (!assignForm.session_plan_id || !assignForm.camp_id) { toast.error("Select a plan and camp"); return; }
    const newAssignment: SessionPlanAssignment = {
      id: String(assignments.length + 1),
      session_plan_id: assignForm.session_plan_id,
      camp_id: assignForm.camp_id,
      camp_day: assignForm.camp_day || null,
      created_at: new Date().toISOString(),
    };
    setAssignments([...assignments, newAssignment]);
    setAssignOpen(false);
    setAssignForm({ session_plan_id: "", camp_id: "", camp_day: "" });
    toast.success("Plan assigned to camp");
  };

  const getCategoryName = (catId: string | null) => {
    if (!catId) return "Uncategorised";
    return categories.find(c => c.id === catId)?.name || "Uncategorised";
  };

  const filteredPlans = filterCategory === "all" ? plans : plans.filter(p => p.category_id === filterCategory);

  const getPlanAssignments = (planId: string) =>
    assignments.filter(a => a.session_plan_id === planId).map(a => ({
      ...a,
      camp: mockCamps.find(c => c.id === a.camp_id),
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Session Plans</h1>
          <p className="text-muted-foreground">Create and manage coaching session templates</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Calendar className="mr-2 h-4 w-4" />Assign to Camp</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Assign Plan to Camp</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Session Plan</Label>
                  <Select value={assignForm.session_plan_id} onValueChange={v => setAssignForm({ ...assignForm, session_plan_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Camp</Label>
                  <Select value={assignForm.camp_id} onValueChange={v => setAssignForm({ ...assignForm, camp_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select camp" /></SelectTrigger>
                    <SelectContent>{mockCamps.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Day (optional)</Label>
                  <Input type="date" value={assignForm.camp_day} onChange={e => setAssignForm({ ...assignForm, camp_day: e.target.value })} />
                </div>
                <Button onClick={handleAssign} className="w-full">Assign</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />New Plan</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Session Plan</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Passing Drills" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Age Group</Label>
                    <Input value={form.age_group} onChange={e => setForm({ ...form, age_group: e.target.value })} placeholder="e.g. U8-U12" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief overview of this session" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Step-by-step session plan..." rows={6} />
                </div>
                <Button onClick={handleCreate} className="w-full">Create Plan</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={filterCategory === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilterCategory("all")}>All</Badge>
        {categories.map(cat => (
          <Badge key={cat.id} variant={filterCategory === cat.id ? "default" : "outline"} className="cursor-pointer" onClick={() => setFilterCategory(cat.id)}>
            {cat.name}
          </Badge>
        ))}
      </div>

      {/* Plans grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPlans.map(plan => {
          const planAssignments = getPlanAssignments(plan.id);
          return (
            <Card key={plan.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setViewPlan(plan)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{plan.title}</CardTitle>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">{plan.age_group}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{getCategoryName(plan.category_id)}</span>
                </div>
              </CardHeader>
              <CardContent>
                {plan.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{plan.description}</p>}
                {planAssignments.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {planAssignments.map(a => (
                      <Badge key={a.id} variant="outline" className="text-xs">
                        {a.camp?.name}{a.camp_day ? ` • ${a.camp_day}` : ""}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* View plan dialog */}
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
                {getPlanAssignments(viewPlan.id).length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1">Assigned To</p>
                    <div className="space-y-1">
                      {getPlanAssignments(viewPlan.id).map(a => (
                        <div key={a.id} className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{a.camp?.name}</span>
                          {a.camp_day && <Badge variant="outline" className="text-xs">{a.camp_day}</Badge>}
                        </div>
                      ))}
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

export default SessionPlansPage;
