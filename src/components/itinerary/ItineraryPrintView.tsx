import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import ItineraryPdfExport from "./ItineraryPdfExport";

interface Block {
  start_time: string;
  end_time: string;
  block_title: string;
  description: string;
  linked_session_plan_id: string | null;
  linked_session_title?: string;
}

interface Day {
  day_number: number;
  title: string;
  theme: string;
  next_day_reminder: string;
  setup_notes: string;
  blocks: Block[];
}

interface Itinerary {
  title: string;
  camp_type: string;
  venue: string;
  team_format: string;
  cover_title: string;
  notes: string;
  num_days: number;
}

interface Props {
  itineraryId: string;
  onBack: () => void;
}

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = parseInt(h);
  const ampm = hr >= 12 ? "pm" : "am";
  const h12 = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${h12}:${m}${ampm}`;
}

export default function ItineraryPrintView({ itineraryId, onBack }: Props) {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [days, setDays] = useState<Day[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: it } = await supabase
        .from("itineraries")
        .select("*")
        .eq("id", itineraryId)
        .single();
      if (!it) return;
      const itData = it as any;
      setItinerary({
        title: itData.title,
        camp_type: itData.camp_type,
        venue: itData.venue,
        team_format: itData.team_format,
        cover_title: itData.cover_title || itData.title,
        notes: itData.notes,
        num_days: itData.num_days,
      });

      const { data: dayRows } = await supabase
        .from("itinerary_days")
        .select("*")
        .eq("itinerary_id", itineraryId)
        .order("day_number");

      const loadedDays: Day[] = [];
      for (const d of dayRows || []) {
        const dd = d as any;
        const { data: blockRows } = await supabase
          .from("itinerary_blocks")
          .select("*, session_plans(title)")
          .eq("day_id", dd.id)
          .order("sort_order");

        loadedDays.push({
          day_number: dd.day_number,
          title: dd.title,
          theme: dd.theme || "",
          next_day_reminder: dd.next_day_reminder || "",
          setup_notes: dd.setup_notes || "",
          blocks: (blockRows || []).map((b: any) => ({
            start_time: b.start_time,
            end_time: b.end_time,
            block_title: b.block_title,
            description: b.description || "",
            linked_session_plan_id: b.linked_session_plan_id,
            linked_session_title: b.session_plans?.title || null,
          })),
        });
      }
      setDays(loadedDays);
    };
    load();
  }, [itineraryId]);

  const handlePrint = () => {
    window.print();
  };

  if (!itinerary) return null;

  return (
    <div>
      {/* Screen-only controls */}
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold flex-1">{itinerary.title}</h1>
        <ItineraryPdfExport itinerary={itinerary} days={days} />
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <div ref={printRef} className="space-y-0 print:space-y-0">
        {/* Cover Page */}
        <div className="bg-primary text-primary-foreground rounded-xl p-12 text-center mb-8 print:rounded-none print:min-h-[100vh] print:flex print:flex-col print:justify-center print:mb-0 print:break-after-page">
          <div className="space-y-6">
            <div className="text-sm font-bold tracking-[0.3em] uppercase opacity-80">
              Teaching Tekkers
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.1]">
              {itinerary.cover_title || itinerary.title}
            </h1>
            {itinerary.camp_type && (
              <div className="text-lg font-semibold opacity-90 uppercase tracking-wider">
                {itinerary.camp_type}
              </div>
            )}
            {itinerary.team_format && (
              <div className="text-base opacity-70">{itinerary.team_format}</div>
            )}
          </div>
        </div>

        {/* Notes Page */}
        {itinerary.notes && (
          <div className="mb-8 print:break-after-page print:min-h-[100vh] print:mb-0">
            <div className="border rounded-xl p-8 print:border-none print:p-12">
              <h2 className="text-xl font-bold text-primary mb-4 uppercase tracking-wide">Notes & Instructions</h2>
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{itinerary.notes}</div>
            </div>
          </div>
        )}

        {/* Day Pages */}
        {days.map((day) => (
          <div
            key={day.day_number}
            className="mb-8 print:break-after-page print:min-h-[100vh] print:mb-0"
          >
            <div className="border rounded-xl overflow-hidden print:border-none">
              {/* Day header */}
              <div className="bg-primary text-primary-foreground px-6 py-4 print:py-6">
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-bold tracking-[0.2em] uppercase opacity-70">Teaching Tekkers</span>
                </div>
                <h2 className="text-2xl font-black mt-1 uppercase tracking-wide">
                  {day.title}
                  {day.theme && ` – ${day.theme}`}
                </h2>
              </div>

              {/* Setup notes */}
              {day.setup_notes && (
                <div className="bg-muted/50 px-6 py-3 text-sm text-muted-foreground border-b">
                  {day.setup_notes}
                </div>
              )}

              {/* Schedule blocks */}
              <div className="divide-y">
                {day.blocks.map((block, bi) => (
                  <div key={bi} className="flex gap-4 px-6 py-3 hover:bg-muted/30 transition-colors print:hover:bg-transparent">
                    <div className="w-32 shrink-0 text-sm font-semibold text-primary tabular-nums">
                      {formatTime(block.start_time)}
                      {block.end_time && (
                        <>
                          <span className="text-muted-foreground font-normal"> – </span>
                          {formatTime(block.end_time)}
                        </>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-foreground">
                        {block.block_title}
                      </div>
                      {block.description && (
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {block.description}
                        </div>
                      )}
                      {block.linked_session_title && (
                        <div className="text-xs text-primary mt-1 font-medium">
                          📋 {block.linked_session_title}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Next day reminder */}
              {day.next_day_reminder && (
                <div className="bg-accent/50 px-6 py-3 text-sm font-medium border-t">
                  📢 Tomorrow: <span className="text-primary">{day.next_day_reminder}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
