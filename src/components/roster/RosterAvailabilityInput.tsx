import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, ClipboardPaste, AlertTriangle, ArrowRight } from "lucide-react";
import type { RosterCoach } from "@/pages/RosterPage";

interface Props {
  allCoaches: RosterCoach[];
  onAvailabilitySet: (coachIds: string[]) => void;
  availabilitySet: boolean;
}

/** Levenshtein distance for typo tolerance */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/[''`]/g, "'").replace(/\s+/g, " ");
}

function matchScore(input: string, name: string): number {
  const a = normalise(input);
  const b = normalise(name);
  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 90;
  // Last name match
  const bParts = b.split(" ");
  const aParts = a.split(" ");
  if (bParts.some(p => p === a) || aParts.some(p => bParts.includes(p))) return 80;
  // First name + last initial ("craig s")
  if (aParts.length >= 2 && bParts.length >= 2) {
    if (aParts[0] === bParts[0] && bParts[bParts.length - 1].startsWith(aParts[aParts.length - 1])) return 75;
  }
  // Levenshtein on full name
  const dist = levenshtein(a, b);
  if (dist <= 2) return 70 - dist * 5;
  // Levenshtein on last name only
  if (bParts.length > 0) {
    const lastDist = levenshtein(aParts[aParts.length - 1] || a, bParts[bParts.length - 1]);
    if (lastDist <= 1) return 60;
  }
  return 0;
}

interface MatchResult {
  coach: RosterCoach;
  inputLine: string;
  score: number;
}

interface UnmatchedResult {
  inputLine: string;
  suggestions: { coach: RosterCoach; score: number }[];
  manualPick?: string; // coach id if manually resolved
}

export function RosterAvailabilityInput({ allCoaches, onAvailabilitySet, availabilitySet }: Props) {
  const [text, setText] = useState("");
  const [matched, setMatched] = useState<MatchResult[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedResult[]>([]);
  const [processed, setProcessed] = useState(false);

  const processNames = () => {
    const lines = text
      .split(/[\n,]+/)
      .map(l => l.trim().replace(/^\d+[\.\)]\s*/, "")) // strip numbered lists
      .filter(l => l.length >= 2 && l.length <= 100); // basic validation
    
    const seen = new Set<string>();
    const uniqueLines = lines.filter(l => {
      const key = normalise(l);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const matchResults: MatchResult[] = [];
    const noMatch: UnmatchedResult[] = [];
    const usedIds = new Set<string>();

    for (const line of uniqueLines) {
      let bestCoach: RosterCoach | null = null;
      let bestScore = 0;

      for (const c of allCoaches) {
        if (usedIds.has(c.id)) continue;
        const s = matchScore(line, c.full_name);
        if (s > bestScore) { bestScore = s; bestCoach = c; }
      }

      if (bestCoach && bestScore >= 60) {
        matchResults.push({ coach: bestCoach, inputLine: line, score: bestScore });
        usedIds.add(bestCoach.id);
      } else {
        // Find top 3 suggestions from remaining coaches
        const suggestions = allCoaches
          .filter(c => !usedIds.has(c.id))
          .map(c => ({ coach: c, score: matchScore(line, c.full_name) }))
          .filter(s => s.score > 20)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);
        noMatch.push({ inputLine: line, suggestions });
      }
    }

    setMatched(matchResults);
    setUnmatched(noMatch);
    setProcessed(true);
  };

  const resolveUnmatched = (inputLine: string, coachId: string) => {
    const coach = allCoaches.find(c => c.id === coachId);
    if (!coach) return;
    // Move from unmatched to matched
    setUnmatched(prev => prev.filter(u => u.inputLine !== inputLine));
    setMatched(prev => [...prev, { coach, inputLine, score: 50 }]);
  };

  const dismissUnmatched = (inputLine: string) => {
    setUnmatched(prev => prev.filter(u => u.inputLine !== inputLine));
  };

  const confirmAvailability = () => {
    onAvailabilitySet(matched.map(m => m.coach.id));
  };

  const selectAll = () => {
    onAvailabilitySet(allCoaches.map(c => c.id));
  };

  const usedCoachIds = new Set(matched.map(m => m.coach.id));

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
            Paste Coach Availability
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Paste names from WhatsApp (one per line or comma-separated). The system will match them to coach profiles using fuzzy matching.
          </p>
        </div>

        <Textarea
          placeholder={"Craig Staunton\nLuke Maher\nEoin Carolan\nDaniel Young\n..."}
          value={text}
          onChange={e => { setText(e.target.value.slice(0, 5000)); setProcessed(false); }}
          rows={5}
          className="font-mono text-sm"
          maxLength={5000}
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
                      {m.score < 80 && m.inputLine !== m.coach.full_name && (
                        <span className="text-muted-foreground ml-1">← {m.inputLine}</span>
                      )}
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
                <div className="space-y-2">
                  {unmatched.map((u) => (
                    <div key={u.inputLine} className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs text-destructive border-destructive/30 shrink-0">
                        {u.inputLine}
                      </Badge>
                      {u.suggestions.length > 0 ? (
                        <>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <Select onValueChange={(v) => resolveUnmatched(u.inputLine, v)}>
                            <SelectTrigger className="h-7 w-[200px] text-xs">
                              <SelectValue placeholder="Did you mean...?" />
                            </SelectTrigger>
                            <SelectContent>
                              {u.suggestions.map(s => (
                                <SelectItem key={s.coach.id} value={s.coach.id} disabled={usedCoachIds.has(s.coach.id)}>
                                  {s.coach.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">No close match found</span>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-muted-foreground" onClick={() => dismissUnmatched(u.inputLine)}>
                        Dismiss
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {matched.length > 0 && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={confirmAvailability}>
                  Confirm {matched.length} Available Coaches
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
