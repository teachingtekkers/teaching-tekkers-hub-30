import { useState, useEffect } from "react";
import { format, parseISO, startOfWeek } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, ExternalLink } from "lucide-react";

interface SavedRoster {
  id: string;
  week_start: string;
  status: string;
  camps_count: number;
  coaches_count: number;
  updated_at: string;
}

interface Props {
  onLoadRoster: (weekDate: Date) => void;
  currentWeekStart: string;
}

export function RosterHistory({ onLoadRoster, currentWeekStart }: Props) {
  const [rosters, setRosters] = useState<SavedRoster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("weekly_rosters")
        .select("id, week_start, status, camps_count, coaches_count, updated_at")
        .order("week_start", { ascending: false })
        .limit(20);
      setRosters(data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <Card className="p-6 text-center text-muted-foreground text-sm">Loading roster history…</Card>;
  }

  if (rosters.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Calendar className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No saved rosters yet</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-4 border-b">
        <h3 className="font-semibold">Saved Rosters</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Week Commencing</TableHead>
            <TableHead className="text-center">Camps</TableHead>
            <TableHead className="text-center">Coaches</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rosters.map(r => {
            const isCurrent = r.week_start === currentWeekStart;
            return (
              <TableRow key={r.id} className={isCurrent ? "bg-primary/5" : ""}>
                <TableCell className="font-medium">
                  {format(parseISO(r.week_start), "EEEE d MMMM yyyy")}
                  {isCurrent && <Badge variant="outline" className="ml-2 text-xs">Current</Badge>}
                </TableCell>
                <TableCell className="text-center">{r.camps_count}</TableCell>
                <TableCell className="text-center">{r.coaches_count}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={r.status === "finalised" ? "default" : "secondary"} className="text-xs">
                    {r.status === "finalised" ? "Finalised" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(parseISO(r.updated_at), "d MMM yyyy HH:mm")}
                </TableCell>
                <TableCell>
                  {!isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onLoadRoster(startOfWeek(parseISO(r.week_start), { weekStartsOn: 1 }))}
                      className="gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
