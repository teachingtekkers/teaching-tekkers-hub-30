import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addWeeks, parseISO } from "date-fns";
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
import { cn } from "@/lib/utils";
import { Plus, CalendarIcon, Link2, Check, Settings2, Trash2 } from "lucide-react";

const COUNTIES = [
  "Kildare", "Dublin", "Wexford", "Wicklow", "Midlands",
  "Carlow", "Kilkenny", "Waterford", "Meath",
];

const DEFAULT_CAMP_TYPES = [
  "February Mid Term Camps",
  "Easter Camps",
  "Summer Camps",
  "Halloween Camps",
];

const STATUSES = [
  { value: "to_contact", label: "To Contact", bg: "bg-slate-200", text: "text-slate-800" },
  { value: "contacted", label: "Contacted", bg: "bg-sky-100", text: "text-sky-800" },
  { value: "awaiting_reply", label: "Awaiting Reply", bg: "bg-amber-100", text: "text-amber-800" },
  { value: "tentative", label: "Tentative", bg: "bg-orange-100", text: "text-orange-800" },
  { value: "confirmed", label: "Confirmed", bg: "bg-emerald-100", text: "text-emerald-800" },
  { value: "cancelled", label: "Cancelled", bg: "bg-red-100", text: "text-red-700" },
];

const statusStyle = (s: string) => {
  const found = STATUSES.find((x) => x.value === s);
  return found ? `${found.bg} ${found.text}` : "bg-muted text-muted-foreground";
};
const statusLabel = (s: string) => STATUSES.find((x) => x.value === s)?.label ?? s;

type Campaign = {
  id: string;
  camp_type: string;
  year: number;
  num_weeks: number;
  week1_start_date: string;
  notes: string | null;
};

type PlanningEntry = {
  id: string;
  campaign_id: string | null;
  club_name: string;
  club_id: string | null;
  county: string;
  week_start: string;
  week_number: number;
  status: string;
  venue: string | null;
  age_group: string | null;
  notes: string | null;
  linked_camp_id: string | null;
};

const emptyEntryForm = {
  club_name: "",
  club_id: null as string | null,
  county: COUNTIES[0],
  week_number: 1,
  status: "to_contact",
  venue: "",
  age_group: "",
  notes: "",
};

