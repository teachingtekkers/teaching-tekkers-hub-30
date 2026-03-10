import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsersRound, AlertTriangle } from "lucide-react";
import type { ParticipantData } from "./AttendanceParticipantRow";

interface FamilyGroup {
  familyKey: string;
  familyLabel: string;
  members: ParticipantData[];
}

interface Props {
  participants: ParticipantData[];
}

export default function AttendanceFamilyGroups({ participants }: Props) {
  if (participants.length === 0) return null;

  // Group by parent_name or parent_email
  const familyMap = new Map<string, ParticipantData[]>();
  for (const p of participants) {
    const key = (p.parent_email || p.parent_name || "").toLowerCase().trim();
    if (!key) continue;
    if (!familyMap.has(key)) familyMap.set(key, []);
    familyMap.get(key)!.push(p);
  }

  // Only keep groups with 2+ children (siblings)
  const families: FamilyGroup[] = [];
  for (const [key, members] of familyMap) {
    if (members.length >= 2) {
      const lastName = members[0].child_last_name;
      const allSameLast = members.every((m) => m.child_last_name === lastName);
      const familyLabel = allSameLast
        ? `${lastName} Family`
        : `${members[0].parent_name || lastName} Family`;
      families.push({ familyKey: key, familyLabel, members });
    }
  }

  // Detect duplicate bookings (same first+last name)
  const nameMap = new Map<string, ParticipantData[]>();
  for (const p of participants) {
    const nameKey = `${p.child_first_name} ${p.child_last_name}`.toLowerCase();
    if (!nameMap.has(nameKey)) nameMap.set(nameKey, []);
    nameMap.get(nameKey)!.push(p);
  }
  const duplicates = Array.from(nameMap.entries()).filter(([, ps]) => ps.length >= 2);

  if (families.length === 0 && duplicates.length === 0) return null;

  return (
    <div className="space-y-3">
      {families.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Family Bookings ({families.length})
              </span>
            </div>
            <div className="space-y-2">
              {families.map((f) => (
                <div key={f.familyKey} className="rounded-md border p-2">
                  <span className="text-xs font-semibold text-foreground">{f.familyLabel}</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {f.members.map((m) => (
                      <Badge key={m.id} variant="secondary" className="text-xs">
                        {m.child_first_name} {m.child_last_name}
                        {m.age != null && <span className="ml-1 text-muted-foreground">({m.age})</span>}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {duplicates.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Possible Duplicates ({duplicates.length})
              </span>
            </div>
            {duplicates.map(([name, ps]) => (
              <div key={name} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground capitalize">{name}</span>
                {" — "}
                {ps.length} bookings found
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
