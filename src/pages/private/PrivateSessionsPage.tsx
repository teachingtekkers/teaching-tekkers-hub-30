import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Plus, Pencil, Trash2, Users, UserCog, Clock } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PAYMENT_MODELS = [
  { value: "individual", label: "Children pay individually" },
  { value: "club_pays", label: "Club/company pays" },
  { value: "mixed", label: "Mixed (some club, some individual)" },
];

interface SessionGroup {
  id: string;
  venue_id: string;
  group_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  age_group: string;
  max_capacity: number;
  payment_model: string;
  block_price_4_week: number;
  block_price_6_week: number;
  single_session_price: number;
  club_pays: boolean;
  club_pays_amount: number;
  coach_cost_per_session: number;
  notes: string;
  status: string;
  private_venues?: { name: string } | null;
}

interface Venue { id: string; name: string; }
interface Coach { id: string; full_name: string; }
interface Child { id: string; first_name: string; last_name: string; }

const emptyForm = {
  venue_id: "", group_name: "", day_of_week: "Monday", start_time: "18:00", end_time: "19:00",
  age_group: "", max_capacity: 20, payment_model: "individual",
  block_price_4_week: 0, block_price_6_week: 0, single_session_price: 0,
  club_pays: false, club_pays_amount: 0, coach_cost_per_session: 0, notes: "",
};

