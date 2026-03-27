import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Car, UserPlus } from "lucide-react";
import type { RosterCoach, ExperienceLevel } from "@/pages/RosterPage";

const EXP_SHORT: Record<ExperienceLevel, string> = { lead: "L", senior: "S", standard: "St", junior: "J" };

interface Props {
  coaches: RosterCoach[];
  onDragStart: (coachId: string, fromCampId: string | null) => void;
  notInPool?: RosterCoach[];
  onAddToPool?: (coachId: string) => void;
}

export function RosterUnassignedPool({ coaches, onDragStart, notInPool, onAddToPool }: Props) {
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
              {c.role_type === "helper" && <span className="text-[10px] text-muted-foreground font-medium">[H]</span>}
              <span className="text-[10px] text-muted-foreground">[{EXP_SHORT[c.experience_level] || "St"}]</span>
              {c.county && <span className="text-muted-foreground text-[10px]">({c.county})</span>}
            </div>
          ))}
        </div>

        {notInPool && notInPool.length > 0 && onAddToPool && (
          <div className="mt-4 pt-3 border-t">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Active Staff Not in Pool ({notInPool.length})
            </p>
            <p className="text-[11px] text-muted-foreground mb-2">
              These staff are active but weren't included in the availability list. Click + to add them.
            </p>
            <div className="flex flex-wrap gap-2">
              {notInPool.map(c => (
                <div
                  key={c.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed bg-muted/30 text-xs"
                >
                  <span className="font-medium text-muted-foreground">{c.full_name}</span>
                  {c.role_type === "helper" && <span className="text-[10px] text-muted-foreground font-medium">[H]</span>}
                  {(c.is_head_coach || c.role_type === "head_coach") && <span>⭐</span>}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-1"
                    onClick={() => onAddToPool(c.id)}
                    title="Add to available pool"
                  >
                    <UserPlus className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
