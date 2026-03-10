import { useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Car, MapPin } from "lucide-react";
import type { RosterCamp, DailyAssignment, RosterCoach, ExperienceLevel } from "@/pages/RosterPage";
import { getCampDays } from "@/pages/RosterPage";

interface Props {
  camps: RosterCamp[];
  assignments: DailyAssignment[];
  coaches: RosterCoach[];
  weekDays: Date[];
}

const EXP_COLORS: Record<ExperienceLevel, string> = {
  lead: "bg-purple-100 text-purple-800",
  senior: "bg-blue-100 text-blue-800",
  standard: "bg-emerald-100 text-emerald-800",
  junior: "bg-amber-100 text-amber-800",
};

interface CoachWeek {
  coach: RosterCoach;
  daySlots: { date: string; camp: RosterCamp | null; role: string; assignment: DailyAssignment | null }[];
  totalDays: number;
  campCount: number;
  isDriving: boolean;
}

export function RosterCoachView({ camps, assignments, coaches, weekDays }: Props) {
  const dayStrings = weekDays.map(d => format(d, "yyyy-MM-dd"));

  const coachWeeks = useMemo<CoachWeek[]>(() => {
    const coachIds = [...new Set(assignments.map(a => a.coach_id))];
    return coachIds.map(coachId => {
      const coach = coaches.find(c => c.id === coachId);
      if (!coach) return null;

      const coachAssignments = assignments.filter(a => a.coach_id === coachId);
      const daySlots = dayStrings.map(day => {
        const assignment = coachAssignments.find(a => a.days.includes(day));
        const camp = assignment ? camps.find(c => c.id === assignment.camp_id) || null : null;
        return { date: day, camp, role: assignment?.role || "", assignment };
      });

      const totalDays = daySlots.filter(s => s.camp).length;
      const campIds = new Set(coachAssignments.map(a => a.camp_id));
      const isDriving = coachAssignments.some(a => a.driving_this_week);

      return { coach, daySlots, totalDays, campCount: campIds.size, isDriving };
    }).filter(Boolean) as CoachWeek[];
  }, [assignments, coaches, camps, dayStrings]);

  if (coachWeeks.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No coaches assigned yet
        </CardContent>
      </Card>
    );
  }

  // Group coaches by whether they work multiple venues
  const multiVenue = coachWeeks.filter(cw => cw.campCount > 1);
  const singleVenue = coachWeeks.filter(cw => cw.campCount <= 1);

  const renderTable = (rows: CoachWeek[], label: string) => (
    <Card>
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm">{label}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left p-2 font-semibold min-w-[140px]">Coach</th>
              <th className="text-center p-2 font-semibold w-[50px]">🚗</th>
              {weekDays.map(d => (
                <th key={d.toISOString()} className="text-center p-2 font-semibold min-w-[120px]">
                  <div>{format(d, "EEE")}</div>
                  <div className="text-[10px] text-muted-foreground font-normal">{format(d, "d MMM")}</div>
                </th>
              ))}
              <th className="text-center p-2 font-semibold w-[50px]">Days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(cw => {
              const exp = EXP_COLORS[cw.coach.experience_level] || EXP_COLORS.standard;
              // Assign consistent colors to camps for this coach
              const campColorMap = new Map<string, string>();
              const colors = [
                "bg-blue-100 text-blue-800 border-blue-200",
                "bg-emerald-100 text-emerald-800 border-emerald-200",
                "bg-purple-100 text-purple-800 border-purple-200",
                "bg-orange-100 text-orange-800 border-orange-200",
                "bg-rose-100 text-rose-800 border-rose-200",
              ];
              let colorIdx = 0;
              cw.daySlots.forEach(s => {
                if (s.camp && !campColorMap.has(s.camp.id)) {
                  campColorMap.set(s.camp.id, colors[colorIdx % colors.length]);
                  colorIdx++;
                }
              });

              return (
                <tr key={cw.coach.id} className="border-b last:border-b-0 hover:bg-muted/20">
                  <td className="p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{cw.coach.full_name}</span>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${exp}`}>
                        {cw.coach.experience_level?.charAt(0).toUpperCase()}
                      </Badge>
                    </div>
                    {cw.coach.county && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                        <MapPin className="h-2.5 w-2.5" />{cw.coach.county}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {cw.isDriving && <Car className="h-3.5 w-3.5 text-[hsl(var(--success))] mx-auto" />}
                  </td>
                  {cw.daySlots.map(slot => (
                    <td key={slot.date} className="p-1 text-center">
                      {slot.camp ? (
                        <div className={`rounded px-1.5 py-1 border text-[10px] font-medium ${campColorMap.get(slot.camp.id) || "bg-muted"}`}>
                          <div className="truncate">{slot.camp.club_name}</div>
                          <div className="text-[9px] opacity-75 truncate">{slot.camp.venue}</div>
                          <Badge variant="outline" className="text-[8px] mt-0.5 px-1 py-0">
                            {slot.role === "head_coach" ? "HC" : "Asst"}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  ))}
                  <td className="p-2 text-center font-semibold">{cw.totalDays}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      {multiVenue.length > 0 && renderTable(multiVenue, `Multi-Venue Coaches (${multiVenue.length})`)}
      {singleVenue.length > 0 && renderTable(singleVenue, `Single-Venue Coaches (${singleVenue.length})`)}
    </div>
  );
}
