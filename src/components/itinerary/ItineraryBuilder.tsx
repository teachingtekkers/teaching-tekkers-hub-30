import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Link2 } from "lucide-react";

interface BlockRow {
  id?: string;
  sort_order: number;
  start_time: string;
  end_time: string;
  block_title: string;
  description: string;
  linked_session_plan_id: string | null;
  notes: string;
}

interface DayRow {
  id?: string;
  day_number: number;
  title: string;
  theme: string;
  next_day_reminder: string;
  setup_notes: string;
  blocks: BlockRow[];
}

interface ItineraryForm {
  title: string;
  camp_type: string;
  venue: string;
  start_date: string;
  num_days: number;
  team_format: string;
  notes: string;
  cover_title: string;
  is_template: boolean;
}

interface SessionPlanOption {
  id: string;
  title: string;
  category: string;
}

interface Props {
  itineraryId: string | null; // null = create new
  onBack: () => void;
  onSaved: () => void;
}

const TEAM_FORMATS = [
  "World Cup Teams",
  "Ballers League Teams",
  "Champions League Teams",
  "League of Ireland Teams",
  "Custom",
];

const CAMP_TYPES = ["Summer Camp", "Easter Camp", "Halloween Camp", "Mid-Term Camp", "Custom"];

const DEFAULT_BLOCKS: BlockRow[] = [
  { sort_order: 0, start_time: "09:45", end_time: "10:00", block_title: "Registration & Setup", description: "Session set up while head coach finishes registration.", linked_session_plan_id: null, notes: "" },
  { sort_order: 1, start_time: "10:00", end_time: "10:05", block_title: "Introduction", description: "Introduction of all coaches, reminder of no bullying and plan for the week.", linked_session_plan_id: null, notes: "" },
  { sort_order: 2, start_time: "10:05", end_time: "11:30", block_title: "Morning Session", description: "Fun games (Coach's Choice) – always start with penalties.", linked_session_plan_id: null, notes: "" },
  { sort_order: 3, start_time: "11:30", end_time: "11:45", block_title: "Small Break", description: "Set up camp games and get a small break.", linked_session_plan_id: null, notes: "" },
  { sort_order: 4, start_time: "11:45", end_time: "12:00", block_title: "Divide into Teams", description: "Decide how many teams based off numbers on the camp.", linked_session_plan_id: null, notes: "" },
  { sort_order: 5, start_time: "12:00", end_time: "12:50", block_title: "Camp Games", description: "", linked_session_plan_id: null, notes: "" },
  { sort_order: 6, start_time: "12:50", end_time: "13:20", block_title: "Big Lunch", description: "Set up pitches for matches.", linked_session_plan_id: null, notes: "" },
  { sort_order: 7, start_time: "13:20", end_time: "13:30", block_title: "Coaches Challenge", description: "", linked_session_plan_id: null, notes: "" },
  { sort_order: 8, start_time: "13:30", end_time: "14:45", block_title: "Matches on Fixture List", description: "", linked_session_plan_id: null, notes: "" },
  { sort_order: 9, start_time: "14:45", end_time: "15:00", block_title: "Clean Up & Home Time", description: "Ball Surfing and reminder about tomorrow.", linked_session_plan_id: null, notes: "" },
];

