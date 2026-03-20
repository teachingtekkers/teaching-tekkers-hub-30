import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileCheck, Calendar, ChevronRight } from "lucide-react";
import ItineraryPrintView from "@/components/itinerary/ItineraryPrintView";

interface ItineraryRow {
  id: string;
  title: string;
  camp_type: string;
  team_format: string;
  num_days: number;
}

export default function CoachItineraryPage() {
  const [items, setItems] = useState<ItineraryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("itineraries")
      .select("id, title, camp_type, team_format, num_days")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setItems(data as unknown as ItineraryRow[]);
        setLoading(false);
      });
  }, []);

  if (selectedId) {
    return (
      <div className="space-y-6">
        <ItineraryPrintView itineraryId={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-foreground">Camp Itinerary</h1>
          <p className="text-sm text-muted-foreground mt-1">Daily schedule and activities for your camps</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <Card key={i} className="animate-pulse h-20" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted mb-4">
            <FileCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">No Itineraries</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">No camp itineraries have been created yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedId(item.id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <div className="flex gap-1.5">
                    {item.camp_type && <Badge variant="outline" className="text-[10px]">{item.camp_type}</Badge>}
                    {item.team_format && <Badge variant="outline" className="text-[10px]">{item.team_format}</Badge>}
                    <Badge variant="outline" className="text-[10px]">{item.num_days} days</Badge>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
