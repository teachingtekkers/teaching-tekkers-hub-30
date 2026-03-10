import { Card, CardContent } from "@/components/ui/card";
import { Car } from "lucide-react";
import type { RosterCoach, ExperienceLevel } from "@/pages/RosterPage";

const EXP_SHORT: Record<ExperienceLevel, string> = { lead: "L", senior: "S", standard: "St", junior: "J" };

interface Props {
  coaches: RosterCoach[];
  onDragStart: (coachId: string, fromCampId: string | null) => void;
}

export function RosterUnassignedPool({ coaches, onDragStart }: Props) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Unassigned Available Coaches ({coaches.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {coaches.map(c => (
            <div
              key={c.id}
              draggable
              onDragStart={() => onDragStart(c.id, null)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-card text-xs cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors"
            >
              <span className="font-medium">{c.full_name}</span>
              {c.can_drive && <Car className="h-3 w-3 text-[hsl(var(--success))]" />}
              {(c.is_head_coach || c.role_type === "head_coach") && <span title="HC eligible">⭐</span>}
              <span className="text-[10px] text-muted-foreground">[{EXP_SHORT[c.experience_level] || "St"}]</span>
              {c.county && <span className="text-muted-foreground text-[10px]">({c.county})</span>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
