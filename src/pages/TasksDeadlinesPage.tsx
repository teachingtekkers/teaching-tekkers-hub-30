import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ListChecks, Plus, Calendar, Flag, ArrowRight, Pencil, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUSES = ["to_do", "in_progress", "done", "overdue"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const LINKED_AREAS = [
  "Dashboard", "Camps", "Staff Profiles", "Roster Generator", "Staff Payroll",
  "Club Payments", "Bookings", "Booking Sync", "Attendance", "Private Coaching", "Social Media",
];

const STATUS_LABELS: Record<string, string> = { to_do: "To Do", in_progress: "In Progress", done: "Done", overdue: "Overdue" };
const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  urgent: "bg-destructive/10 text-destructive",
};
const STATUS_COLORS: Record<string, string> = {
  to_do: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  overdue: "bg-destructive/10 text-destructive",
};

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  linked_area: string | null;
  linked_camp_id: string | null;
  linked_coach_id: string | null;
  notes: string | null;
  created_at: string;
}

interface CampOption { id: string; name: string; }
interface CoachOption { id: string; full_name: string; }

const emptyForm = {
  title: "", description: "", due_date: "", priority: "medium" as string,
  status: "to_do" as string, assigned_to: "", linked_area: "", linked_camp_id: "",
  linked_coach_id: "", notes: "",
};

export default function TasksDeadlinesPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [camps, setCamps] = useState<CampOption[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const fetchTasks = async () => {
    const { data } = await supabase.from("tasks").select("*").order("due_date", { ascending: true });
    setTasks((data || []) as unknown as TaskRow[]);
  };

  useEffect(() => {
    (async () => {
      const [, campsRes, coachesRes] = await Promise.all([
        fetchTasks(),
        supabase.from("camps").select("id, name").order("name"),
        supabase.from("coaches").select("id, full_name").order("full_name"),
      ]);
      setCamps((campsRes.data || []) as CampOption[]);
      setCoaches((coachesRes.data || []) as CoachOption[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      return true;
    });
  }, [tasks, filterStatus, filterPriority]);

  const openNew = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (t: TaskRow) => {
    setForm({
      title: t.title, description: t.description || "", due_date: t.due_date || "",
      priority: t.priority, status: t.status, assigned_to: t.assigned_to || "",
      linked_area: t.linked_area || "", linked_camp_id: t.linked_camp_id || "",
      linked_coach_id: t.linked_coach_id || "", notes: t.notes || "",
    });
    setEditingId(t.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    const payload: any = {
      title: form.title, description: form.description || null, priority: form.priority,
      status: form.status, assigned_to: form.assigned_to || null,
      linked_area: form.linked_area || null, linked_camp_id: form.linked_camp_id || null,
      linked_coach_id: form.linked_coach_id || null, notes: form.notes || null,
      due_date: form.due_date || null, updated_at: new Date().toISOString(),
    };
    if (editingId) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", editingId);
      if (error) { toast.error("Failed to update task"); return; }
      toast.success("Task updated");
    } else {
      const { error } = await supabase.from("tasks").insert(payload);
      if (error) { toast.error("Failed to create task"); return; }
      toast.success("Task created");
    }
    setDialogOpen(false);
    fetchTasks();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast.error("Failed to delete task"); return; }
    toast.success("Task deleted");
    fetchTasks();
  };

  const campMap = useMemo(() => new Map(camps.map(c => [c.id, c.name])), [camps]);
  const coachMap = useMemo(() => new Map(coaches.map(c => [c.id, c.full_name])), [coaches]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks & Deadlines</h1>
          <p className="text-sm text-muted-foreground mt-1">Track camp preparation tasks and upcoming deadlines</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> New Task</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Task Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Area</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    No tasks found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : filtered.map(t => (
                <TableRow key={t.id} className="cursor-pointer group" onClick={() => openEdit(t)}>
                  <TableCell>
                    <p className="font-medium text-sm">{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground line-clamp-1">{t.description}</p>}
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {t.linked_camp_id && campMap.has(t.linked_camp_id) && (
                        <Link to={`/camps/${t.linked_camp_id}`} onClick={e => e.stopPropagation()} className="text-[10px] text-primary hover:underline">
                          🏕 {campMap.get(t.linked_camp_id)}
                        </Link>
                      )}
                      {t.linked_coach_id && coachMap.has(t.linked_coach_id) && (
                        <Link to={`/coaches/${t.linked_coach_id}`} onClick={e => e.stopPropagation()} className="text-[10px] text-primary hover:underline">
                          👤 {coachMap.get(t.linked_coach_id)}
                        </Link>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {t.due_date ? format(new Date(t.due_date + "T00:00:00"), "dd MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${PRIORITY_COLORS[t.priority]} text-[10px] capitalize border-0`}>{t.priority}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${STATUS_COLORS[t.status]} text-[10px] border-0`}>{STATUS_LABELS[t.status] || t.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{t.assigned_to || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.linked_area || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(t); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); handleDelete(t.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Details…" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <Label>Assigned To</Label>
                <Input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Linked Area / Module</Label>
              <Select value={form.linked_area || "none"} onValueChange={v => setForm(f => ({ ...f, linked_area: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select area…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {LINKED_AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Linked Camp</Label>
                <Select value={form.linked_camp_id || "none"} onValueChange={v => setForm(f => ({ ...f, linked_camp_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {camps.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Linked Staff</Label>
                <Select value={form.linked_coach_id || "none"} onValueChange={v => setForm(f => ({ ...f, linked_coach_id: v === "none" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {coaches.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes…" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editingId ? "Save Changes" : "Create Task"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
