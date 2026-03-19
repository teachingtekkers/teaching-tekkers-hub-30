import { useState, useRef } from "react";
import { Plus, Trash2, Trophy, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const COLOURS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

interface Team {
  name: string;
  colour: string;
}

interface Match {
  home: string;
  away: string;
  homeColour: string;
  awayColour: string;
}

interface Round {
  label: string;
  matches: Match[];
}

function generateRoundRobin(teams: Team[]): Round[] {
  const list = [...teams];
  // If odd number, add a "BYE"
  if (list.length % 2 !== 0) {
    list.push({ name: "BYE", colour: "#94a3b8" });
  }
  const n = list.length;
  const totalRounds = n - 1;
  const rounds: Round[] = [];

  for (let r = 0; r < totalRounds; r++) {
    const matches: Match[] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = list[i];
      const away = list[n - 1 - i];
      if (home.name !== "BYE" && away.name !== "BYE") {
        matches.push({
          home: home.name,
          away: away.name,
          homeColour: home.colour,
          awayColour: away.colour,
        });
      }
    }
    rounds.push({ label: `Round ${r + 1}`, matches });
    // Rotate all except first
    const last = list.pop()!;
    list.splice(1, 0, last);
  }
  return rounds;
}

const FixturesPage = () => {
  const [teamCount, setTeamCount] = useState("4");
  const [teams, setTeams] = useState<Team[]>(
    Array.from({ length: 4 }, (_, i) => ({ name: `Team ${i + 1}`, colour: COLOURS[i % COLOURS.length] }))
  );
  const [rounds, setRounds] = useState<Round[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  const handleTeamCountChange = (val: string) => {
    const count = Number(val);
    setTeamCount(val);
    setTeams(
      Array.from({ length: count }, (_, i) => ({
        name: teams[i]?.name || `Team ${i + 1}`,
        colour: teams[i]?.colour || COLOURS[i % COLOURS.length],
      }))
    );
    setRounds([]);
  };

  const updateTeamName = (idx: number, name: string) => {
    setTeams(teams.map((t, i) => (i === idx ? { ...t, name } : t)));
  };

  const updateTeamColour = (idx: number, colour: string) => {
    setTeams(teams.map((t, i) => (i === idx ? { ...t, colour } : t)));
  };

  const generate = () => {
    if (teams.some((t) => !t.name.trim())) {
      toast.error("Please fill in all team names");
      return;
    }
    const dupes = new Set(teams.map((t) => t.name.trim().toLowerCase()));
    if (dupes.size < teams.length) {
      toast.error("Team names must be unique");
      return;
    }
    setRounds(generateRoundRobin(teams));
    toast.success("Fixtures generated!");
  };

  const reset = () => {
    setRounds([]);
    setTeams(
      Array.from({ length: Number(teamCount) }, (_, i) => ({
        name: `Team ${i + 1}`,
        colour: COLOURS[i % COLOURS.length],
      }))
    );
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Fixtures</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; }
        h2 { margin-top: 20px; font-size: 16px; color: #666; }
        .match { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 14px; }
        .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
        .vs { color: #999; font-weight: 500; }
      </style></head><body>
      <h1>Fixtures</h1>
      ${printRef.current.innerHTML}
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fixtures Generator</h1>
          <p className="text-muted-foreground text-sm">Generate round-robin fixtures for camp tournaments</p>
        </div>
      </div>

      {/* Setup */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Setup Teams</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label>Number of Teams</Label>
            <Select value={teamCount} onValueChange={handleTeamCountChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[3, 4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} teams</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Team Names &amp; Colours</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {teams.map((team, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={team.colour}
                    onChange={(e) => updateTeamColour(i, e.target.value)}
                    className="h-9 w-9 rounded border cursor-pointer flex-shrink-0"
                  />
                  <Input
                    value={team.name}
                    onChange={(e) => updateTeamName(i, e.target.value)}
                    placeholder={`Team ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={generate}>
              <Trophy className="mr-2 h-4 w-4" />Generate Fixtures
            </Button>
            {rounds.length > 0 && (
              <>
                <Button variant="outline" onClick={handlePrint}>
                  <Printer className="mr-2 h-4 w-4" />Print
                </Button>
                <Button variant="ghost" onClick={reset}>
                  <RotateCcw className="mr-2 h-4 w-4" />Reset
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {rounds.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Generated Fixtures</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={printRef} className="space-y-5">
              {rounds.map((round) => (
                <div key={round.label}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{round.label}</p>
                  <div className="space-y-1.5">
                    {round.matches.map((m, mi) => (
                      <div key={mi} className="flex items-center gap-3 rounded-lg border p-3 bg-muted/20">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="dot h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.homeColour }} />
                          <span className="text-sm font-medium truncate">{m.home}</span>
                        </div>
                        <span className="vs text-muted-foreground text-sm font-medium">v</span>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className="text-sm font-medium truncate">{m.away}</span>
                          <span className="dot h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: m.awayColour }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {rounds.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No fixtures generated yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Set up your teams above and click "Generate Fixtures"</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FixturesPage;
