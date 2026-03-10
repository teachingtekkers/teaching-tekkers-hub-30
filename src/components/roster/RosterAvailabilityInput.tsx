import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ClipboardPaste, AlertTriangle } from "lucide-react";
import type { RosterCoach } from "@/pages/RosterPage";

interface Props {
  allCoaches: RosterCoach[];
  onAvailabilitySet: (coachIds: string[]) => void;
  availabilitySet: boolean;
}

function fuzzyMatch(input: string, name: string): boolean {
  const a = input.toLowerCase().trim();
  const b = name.toLowerCase().trim();
  if (b.includes(a) || a.includes(b)) return true;
  // Match last name
  const parts = b.split(" ");
  if (parts.some(p => p === a)) return true;
  // Match first + last initial
  return false;
}

export function RosterAvailabilityInput({ allCoaches, onAvailabilitySet, availabilitySet }: Props) {
  const [text, setText] = useState("");
  const [matched, setMatched] = useState<{ coach: RosterCoach; inputLine: string }[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [processed, setProcessed] = useState(false);

  const processNames = () => {
    const lines = text.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
    const matchResults: { coach: RosterCoach; inputLine: string }[] = [];
    const noMatch: string[] = [];
    const usedIds = new Set<string>();

    for (const line of lines) {
      const found = allCoaches.find(c => !usedIds.has(c.id) && fuzzyMatch(line, c.full_name));
      if (found) {
        matchResults.push({ coach: found, inputLine: line });
        usedIds.add(found.id);
      } else {
        noMatch.push(line);
      }
    }

    setMatched(matchResults);
    setUnmatched(noMatch);
    setProcessed(true);
  };

  const confirmAvailability = () => {
    onAvailabilitySet(matched.map(m => m.coach.id));
  };

  const selectAll = () => {
    onAvailabilitySet(allCoaches.map(c => c.id));
  };

  if (availabilitySet) {
    return (
      <Card className="border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-[hsl(var(--success))] shrink-0" />
          <div>
            <p className="font-medium text-sm">Availability confirmed</p>
            <p className="text-xs text-muted-foreground">Coach pool is set. Generate the roster or manually assign coaches below.</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => { onAvailabilitySet([]); setProcessed(false); setText(""); setMatched([]); setUnmatched([]); }}>
            Reset
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <p className="font-semibold text-sm flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-primary" />
            Step 3 — Paste Coach Availability
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Paste names from WhatsApp (one per line or comma-separated). The system will match them to coach profiles.
          </p>
        </div>

        <Textarea
          placeholder={"Craig Staunton\nJamie Hayes\nKate Foley\n..."}
          value={text}
          onChange={e => { setText(e.target.value); setProcessed(false); }}
          rows={6}
          className="font-mono text-sm"
        />

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={processNames} disabled={!text.trim()}>Match Names</Button>
          <Button size="sm" variant="outline" onClick={selectAll}>Use All Active Coaches</Button>
        </div>

        {processed && (
          <div className="space-y-3">
            {matched.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[hsl(var(--success))] mb-2">✓ Matched ({matched.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {matched.map(m => (
                    <Badge key={m.coach.id} variant="secondary" className="text-xs">
                      {m.coach.full_name}
                      {m.coach.can_drive && " 🚗"}
                      {(m.coach.is_head_coach || m.coach.role_type === "head_coach") && " ⭐"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {unmatched.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-destructive flex items-center gap-1 mb-2">
                  <AlertTriangle className="h-3 w-3" /> Unmatched ({unmatched.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unmatched.map((u, i) => (
                    <Badge key={i} variant="outline" className="text-xs text-destructive border-destructive/30">{u}</Badge>
                  ))}
                </div>
              </div>
            )}
            {matched.length > 0 && (
              <Button size="sm" onClick={confirmAvailability}>
                Confirm {matched.length} Available Coaches
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