export default function PrivateSessionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SessionGroup | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [childDialog, setChildDialog] = useState<string | null>(null);
  const [coachDialog, setCoachDialog] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["private-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("private_session_groups")
        .select("*, private_venues(name)")
        .order("day_of_week");
      if (error) throw error;
      return data as SessionGroup[];
    },
  });

  const { data: venues = [] } = useQuery({
    queryKey: ["private-venues"],
    queryFn: async () => {
      const { data } = await supabase.from("private_venues").select("id, name").eq("status", "active").order("name");
      return (data || []) as Venue[];
    },
  });

  const { data: coaches = [] } = useQuery({
    queryKey: ["coaches-list"],
    queryFn: async () => {
      const { data } = await supabase.from("coaches").select("id, full_name").order("full_name");
      return (data || []) as Coach[];
    },
  });

  const { data: allChildren = [] } = useQuery({
    queryKey: ["private-children"],
    queryFn: async () => {
      const { data } = await supabase.from("private_children").select("id, first_name, last_name").eq("status", "active").order("last_name");
      return (data || []) as Child[];
    },
  });

  const { data: childAssignments = [] } = useQuery({
    queryKey: ["private-child-assignments"],
    queryFn: async () => {
      const { data } = await supabase.from("private_child_assignments").select("*");
      return data || [];
    },
  });

  const { data: coachAssignments = [] } = useQuery({
    queryKey: ["private-coach-assignments"],
    queryFn: async () => {
      const { data } = await supabase.from("private_coach_assignments").select("*");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, club_pays: form.payment_model === "club_pays" || form.club_pays };
      if (editing) {
        const { error } = await supabase.from("private_session_groups").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("private_session_groups").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-sessions"] });
      toast.success(editing ? "Session updated" : "Session created");
      setOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: () => toast.error("Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("private_session_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-sessions"] });
      toast.success("Session removed");
    },
  });

  const toggleChild = useMutation({
    mutationFn: async ({ childId, groupId, assigned }: { childId: string; groupId: string; assigned: boolean }) => {
      if (assigned) {
        await supabase.from("private_child_assignments").delete().eq("child_id", childId).eq("session_group_id", groupId);
      } else {
        await supabase.from("private_child_assignments").insert({ child_id: childId, session_group_id: groupId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["private-child-assignments"] }),
  });

  const toggleCoach = useMutation({
    mutationFn: async ({ coachId, groupId, assigned }: { coachId: string; groupId: string; assigned: boolean }) => {
      if (assigned) {
        await supabase.from("private_coach_assignments").delete().eq("coach_id", coachId).eq("session_group_id", groupId);
      } else {
        await supabase.from("private_coach_assignments").insert({ coach_id: coachId, session_group_id: groupId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["private-coach-assignments"] }),
  });

  const openEdit = (s: SessionGroup) => {
    setEditing(s);
    setForm({
      venue_id: s.venue_id, group_name: s.group_name, day_of_week: s.day_of_week,
      start_time: s.start_time, end_time: s.end_time, age_group: s.age_group,
      max_capacity: s.max_capacity, payment_model: s.payment_model,
      block_price_4_week: s.block_price_4_week, block_price_6_week: s.block_price_6_week,
      single_session_price: s.single_session_price, club_pays: s.club_pays,
      club_pays_amount: s.club_pays_amount, coach_cost_per_session: s.coach_cost_per_session,
      notes: s.notes,
    });
    setOpen(true);
  };

  const getChildrenForGroup = (groupId: string) => childAssignments.filter(a => a.session_group_id === groupId);
  const getCoachesForGroup = (groupId: string) => coachAssignments.filter(a => a.session_group_id === groupId);

  // Group sessions by day
  const byDay = DAYS.map(day => ({
    day,
    sessions: sessions.filter(s => s.day_of_week === day),
  })).filter(d => d.sessions.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage private coaching session groups by venue and day</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }} disabled={venues.length === 0}>
          <Plus className="h-4 w-4 mr-2" />Add Session
        </Button>
      </div>

      {venues.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Add a venue first before creating sessions.</CardContent></Card>
      )}

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : byDay.length === 0 && venues.length > 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No sessions yet. Create your first session group.</CardContent></Card>
      ) : (
        byDay.map(({ day, sessions: daySessions }) => (
          <div key={day} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{day}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {daySessions.map(s => {
                const assignedChildren = getChildrenForGroup(s.id);
                const assignedCoaches = getCoachesForGroup(s.id);
                return (
                  <Card key={s.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{s.group_name || "Unnamed Session"}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />{s.private_venues?.name || "—"}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                            if (confirm("Delete this session?")) deleteMutation.mutate(s.id);
                          }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-muted-foreground" />{s.start_time}–{s.end_time}</span>
                        {s.age_group && <Badge variant="outline">{s.age_group}</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="text-xs">{PAYMENT_MODELS.find(m => m.value === s.payment_model)?.label || s.payment_model}</Badge>
                        {s.single_session_price > 0 && <span className="text-xs text-muted-foreground">€{s.single_session_price}/session</span>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => setCoachDialog(s.id)}>
                          <UserCog className="h-3.5 w-3.5 mr-1" />Coaches ({assignedCoaches.length})
                        </Button>
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => setChildDialog(s.id)}>
                          <Users className="h-3.5 w-3.5 mr-1" />Children ({assignedChildren.length})
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Session Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Session" : "Add Session"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Venue *</Label>
              <Select value={form.venue_id} onValueChange={v => setForm(p => ({ ...p, venue_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
                <SelectContent>{venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Group Name</Label><Input value={form.group_name} onChange={e => setForm(p => ({ ...p, group_name: e.target.value }))} placeholder="e.g. U10 Advanced" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Day</Label>
                <Select value={form.day_of_week} onValueChange={v => setForm(p => ({ ...p, day_of_week: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Start</Label><Input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} /></div>
              <div><Label>End</Label><Input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Age Group</Label><Input value={form.age_group} onChange={e => setForm(p => ({ ...p, age_group: e.target.value }))} placeholder="e.g. U8-U12" /></div>
              <div><Label>Max Capacity</Label><Input type="number" value={form.max_capacity} onChange={e => setForm(p => ({ ...p, max_capacity: parseInt(e.target.value) || 0 }))} /></div>
            </div>
            <div><Label>Payment Model</Label>
              <Select value={form.payment_model} onValueChange={v => setForm(p => ({ ...p, payment_model: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_MODELS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Single (€)</Label><Input type="number" value={form.single_session_price} onChange={e => setForm(p => ({ ...p, single_session_price: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>4-Week (€)</Label><Input type="number" value={form.block_price_4_week} onChange={e => setForm(p => ({ ...p, block_price_4_week: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>6-Week (€)</Label><Input type="number" value={form.block_price_6_week} onChange={e => setForm(p => ({ ...p, block_price_6_week: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            {(form.payment_model === "club_pays" || form.payment_model === "mixed") && (
              <div><Label>Club Pays Amount (€)</Label><Input type="number" value={form.club_pays_amount} onChange={e => setForm(p => ({ ...p, club_pays_amount: parseFloat(e.target.value) || 0 }))} /></div>
            )}
            <div><Label>Coach Cost per Session (€)</Label><Input type="number" value={form.coach_cost_per_session} onChange={e => setForm(p => ({ ...p, coach_cost_per_session: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" disabled={!form.venue_id || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : editing ? "Update Session" : "Create Session"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Children Dialog */}
      <Dialog open={!!childDialog} onOpenChange={() => setChildDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Children</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {allChildren.map(c => {
              const assigned = childAssignments.some(a => a.child_id === c.id && a.session_group_id === childDialog);
              return (
                <label key={c.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                  <Checkbox checked={assigned} onCheckedChange={() => toggleChild.mutate({ childId: c.id, groupId: childDialog!, assigned })} />
                  <span className="text-sm">{c.first_name} {c.last_name}</span>
                </label>
              );
            })}
            {allChildren.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No children added yet.</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Coaches Dialog */}
      <Dialog open={!!coachDialog} onOpenChange={() => setCoachDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Coaches</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {coaches.map(c => {
              const assigned = coachAssignments.some(a => a.coach_id === c.id && a.session_group_id === coachDialog);
              return (
                <label key={c.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                  <Checkbox checked={assigned} onCheckedChange={() => toggleCoach.mutate({ coachId: c.id, groupId: coachDialog!, assigned })} />
                  <span className="text-sm">{c.full_name}</span>
                </label>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
