import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, FileCheck, Copy, Printer, Pencil, Trash2, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

export interface ItineraryRow {
  id: string;
  title: string;
  camp_type: string;
  venue: string;
  start_date: string | null;
  num_days: number;
  team_format: string;
  notes: string;
  cover_title: string;
  is_template: boolean;
  created_at: string;
}

interface Props {
  onSelect: (id: string) => void;
  onCreate: () => void;
  onPrint: (id: string) => void;
}

export default function ItineraryList({ onSelect, onCreate, onPrint }: Props) {
  const [items, setItems] = useState<ItineraryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("itineraries")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setItems(data as unknown as ItineraryRow[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleDuplicate = async (item: ItineraryRow) => {
    // duplicate itinerary + days + blocks
    const { data: newIt, error: e1 } = await supabase
      .from("itineraries")
      .insert({
        title: `${item.title} (Copy)`,
        camp_type: item.camp_type,
        venue: item.venue,
        start_date: item.start_date,
        num_days: item.num_days,
        team_format: item.team_format,
        notes: item.notes,
        cover_title: item.cover_title,
        is_template: item.is_template,
      } as any)
      .select()
      .single();
    if (e1 || !newIt) { toast({ title: "Error duplicating", variant: "destructive" }); return; }

    const { data: days } = await supabase
      .from("itinerary_days")
      .select("*")
      .eq("itinerary_id", item.id)
      .order("day_number");

    if (days) {
      for (const day of days) {
        const { data: newDay } = await supabase
          .from("itinerary_days")
          .insert({
            itinerary_id: (newIt as any).id,
            day_number: (day as any).day_number,
            title: (day as any).title,
            theme: (day as any).theme,
            next_day_reminder: (day as any).next_day_reminder,
            setup_notes: (day as any).setup_notes,
          } as any)
          .select()
          .single();

        if (newDay) {
          const { data: blocks } = await supabase
            .from("itinerary_blocks")
            .select("*")
            .eq("day_id", (day as any).id)
            .order("sort_order");

          if (blocks && blocks.length > 0) {
            await supabase.from("itinerary_blocks").insert(
              blocks.map((b: any) => ({
                day_id: (newDay as any).id,
                sort_order: b.sort_order,
                start_time: b.start_time,
                end_time: b.end_time,
                block_title: b.block_title,
                description: b.description,
                linked_session_plan_id: b.linked_session_plan_id,
                notes: b.notes,
              })) as any
            );
          }
        }
      }
    }

    toast({ title: "Itinerary duplicated" });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this itinerary?")) return;
    await supabase.from("itineraries").delete().eq("id", id);
    toast({ title: "Itinerary deleted" });
    fetchData();
  };

  const filtered = items.filter(
    (i) =>
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.camp_type.toLowerCase().includes(search.toLowerCase()) ||
      i.team_format.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Itineraries</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build and manage daily camp itineraries
          </p>
        </div>
        <Button onClick={onCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New Itinerary
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search itineraries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse h-44" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted mb-4">
            <FileCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {search ? "No matching itineraries" : "No itineraries yet"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {search
              ? "Try a different search term."
              : "Create your first camp itinerary to get started."}
          </p>
          {!search && (
            <Button onClick={onCreate} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> New Itinerary
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => onSelect(item.id)}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                    {item.title}
                  </h3>
                  {item.is_template && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      Template
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {item.camp_type && (
                    <Badge variant="outline" className="text-[10px]">
                      {item.camp_type}
                    </Badge>
                  )}
                  {item.team_format && (
                    <Badge variant="outline" className="text-[10px]">
                      {item.team_format}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    {item.num_days} days
                  </Badge>
                </div>

                {item.start_date && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(item.start_date), "dd MMM yyyy")}
                  </div>
                )}

                <div className="flex gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
                  >
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => { e.stopPropagation(); onPrint(item.id); }}
                  >
                    <Printer className="h-3 w-3 mr-1" /> Print
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(item); }}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
