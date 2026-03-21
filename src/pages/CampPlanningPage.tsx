import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addWeeks, startOfWeek, parseISO, isSameWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChevronLeft, ChevronRight, CalendarIcon, Link2, Check } from "lucide-react";

const COUNTIES = [
  "Kildare", "Dublin", "Wexford", "Wicklow", "Midlands",
  "Carlow", "Kilkenny", "Waterford", "Meath",
];

const STATUSES = [
  { value: "to_contact", label: "To Contact", color: "bg-gray-200 text-gray-800" },
  { value: "contacted", label: "Contacted", color: "bg-blue-100 text-blue-800" },
  { value: "awaiting_reply", label: "Awaiting Reply", color: "bg-yellow-100 text-yellow-800" },
  { value: "tentative", label: "Tentative", color: "bg-orange-100 text-orange-800" },
  { value: "confirmed", label: "Confirmed", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700" },
];

const statusColor = (s: string) => STATUSES.find((x) => x.value === s)?.color ?? "bg-muted text-muted-foreground";
const statusLabel = (s: string) => STATUSES.find((x) => x.value === s)?.label ?? s;

type PlanningEntry = {
  id: string;
  club_name: string;
  club_id: string | null;
  county: string;
  week_start: string;
  status: string;
  venue: string | null;
  age_group: string | null;
  notes: string | null;
  linked_camp_id: string | null;
};

const emptyForm = {
  club_name: "",
  club_id: null as string | null,
  county: COUNTIES[0],
  week_start: "",
  status: "to_contact",
  venue: "",
  age_group: "",
  notes: "",
};

export default function CampPlanningPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [baseDate, setBaseDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const numWeeks = 8;
  const weeks = useMemo(() => Array.from({ length: numWeeks }, (_, i) => addWeeks(baseDate, i)), [baseDate]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PlanningEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [calOpen, setCalOpen] = useState(false);

  // Queries
  const { data: entries = [] } = useQuery({
    queryKey: ["camp-planning"],
    queryFn: async () => {
      const { data } = await supabase.from("camp_planning_entries").select("*").order("club_name");
      return (data ?? []) as PlanningEntry[];
    },
  });

  const { data: clubs = [] } = useQuery({
    queryKey: ["clubs-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clubs").select("id, name, county").order("name");
      return data ?? [];
    },
  });

  // Mutations
  const saveMut = useMutation({
    mutationFn: async (f: typeof form & { id?: string }) => {
      const weekStart = f.week_start;
      const payload = {
        club_name: f.club_name,
        club_id: f.club_id || null,
        county: f.county,
        week_start: weekStart,
        status: f.status,
        venue: f.venue,
        age_group: f.age_group,
        notes: f.notes,
      };
      if (f.id) {
        const { error } = await supabase.from("camp_planning_entries").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("camp_planning_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["camp-planning"] });
      setDialogOpen(false);
      setEditingEntry(null);
      toast({ title: "Planning entry saved" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("camp_planning_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["camp-planning"] });
      setDialogOpen(false);
      setEditingEntry(null);
      toast({ title: "Entry deleted" });
    },
  });

  const confirmMut = useMutation({
    mutationFn: async (entry: PlanningEntry) => {
      // 1. Find or create club
      let clubId = entry.club_id;
      if (!clubId) {
        const existing = clubs.find((c) => c.name.toLowerCase() === entry.club_name.toLowerCase());
        if (existing) {
          clubId = existing.id;
        } else {
          const { data: newClub, error: clubErr } = await supabase
            .from("clubs")
            .insert({ name: entry.club_name, county: entry.county })
            .select("id")
            .single();
          if (clubErr) throw clubErr;
          clubId = newClub.id;
        }
      }

      // 2. Create camp
      const weekStart = parseISO(entry.week_start);
      const weekEnd = addWeeks(weekStart, 0); // single week camp, end = friday
      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 4);

      const { data: newCamp, error: campErr } = await supabase
        .from("camps")
        .insert({
          name: `${entry.club_name} Camp`,
          club_name: entry.club_name,
          club_id: clubId,
          venue: entry.venue || entry.club_name,
          county: entry.county,
          age_group: entry.age_group || "U6-U12",
          start_date: format(weekStart, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          status: "active",
        })
        .select("id")
        .single();
      if (campErr) throw campErr;

      // 3. Update planning entry
      const { error: upErr } = await supabase
        .from("camp_planning_entries")
        .update({ status: "confirmed", club_id: clubId, linked_camp_id: newCamp.id })
        .eq("id", entry.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["camp-planning"] });
      qc.invalidateQueries({ queryKey: ["clubs-list"] });
      setDialogOpen(false);
      setEditingEntry(null);
      toast({ title: "Camp confirmed and created", description: "Club and Camp records have been linked." });
    },
  });

  const openNew = (county: string, weekStart: Date) => {
    setEditingEntry(null);
    setForm({ ...emptyForm, county, week_start: format(weekStart, "yyyy-MM-dd") });
    setDialogOpen(true);
  };

  const openEdit = (entry: PlanningEntry) => {
    setEditingEntry(entry);
    setForm({
      club_name: entry.club_name,
      club_id: entry.club_id,
      county: entry.county,
      week_start: entry.week_start,
      status: entry.status,
      venue: entry.venue ?? "",
      age_group: entry.age_group ?? "",
      notes: entry.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.club_name || !form.week_start) return;
    saveMut.mutate(editingEntry ? { ...form, id: editingEntry.id } : form);
  };

  const handleConfirm = () => {
    if (!editingEntry) return;
    confirmMut.mutate(editingEntry);
  };

  // Grid helpers
  const getEntries = (county: string, week: Date) =>
    entries.filter(
      (e) =>
        e.county === county &&
        isSameWeek(parseISO(e.week_start), week, { weekStartsOn: 1 })
    );

  const getWeekTotals = (week: Date) => {
    const weekEntries = entries.filter((e) => isSameWeek(parseISO(e.week_start), week, { weekStartsOn: 1 }));
    return {
      confirmed: weekEntries.filter((e) => e.status === "confirmed").length,
      tentative: weekEntries.filter((e) => e.status === "tentative").length,
      total: weekEntries.length,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Camp Planning</h1>
          <p className="text-sm text-muted-foreground">Plan upcoming camps by week and county. Click any cell to add a camp.</p>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setBaseDate((d) => addWeeks(d, -4))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(weeks[0], "d MMM yyyy")} — {format(addWeeks(weeks[weeks.length - 1], 1), "d MMM yyyy")}
        </span>
        <Button variant="outline" size="icon" onClick={() => setBaseDate((d) => addWeeks(d, 4))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setBaseDate(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
          Today
        </Button>
      </div>

      {/* Planning Grid */}
      <Card className="overflow-auto">
        <div className="min-w-[900px]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 w-28 p-2 text-left text-xs font-semibold text-muted-foreground">County</th>
                {weeks.map((w) => {
                  const totals = getWeekTotals(w);
                  const isCurrentWeek = isSameWeek(w, new Date(), { weekStartsOn: 1 });
                  return (
                    <th
                      key={w.toISOString()}
                      className={`p-2 text-center text-xs font-semibold min-w-[140px] ${isCurrentWeek ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
                    >
                      <div>{format(w, "d MMM")}</div>
                      <div className="flex justify-center gap-1 mt-0.5">
                        {totals.confirmed > 0 && (
                          <span className="text-[10px] bg-green-100 text-green-800 px-1.5 rounded-full">{totals.confirmed} conf</span>
                        )}
                        {totals.tentative > 0 && (
                          <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 rounded-full">{totals.tentative} tent</span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {COUNTIES.map((county) => (
                <tr key={county} className="border-b hover:bg-muted/30">
                  <td className="sticky left-0 z-10 bg-background p-2 font-medium text-xs border-r">{county}</td>
                  {weeks.map((w) => {
                    const cellEntries = getEntries(county, w);
                    return (
                      <td
                        key={w.toISOString()}
                        className="p-1.5 align-top border-r cursor-pointer hover:bg-accent/30 min-h-[60px]"
                        onClick={() => openNew(county, w)}
                      >
                        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                          {cellEntries.map((entry) => (
                            <button
                              key={entry.id}
                              onClick={() => openEdit(entry)}
                              className={`w-full text-left rounded px-1.5 py-1 text-[11px] leading-tight font-medium transition-colors ${statusColor(entry.status)}`}
                            >
                              <div className="flex items-center gap-1">
                                {entry.linked_camp_id && <Link2 className="h-2.5 w-2.5 shrink-0" />}
                                <span className="truncate">{entry.club_name}</span>
                              </div>
                            </button>
                          ))}
                          {cellEntries.length === 0 && (
                            <div
                              className="flex items-center justify-center h-8 text-muted-foreground/30 hover:text-muted-foreground/60 cursor-pointer"
                              onClick={() => openNew(county, w)}
                            >
                              <Plus className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Status Legend */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Badge key={s.value} className={`text-[10px] ${s.color}`}>{s.label}</Badge>
        ))}
      </div>

      {/* Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Planning Entry" : "New Planning Entry"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Club Name</Label>
                <Input
                  value={form.club_name}
                  onChange={(e) => setForm((f) => ({ ...f, club_name: e.target.value }))}
                  placeholder="Club name"
                />
                {clubs.length > 0 && (
                  <Select
                    value={form.club_id ?? "none"}
                    onValueChange={(v) => {
                      if (v === "none") {
                        setForm((f) => ({ ...f, club_id: null }));
                      } else {
                        const club = clubs.find((c) => c.id === v);
                        setForm((f) => ({
                          ...f,
                          club_id: v,
                          club_name: club?.name ?? f.club_name,
                          county: club?.county ?? f.county,
                        }));
                      }
                    }}
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="Link existing club" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No linked club</SelectItem>
                      {clubs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>County</Label>
                <Select value={form.county} onValueChange={(v) => setForm((f) => ({ ...f, county: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Week</Label>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.week_start ? format(parseISO(form.week_start), "d MMM yyyy") : "Select week"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={form.week_start ? parseISO(form.week_start) : undefined}
                      onSelect={(d) => {
                        if (d) {
                          const ws = startOfWeek(d, { weekStartsOn: 1 });
                          setForm((f) => ({ ...f, week_start: format(ws, "yyyy-MM-dd") }));
                        }
                        setCalOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Venue</Label>
                <Input value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label>Age Group</Label>
                <Input value={form.age_group} onChange={(e) => setForm((f) => ({ ...f, age_group: e.target.value }))} placeholder="e.g. U6-U12" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            {editingEntry?.linked_camp_id && (
              <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded p-2">
                <Link2 className="h-3.5 w-3.5" />
                <span>Linked to camp record</span>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <div>
                {editingEntry && (
                  <Button variant="destructive" size="sm" onClick={() => deleteMut.mutate(editingEntry.id)}>
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {editingEntry && !editingEntry.linked_camp_id && editingEntry.status !== "confirmed" && (
                  <Button variant="outline" size="sm" onClick={handleConfirm} disabled={confirmMut.isPending}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Confirm & Create Camp
                  </Button>
                )}
                <Button onClick={handleSave} disabled={saveMut.isPending}>
                  {editingEntry ? "Update" : "Add Entry"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
