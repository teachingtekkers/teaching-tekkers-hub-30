import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shirt } from "lucide-react";
import type { ParticipantData } from "./AttendanceParticipantRow";
import { KIT_SIZE_OPTIONS, getKitSizeValue } from "@/lib/kitSizes";

interface Props {
  participants: ParticipantData[];
  kitGivenMap: Map<string, boolean>;
  onToggleKitGiven: (id: string, given: boolean) => void;
}

const SUMMARY_KIT_SIZES = KIT_SIZE_OPTIONS.filter((size) => size.includes("("));

export default function AttendanceKitSummary({ participants, kitGivenMap, onToggleKitGiven }: Props) {
  if (participants.length === 0) return null;

  const sizeCounts = SUMMARY_KIT_SIZES.map((size) => ({
    size,
    count: participants.filter((p) => getKitSizeValue(p.kit_size) === size).length,
  }));

  const customCounts = participants.reduce<Record<string, number>>((acc, p) => {
    const size = getKitSizeValue(p.kit_size);
    if (!SUMMARY_KIT_SIZES.includes(size as typeof SUMMARY_KIT_SIZES[number])) {
      acc[size] = (acc[size] || 0) + 1;
    }
    return acc;
  }, {});

  const givenCount = participants.filter((p) => kitGivenMap.get(p.id)).length;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shirt className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kit Sizes</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {givenCount}/{participants.length} given
          </Badge>
        </div>
        <div className="flex gap-3 flex-wrap">
          {sizeCounts.map(({ size, count }) => (
            <div key={size} className="text-center px-3 py-1.5 rounded-md bg-muted/50">
              <span className="text-xs text-muted-foreground block">{size}</span>
              <span className="text-lg font-bold text-foreground">{count}</span>
            </div>
          ))}
          {Object.entries(customCounts).map(([size, count]) => (
            <div key={size} className="text-center px-3 py-1.5 rounded-md bg-muted/50">
              <span className="text-xs text-muted-foreground block">{size}</span>
              <span className="text-lg font-bold text-foreground">{count}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-2 space-y-1 max-h-48 overflow-y-auto">
          {participants.map((p) => {
            const given = kitGivenMap.get(p.id) ?? false;
            return (
              <div
                key={p.id}
                className="flex items-center gap-2 py-1 px-1 rounded hover:bg-accent/30 cursor-pointer"
                onClick={() => onToggleKitGiven(p.id, !given)}
              >
                <Checkbox checked={given} onCheckedChange={(v) => onToggleKitGiven(p.id, !!v)} className="h-4 w-4" />
                <span className="text-xs flex-1 truncate">
                  {p.child_first_name} {p.child_last_name}
                </span>
                <Badge variant="outline" className="text-[10px] h-5">{getKitSizeValue(p.kit_size)}</Badge>
                {given && <span className="text-xs text-emerald-600">✔</span>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