export default function ItineraryBuilder({ itineraryId, onBack, onSaved }: Props) {
  const [form, setForm] = useState<ItineraryForm>({
    title: "",
    camp_type: "Summer Camp",
    venue: "",
    start_date: "",
    num_days: 4,
    team_format: "World Cup Teams",
    notes: "",
    cover_title: "",
    is_template: false,
  });
  const [days, setDays] = useState<DayRow[]>([]);
  const [sessionPlans, setSessionPlans] = useState<SessionPlanOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeDay, setActiveDay] = useState("0");

  // Load session plans for linking
  useEffect(() => {
    supabase
      .from("session_plans")
      .select("id, title, session_plan_categories(name)")
      .order("title")
      .then(({ data }) => {
        if (data) {
          setSessionPlans(
            data.map((p: any) => ({
              id: p.id,
              title: p.title,
              category: p.session_plan_categories?.name || "",
            }))
          );
        }
      });
  }, []);

  // Load existing itinerary or initialize new
  const loadItinerary = useCallback(async () => {
    if (!itineraryId) {
      // Create default 4 days
      const defaultDays: DayRow[] = [
        { day_number: 1, title: "Day 1", theme: "", next_day_reminder: "", setup_notes: "Arrive latest 9:30am. The whole session set up at 9:45 while head coach finishes registration.", blocks: [...DEFAULT_BLOCKS.map(b => ({...b}))] },
        { day_number: 2, title: "Day 2", theme: "Crazy Hair Day", next_day_reminder: "", setup_notes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.", blocks: [...DEFAULT_BLOCKS.map(b => ({...b}))] },
        { day_number: 3, title: "Day 3", theme: "Player from Country Day", next_day_reminder: "", setup_notes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.", blocks: [...DEFAULT_BLOCKS.map(b => ({...b}))] },
        { day_number: 4, title: "Day 4 – Final Day", theme: "Flag Day", next_day_reminder: "", setup_notes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.", blocks: [...DEFAULT_BLOCKS.map(b => ({...b}))] },
      ];
      setDays(defaultDays);
      return;
    }

    const { data: it } = await supabase
      .from("itineraries")
      .select("*")
      .eq("id", itineraryId)
      .single();
    if (!it) return;
    const itData = it as any;
    setForm({
      title: itData.title || "",
      camp_type: itData.camp_type || "",
      venue: itData.venue || "",
      start_date: itData.start_date || "",
      num_days: itData.num_days || 4,
      team_format: itData.team_format || "",
      notes: itData.notes || "",
      cover_title: itData.cover_title || "",
      is_template: itData.is_template || false,
    });

    const { data: dayRows } = await supabase
      .from("itinerary_days")
      .select("*")
      .eq("itinerary_id", itineraryId)
      .order("day_number");

    if (dayRows && dayRows.length > 0) {
      const loadedDays: DayRow[] = [];
      for (const d of dayRows) {
        const dd = d as any;
        const { data: blockRows } = await supabase
          .from("itinerary_blocks")
          .select("*")
          .eq("day_id", dd.id)
          .order("sort_order");

        loadedDays.push({
          id: dd.id,
          day_number: dd.day_number,
          title: dd.title || "",
          theme: dd.theme || "",
          next_day_reminder: dd.next_day_reminder || "",
          setup_notes: dd.setup_notes || "",
          blocks: (blockRows || []).map((b: any) => ({
            id: b.id,
            sort_order: b.sort_order,
            start_time: b.start_time || "",
            end_time: b.end_time || "",
            block_title: b.block_title || "",
            description: b.description || "",
            linked_session_plan_id: b.linked_session_plan_id,
            notes: b.notes || "",
          })),
        });
      }
      setDays(loadedDays);
    }
  }, [itineraryId]);

  useEffect(() => { loadItinerary(); }, [loadItinerary]);

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Please enter a title", variant: "destructive" });
      return;
    }
    setSaving(true);

    try {
      let itId = itineraryId;

      if (itId) {
        await supabase.from("itineraries").update({
          title: form.title,
          camp_type: form.camp_type,
          venue: form.venue,
          start_date: form.start_date || null,
          num_days: form.num_days,
          team_format: form.team_format,
          notes: form.notes,
          cover_title: form.cover_title,
          is_template: form.is_template,
          updated_at: new Date().toISOString(),
        } as any).eq("id", itId);
      } else {
        const { data: newIt, error } = await supabase.from("itineraries").insert({
          title: form.title,
          camp_type: form.camp_type,
          venue: form.venue,
          start_date: form.start_date || null,
          num_days: form.num_days,
          team_format: form.team_format,
          notes: form.notes,
          cover_title: form.cover_title,
          is_template: form.is_template,
        } as any).select().single();
        if (error || !newIt) throw error;
        itId = (newIt as any).id;
      }

      // Delete existing days & blocks, then re-insert
      if (itineraryId) {
        const { data: existingDays } = await supabase
          .from("itinerary_days")
          .select("id")
          .eq("itinerary_id", itId!);
        if (existingDays) {
          for (const d of existingDays) {
            await supabase.from("itinerary_blocks").delete().eq("day_id", (d as any).id);
          }
          await supabase.from("itinerary_days").delete().eq("itinerary_id", itId!);
        }
      }

      // Insert days and blocks
      for (const day of days) {
        const { data: newDay } = await supabase.from("itinerary_days").insert({
          itinerary_id: itId,
          day_number: day.day_number,
          title: day.title,
          theme: day.theme,
          next_day_reminder: day.next_day_reminder,
          setup_notes: day.setup_notes,
        } as any).select().single();

        if (newDay && day.blocks.length > 0) {
          await supabase.from("itinerary_blocks").insert(
            day.blocks.map((b, i) => ({
              day_id: (newDay as any).id,
              sort_order: i,
              start_time: b.start_time,
              end_time: b.end_time,
              block_title: b.block_title,
              description: b.description,
              linked_session_plan_id: b.linked_session_plan_id || null,
              notes: b.notes,
            })) as any
          );
        }
      }

      toast({ title: itineraryId ? "Itinerary updated" : "Itinerary created" });
      onSaved();
    } catch (err) {
      toast({ title: "Error saving itinerary", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateDay = (index: number, field: keyof DayRow, value: any) => {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  const addDay = () => {
    const newNum = days.length + 1;
    setDays((prev) => [
      ...prev,
      {
        day_number: newNum,
        title: `Day ${newNum}`,
        theme: "",
        next_day_reminder: "",
        setup_notes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.",
        blocks: [...DEFAULT_BLOCKS.map(b => ({...b}))],
      },
    ]);
    setForm((prev) => ({ ...prev, num_days: prev.num_days + 1 }));
    setActiveDay(String(days.length));
  };

  const removeDay = (index: number) => {
    if (days.length <= 1) return;
    setDays((prev) => prev.filter((_, i) => i !== index).map((d, i) => ({ ...d, day_number: i + 1 })));
    setForm((prev) => ({ ...prev, num_days: prev.num_days - 1 }));
    if (parseInt(activeDay) >= days.length - 1) setActiveDay(String(Math.max(0, days.length - 2)));
  };

  const updateBlock = (dayIdx: number, blockIdx: number, field: keyof BlockRow, value: any) => {
    setDays((prev) =>
      prev.map((d, di) =>
        di === dayIdx
          ? {
              ...d,
              blocks: d.blocks.map((b, bi) => (bi === blockIdx ? { ...b, [field]: value } : b)),
            }
          : d
      )
    );
  };

  const addBlock = (dayIdx: number) => {
    setDays((prev) =>
      prev.map((d, di) =>
        di === dayIdx
          ? {
              ...d,
              blocks: [
                ...d.blocks,
                {
                  sort_order: d.blocks.length,
                  start_time: "",
                  end_time: "",
                  block_title: "",
                  description: "",
                  linked_session_plan_id: null,
                  notes: "",
                },
              ],
            }
          : d
      )
    );
  };

  const removeBlock = (dayIdx: number, blockIdx: number) => {
    setDays((prev) =>
      prev.map((d, di) =>
        di === dayIdx
          ? { ...d, blocks: d.blocks.filter((_, bi) => bi !== blockIdx) }
          : d
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {itineraryId ? "Edit Itinerary" : "New Itinerary"}
          </h1>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Itinerary Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itinerary Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <Label>Itinerary Title *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Summer Camps 2025" />
          </div>
          <div className="space-y-1.5">
            <Label>Cover Title</Label>
            <Input value={form.cover_title} onChange={(e) => setForm((f) => ({ ...f, cover_title: e.target.value }))} placeholder="e.g. TEACHING TEKKERS SUMMER CAMPS 2025" />
          </div>
          <div className="space-y-1.5">
            <Label>Camp Type</Label>
            <Select value={form.camp_type} onValueChange={(v) => setForm((f) => ({ ...f, camp_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAMP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Team Format</Label>
            <Select value={form.team_format} onValueChange={(v) => setForm((f) => ({ ...f, team_format: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEAM_FORMATS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Venue</Label>
            <Input value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Start Date</Label>
            <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="General notes..." />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <Switch checked={form.is_template} onCheckedChange={(v) => setForm((f) => ({ ...f, is_template: v }))} />
            <Label>Save as reusable template</Label>
          </div>
        </CardContent>
      </Card>

      {/* Day Tabs */}
      <Tabs value={activeDay} onValueChange={setActiveDay}>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <TabsList className="shrink-0">
            {days.map((d, i) => (
              <TabsTrigger key={i} value={String(i)} className="text-xs">
                Day {d.day_number}{d.theme ? ` – ${d.theme}` : ""}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button variant="outline" size="sm" onClick={addDay} className="shrink-0 gap-1">
            <Plus className="h-3 w-3" /> Add Day
          </Button>
        </div>

        {days.map((day, dayIdx) => (
          <TabsContent key={dayIdx} value={String(dayIdx)} className="space-y-4 mt-4">
            {/* Day header */}
            <Card>
              <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label>Day Title</Label>
                  <Input
                    value={day.title}
                    onChange={(e) => updateDay(dayIdx, "title", e.target.value)}
                    placeholder="e.g. Day 1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Theme</Label>
                  <Input
                    value={day.theme}
                    onChange={(e) => updateDay(dayIdx, "theme", e.target.value)}
                    placeholder="e.g. Crazy Hair Day"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Next Day Reminder</Label>
                  <Input
                    value={day.next_day_reminder}
                    onChange={(e) => updateDay(dayIdx, "next_day_reminder", e.target.value)}
                    placeholder="e.g. Dress the Coaches"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Setup Notes</Label>
                  <Input
                    value={day.setup_notes}
                    onChange={(e) => updateDay(dayIdx, "setup_notes", e.target.value)}
                    placeholder="Arrive latest 9:30am..."
                  />
                </div>
              </CardContent>
              {days.length > 1 && (
                <div className="px-6 pb-4">
                  <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => removeDay(dayIdx)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Remove Day
                  </Button>
                </div>
              )}
            </Card>

            {/* Blocks */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Schedule Blocks</h3>
                <Button variant="outline" size="sm" onClick={() => addBlock(dayIdx)} className="gap-1">
                  <Plus className="h-3 w-3" /> Add Block
                </Button>
              </div>

              {day.blocks.map((block, blockIdx) => (
                <Card key={blockIdx} className="border-l-4 border-l-primary/20">
                  <CardContent className="py-3 px-4">
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-1 flex items-center pt-6">
                        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                      <div className="col-span-11 sm:col-span-5 lg:col-span-2 space-y-1">
                        <Label className="text-[11px]">Time</Label>
                        <div className="flex gap-1 items-center">
                          <Input
                            type="time"
                            className="text-xs h-8"
                            value={block.start_time}
                            onChange={(e) => updateBlock(dayIdx, blockIdx, "start_time", e.target.value)}
                          />
                          <span className="text-muted-foreground text-xs">–</span>
                          <Input
                            type="time"
                            className="text-xs h-8"
                            value={block.end_time}
                            onChange={(e) => updateBlock(dayIdx, blockIdx, "end_time", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="col-span-12 sm:col-span-6 lg:col-span-3 space-y-1">
                        <Label className="text-[11px]">Block Title</Label>
                        <Input
                          className="text-xs h-8"
                          value={block.block_title}
                          onChange={(e) => updateBlock(dayIdx, blockIdx, "block_title", e.target.value)}
                          placeholder="e.g. Morning Session"
                        />
                      </div>
                      <div className="col-span-12 lg:col-span-3 space-y-1">
                        <Label className="text-[11px]">Description</Label>
                        <Input
                          className="text-xs h-8"
                          value={block.description}
                          onChange={(e) => updateBlock(dayIdx, blockIdx, "description", e.target.value)}
                          placeholder="Details..."
                        />
                      </div>
                      <div className="col-span-10 lg:col-span-2 space-y-1">
                        <Label className="text-[11px]">Linked Session</Label>
                        <Select
                          value={block.linked_session_plan_id || "none"}
                          onValueChange={(v) => updateBlock(dayIdx, blockIdx, "linked_session_plan_id", v === "none" ? null : v)}
                        >
                          <SelectTrigger className="text-xs h-8">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {sessionPlans.map((sp) => (
                              <SelectItem key={sp.id} value={sp.id}>
                                {sp.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 lg:col-span-1 flex justify-end pt-5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive/60 hover:text-destructive"
                          onClick={() => removeBlock(dayIdx, blockIdx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