export default function CampPlanningPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Campaign state
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    camp_type: DEFAULT_CAMP_TYPES[1],
    year: new Date().getFullYear(),
    num_weeks: 4,
    week1_start_date: "",
    notes: "",
    custom_type: "",
  });
  const [campTypeMode, setCampTypeMode] = useState<"preset" | "custom">("preset");
  const [calOpen, setCalOpen] = useState(false);

  // Entry state
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PlanningEntry | null>(null);
  const [entryForm, setEntryForm] = useState(emptyEntryForm);

  // ─── Queries ───
  const { data: campaigns = [] } = useQuery({
    queryKey: ["camp-planning-campaigns"],
    queryFn: async () => {
      const { data } = await supabase
        .from("camp_planning_campaigns")
        .select("*")
        .order("year", { ascending: false });
      return (data ?? []) as Campaign[];
    },
  });

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) ?? null;

  // Auto-select first campaign
  if (!selectedCampaignId && campaigns.length > 0 && !campaignDialogOpen) {
    setSelectedCampaignId(campaigns[0].id);
  }

  const { data: entries = [] } = useQuery({
    queryKey: ["camp-planning-entries", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data } = await supabase
        .from("camp_planning_entries")
        .select("*")
        .eq("campaign_id", selectedCampaignId)
        .order("club_name");
      return (data ?? []) as PlanningEntry[];
    },
    enabled: !!selectedCampaignId,
  });

  const { data: clubs = [] } = useQuery({
    queryKey: ["clubs-list"],
    queryFn: async () => {
      const { data } = await supabase.from("clubs").select("id, name, county").order("name");
      return data ?? [];
    },
  });

  // ─── Derived: weeks for selected campaign ───
  const campWeeks = useMemo(() => {
    if (!selectedCampaign) return [];
    const start = parseISO(selectedCampaign.week1_start_date);
    return Array.from({ length: selectedCampaign.num_weeks }, (_, i) => ({
      weekNum: i + 1,
      start: addWeeks(start, i),
      end: addWeeks(start, i + 1),
    }));
  }, [selectedCampaign]);

  // ─── Campaign mutations ───
  const saveCampaignMut = useMutation({
    mutationFn: async () => {
      const campType = campTypeMode === "custom" ? campaignForm.custom_type : campaignForm.camp_type;
      if (!campType || !campaignForm.week1_start_date) throw new Error("Missing fields");
      const { data, error } = await supabase
        .from("camp_planning_campaigns")
        .insert({
          camp_type: campType,
          year: campaignForm.year,
          num_weeks: campaignForm.num_weeks,
          week1_start_date: campaignForm.week1_start_date,
          notes: campaignForm.notes,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["camp-planning-campaigns"] });
      setSelectedCampaignId(id);
      setCampaignDialogOpen(false);
      toast({ title: "Campaign created" });
    },
  });

  const deleteCampaignMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("camp_planning_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["camp-planning-campaigns"] });
      setSelectedCampaignId(null);
      toast({ title: "Campaign deleted" });
    },
  });

  // ─── Entry mutations ───
  const saveEntryMut = useMutation({
    mutationFn: async (f: typeof emptyEntryForm & { id?: string }) => {
      if (!selectedCampaign) throw new Error("No campaign");
      const weekStart = format(addWeeks(parseISO(selectedCampaign.week1_start_date), f.week_number - 1), "yyyy-MM-dd");
      const payload = {
        campaign_id: selectedCampaign.id,
        club_name: f.club_name,
        club_id: f.club_id || null,
        county: f.county,
        week_start: weekStart,
        week_number: f.week_number,
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
      qc.invalidateQueries({ queryKey: ["camp-planning-entries"] });
      setEntryDialogOpen(false);
      setEditingEntry(null);
      toast({ title: "Entry saved" });
    },
  });

  const deleteEntryMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("camp_planning_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["camp-planning-entries"] });
      setEntryDialogOpen(false);
      setEditingEntry(null);
      toast({ title: "Entry deleted" });
    },
  });

  const confirmMut = useMutation({
    mutationFn: async (entry: PlanningEntry) => {
      let clubId = entry.club_id;
      if (!clubId) {
        const existing = clubs.find((c) => c.name.toLowerCase() === entry.club_name.toLowerCase());
        if (existing) {
          clubId = existing.id;
        } else {
          const { data: newClub, error } = await supabase
            .from("clubs")
            .insert({ name: entry.club_name, county: entry.county })
            .select("id")
            .single();
          if (error) throw error;
          clubId = newClub.id;
        }
      }

      const weekStart = parseISO(entry.week_start);
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

      const { error: upErr } = await supabase
        .from("camp_planning_entries")
        .update({ status: "confirmed", club_id: clubId, linked_camp_id: newCamp.id })
        .eq("id", entry.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["camp-planning-entries"] });
      qc.invalidateQueries({ queryKey: ["clubs-list"] });
      setEntryDialogOpen(false);
      setEditingEntry(null);
      toast({ title: "Camp confirmed & created", description: "Club and Camp records linked." });
    },
  });

  // ─── Handlers ───
  const openNewEntry = (county: string, weekNum: number) => {
    setEditingEntry(null);
    setEntryForm({ ...emptyEntryForm, county, week_number: weekNum });
    setEntryDialogOpen(true);
  };

  const openEditEntry = (entry: PlanningEntry) => {
    setEditingEntry(entry);
    setEntryForm({
      club_name: entry.club_name,
      club_id: entry.club_id,
      county: entry.county,
      week_number: entry.week_number,
      status: entry.status,
      venue: entry.venue ?? "",
      age_group: entry.age_group ?? "",
      notes: entry.notes ?? "",
    });
    setEntryDialogOpen(true);
  };

  // ─── Grid helpers ───
  const getEntries = (county: string, weekNum: number) =>
    entries.filter((e) => e.county === county && e.week_number === weekNum);

  const getWeekTotals = (weekNum: number) => {
    const wk = entries.filter((e) => e.week_number === weekNum);
    return {
      confirmed: wk.filter((e) => e.status === "confirmed").length,
      tentative: wk.filter((e) => e.status === "tentative").length,
      total: wk.length,
    };
  };

  const getCountyWeekCount = (county: string, weekNum: number) =>
    entries.filter((e) => e.county === county && e.week_number === weekNum && e.status !== "cancelled").length;

  // ─── No campaigns yet ───
  if (campaigns.length === 0 && !campaignDialogOpen) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Camp Planning</h1>
        <Card className="p-12 text-center space-y-4">
          <Settings2 className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h2 className="text-lg font-semibold">No campaigns yet</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Create your first camp campaign to start planning. Choose a camp type, set the year and number of weeks, and pick the start date.
          </p>
          <Button onClick={() => setCampaignDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Campaign
          </Button>
        </Card>
        {renderCampaignDialog()}
      </div>
    );
  }

  // ─── Render helpers ───
  function renderCampaignDialog() {
    return (
      <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Camp Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Camp Type</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  size="sm"
                  variant={campTypeMode === "preset" ? "default" : "outline"}
                  onClick={() => setCampTypeMode("preset")}
                >
                  Preset
                </Button>
                <Button
                  size="sm"
                  variant={campTypeMode === "custom" ? "default" : "outline"}
                  onClick={() => setCampTypeMode("custom")}
                >
                  Custom
                </Button>
              </div>
              {campTypeMode === "preset" ? (
                <Select
                  value={campaignForm.camp_type}
                  onValueChange={(v) => setCampaignForm((f) => ({ ...f, camp_type: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEFAULT_CAMP_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={campaignForm.custom_type}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, custom_type: e.target.value }))}
                  placeholder="e.g. Christmas Camps"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={campaignForm.year}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, year: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Number of Weeks</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={campaignForm.num_weeks}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, num_weeks: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Week 1 Start Date (Monday)</Label>
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {campaignForm.week1_start_date
                      ? format(parseISO(campaignForm.week1_start_date), "d MMM yyyy")
                      : "Select start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={campaignForm.week1_start_date ? parseISO(campaignForm.week1_start_date) : undefined}
                    onSelect={(d) => {
                      if (d) setCampaignForm((f) => ({ ...f, week1_start_date: format(d, "yyyy-MM-dd") }));
                      setCalOpen(false);
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                value={campaignForm.notes}
                onChange={(e) => setCampaignForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCampaignDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => saveCampaignMut.mutate()} disabled={saveCampaignMut.isPending}>
                Create Campaign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Camp Planning</h1>
          <p className="text-sm text-muted-foreground">
            Plan camps by week and county. Click any cell to add a camp.
          </p>
        </div>
        <Button size="sm" onClick={() => {
          setCampaignForm({
            camp_type: DEFAULT_CAMP_TYPES[1],
            year: new Date().getFullYear(),
            num_weeks: 4,
            week1_start_date: "",
            notes: "",
            custom_type: "",
          });
          setCampTypeMode("preset");
          setCampaignDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-1" /> New Campaign
        </Button>
      </div>

      {/* Campaign selector */}
      <div className="flex items-center gap-3 flex-wrap">
        {campaigns.map((c) => (
          <Button
            key={c.id}
            size="sm"
            variant={c.id === selectedCampaignId ? "default" : "outline"}
            onClick={() => setSelectedCampaignId(c.id)}
          >
            {c.camp_type} {c.year}
          </Button>
        ))}
      </div>

      {/* Campaign info bar */}
      {selectedCampaign && (
        <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2 text-sm">
          <div className="flex items-center gap-4">
            <span className="font-medium">{selectedCampaign.camp_type} {selectedCampaign.year}</span>
            <span className="text-muted-foreground">
              {selectedCampaign.num_weeks} weeks from {format(parseISO(selectedCampaign.week1_start_date), "d MMM yyyy")}
            </span>
            <Badge variant="secondary" className="text-xs">
              {entries.filter((e) => e.status === "confirmed").length} confirmed
            </Badge>
            <Badge variant="outline" className="text-xs">
              {entries.length} total entries
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm("Delete this campaign and all its planning entries?")) {
                deleteCampaignMut.mutate(selectedCampaign.id);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Campaign
          </Button>
        </div>
      )}

      {/* Planning Grid */}
      {selectedCampaign && campWeeks.length > 0 && (
        <Card className="overflow-auto">
          <div className="min-w-[900px]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted/50 w-28 p-2 text-left text-xs font-semibold text-muted-foreground">
                    County
                  </th>
                  {campWeeks.map((w) => {
                    const totals = getWeekTotals(w.weekNum);
                    return (
                      <th key={w.weekNum} className="p-2 text-center text-xs font-semibold min-w-[150px] text-muted-foreground">
                        <div className="font-bold text-foreground">Week {w.weekNum}</div>
                        <div className="text-[10px]">
                          {format(w.start, "d MMM")} – {format(w.end, "d MMM")}
                        </div>
                        <div className="flex justify-center gap-1 mt-1">
                          {totals.confirmed > 0 && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-medium">
                              {totals.confirmed} conf
                            </span>
                          )}
                          {totals.tentative > 0 && (
                            <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full font-medium">
                              {totals.tentative} tent
                            </span>
                          )}
                          {totals.total > 0 && totals.confirmed === 0 && totals.tentative === 0 && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
                              {totals.total} entries
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="p-2 text-center text-xs font-semibold min-w-[80px] text-muted-foreground bg-muted/70">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {COUNTIES.map((county) => (
                  <tr key={county} className="border-b hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-background p-2 font-medium text-xs border-r whitespace-nowrap">
                      {county}
                    </td>
                    {campWeeks.map((w) => {
                      const cellEntries = getEntries(county, w.weekNum);
                      const count = getCountyWeekCount(county, w.weekNum);
                      const overloaded = count >= 3;
                      return (
                        <td
                          key={w.weekNum}
                          className={cn(
                            "p-1.5 align-top border-r cursor-pointer hover:bg-accent/20 min-h-[60px]",
                            overloaded && "bg-red-50/50"
                          )}
                          onClick={() => openNewEntry(county, w.weekNum)}
                        >
                          <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                            {cellEntries.map((entry) => (
                              <button
                                key={entry.id}
                                onClick={() => openEditEntry(entry)}
                                className={cn(
                                  "w-full text-left rounded px-1.5 py-1 text-[11px] leading-tight font-medium transition-colors",
                                  statusStyle(entry.status)
                                )}
                              >
                                <div className="flex items-center gap-1">
                                  {entry.linked_camp_id && <Link2 className="h-2.5 w-2.5 shrink-0" />}
                                  <span className="truncate">{entry.club_name}</span>
                                </div>
                              </button>
                            ))}
                            {cellEntries.length === 0 && (
                              <div
                                className="flex items-center justify-center h-8 text-muted-foreground/30 hover:text-muted-foreground/60"
                                onClick={() => openNewEntry(county, w.weekNum)}
                              >
                                <Plus className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                          {overloaded && (
                            <div className="text-[9px] text-destructive font-medium mt-0.5 text-center">
                              ⚠ {count} camps
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {/* County total column */}
                    {(() => {
                      const countyEntries = entries.filter((e) => e.county === county && e.status !== "cancelled");
                      const countyConfirmed = countyEntries.filter((e) => e.status === "confirmed").length;
                      return (
                        <td className="p-2 text-center align-middle bg-muted/30 border-r text-xs">
                          <div className="font-bold text-foreground">{countyEntries.length}</div>
                          {countyConfirmed > 0 && (
                            <div className="text-[10px] text-emerald-700">{countyConfirmed} conf</div>
                          )}
                        </td>
                      );
                    })()}
                  </tr>
                ))}
                {/* Weekly totals row */}
                <tr className="bg-muted/50 border-t-2">
                  <td className="sticky left-0 z-10 bg-muted/50 p-2 font-semibold text-xs border-r">
                    Totals
                  </td>
                  {campWeeks.map((w) => {
                    const totals = getWeekTotals(w.weekNum);
                    return (
                      <td key={w.weekNum} className="p-2 text-center border-r text-xs">
                        <div className="font-bold text-foreground">{totals.total}</div>
                        <div className="flex justify-center gap-1 mt-0.5">
                          {totals.confirmed > 0 && (
                            <span className="text-[10px] text-emerald-700 font-medium">{totals.confirmed} ✓</span>
                          )}
                          {totals.tentative > 0 && (
                            <span className="text-[10px] text-orange-700 font-medium">{totals.tentative} ~</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2 text-center bg-muted/70 text-xs">
                    <div className="font-bold text-foreground">{entries.filter((e) => e.status !== "cancelled").length}</div>
                    <div className="text-[10px] text-emerald-700 font-medium">
                      {entries.filter((e) => e.status === "confirmed").length} conf
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Status Legend */}
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <span key={s.value} className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", s.bg, s.text)}>
            {s.label}
          </span>
        ))}
      </div>

      {/* Campaign Dialog */}
      {renderCampaignDialog()}

      {/* Entry Dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Planning Entry" : "New Planning Entry"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Club Name</Label>
                <Input
                  value={entryForm.club_name}
                  onChange={(e) => setEntryForm((f) => ({ ...f, club_name: e.target.value }))}
                  placeholder="Club name"
                />
                {clubs.length > 0 && (
                  <Select
                    value={entryForm.club_id ?? "none"}
                    onValueChange={(v) => {
                      if (v === "none") {
                        setEntryForm((f) => ({ ...f, club_id: null }));
                      } else {
                        const club = clubs.find((c) => c.id === v);
                        setEntryForm((f) => ({
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
                <Select value={entryForm.county} onValueChange={(v) => setEntryForm((f) => ({ ...f, county: v }))}>
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
                <Label>Camp Week</Label>
                <Select
                  value={String(entryForm.week_number)}
                  onValueChange={(v) => setEntryForm((f) => ({ ...f, week_number: Number(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {campWeeks.map((w) => (
                      <SelectItem key={w.weekNum} value={String(w.weekNum)}>
                        Week {w.weekNum} ({format(w.start, "d MMM")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={entryForm.status} onValueChange={(v) => setEntryForm((f) => ({ ...f, status: v }))}>
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
                <Input
                  value={entryForm.venue}
                  onChange={(e) => setEntryForm((f) => ({ ...f, venue: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Age Group</Label>
                <Input
                  value={entryForm.age_group}
                  onChange={(e) => setEntryForm((f) => ({ ...f, age_group: e.target.value }))}
                  placeholder="e.g. U6-U12"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={entryForm.notes}
                onChange={(e) => setEntryForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {editingEntry?.linked_camp_id && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-md p-2">
                <Link2 className="h-3.5 w-3.5" />
                <span>Linked to camp record</span>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <div>
                {editingEntry && (
                  <Button variant="destructive" size="sm" onClick={() => deleteEntryMut.mutate(editingEntry.id)}>
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {editingEntry && !editingEntry.linked_camp_id && editingEntry.status !== "confirmed" && (
                  <Button variant="outline" size="sm" onClick={() => confirmMut.mutate(editingEntry)} disabled={confirmMut.isPending}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Confirm & Create Camp
                  </Button>
                )}
                <Button
                  onClick={() => {
                    if (!entryForm.club_name) return;
                    saveEntryMut.mutate(editingEntry ? { ...entryForm, id: editingEntry.id } : entryForm);
                  }}
                  disabled={saveEntryMut.isPending}
                >
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
