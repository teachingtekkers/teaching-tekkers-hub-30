import { useState } from "react";
import { Plus, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockCamps } from "@/data/mock";
import { FixtureSet, FixtureTeam, FixtureMatch } from "@/types";
import { toast } from "sonner";

const COLOURS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

const FixturesPage = () => {
  const [fixtureSets, setFixtureSets] = useState<FixtureSet[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCampId, setSelectedCampId] = useState("");
  const [fixtureSetName, setFixtureSetName] = useState("");
  const [format, setFormat] = useState<FixtureSet["format"]>("group_stage");
  const [teams, setTeams] = useState<{ name: string; colour: string }[]>([
    { name: "", colour: COLOURS[0] },
    { name: "", colour: COLOURS[1] },
  ]);
  const [expandedSet, setExpandedSet] = useState<string | null>(null);

  const addTeam = () => {
    if (teams.length >= 8) return;
    setTeams([...teams, { name: "", colour: COLOURS[teams.length % COLOURS.length] }]);
  };
  const removeTeam = (idx: number) => {
    if (teams.length <= 2) return;
    setTeams(teams.filter((_, i) => i !== idx));
  };
  const updateTeam = (idx: number, field: "name" | "colour", value: string) => {
    setTeams(teams.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const generateGroupStageMatches = (teamsList: FixtureTeam[]): FixtureMatch[] => {
    const matches: FixtureMatch[] = [];
    let order = 1;
    for (let i = 0; i < teamsList.length; i++) {
      for (let j = i + 1; j < teamsList.length; j++) {
        matches.push({
          id: `m-${Date.now()}-${order}`, fixture_set_id: "", round_name: `Round ${Math.ceil(order / Math.floor(teamsList.length / 2))}`,
          kickoff_order: order, home_team_id: teamsList[i].id, away_team_id: teamsList[j].id,
          home_score: null, away_score: null, created_at: new Date().toISOString(),
        });
        order++;
      }
    }
    return matches;
  };

  const generateKnockoutMatches = (teamsList: FixtureTeam[]): FixtureMatch[] => {
    const matches: FixtureMatch[] = [];
    const rounds = Math.ceil(Math.log2(teamsList.length));
    let order = 1;
    for (let i = 0; i < teamsList.length; i += 2) {
      matches.push({
        id: `m-${Date.now()}-${order}`, fixture_set_id: "",
        round_name: rounds > 2 ? `Quarter Final` : rounds > 1 ? "Semi Final" : "Final",
        kickoff_order: order, home_team_id: teamsList[i]?.id || null, away_team_id: teamsList[i + 1]?.id || null,
        home_score: null, away_score: null, created_at: new Date().toISOString(),
      });
      order++;
    }
    let matchesInRound = Math.ceil(teamsList.length / 2);
    for (let r = 1; r < rounds; r++) {
      matchesInRound = Math.ceil(matchesInRound / 2);
      const roundName = matchesInRound === 1 ? "Final" : matchesInRound === 2 ? "Semi Final" : `Round ${r + 1}`;
      for (let m = 0; m < matchesInRound; m++) {
        matches.push({
          id: `m-${Date.now()}-${order}`, fixture_set_id: "", round_name: roundName,
          kickoff_order: order, home_team_id: null, away_team_id: null,
          home_score: null, away_score: null, created_at: new Date().toISOString(),
        });
        order++;
      }
    }
    return matches;
  };

  const handleGenerate = () => {
    if (!selectedCampId || !fixtureSetName || teams.some(t => !t.name.trim())) {
      toast.error("Please fill in all fields and team names"); return;
    }
    const setId = `fs-${Date.now()}`;
    const fixtureTeams: FixtureTeam[] = teams.map((t, i) => ({
      id: `ft-${Date.now()}-${i}`, fixture_set_id: setId, name: t.name, colour: t.colour, created_at: new Date().toISOString(),
    }));
    let matches: FixtureMatch[];
    if (format === "group_stage") {
      matches = generateGroupStageMatches(fixtureTeams);
    } else if (format === "knockout") {
      matches = generateKnockoutMatches(fixtureTeams);
    } else {
      matches = [
        ...generateGroupStageMatches(fixtureTeams),
        { id: `m-${Date.now()}-sf1`, fixture_set_id: setId, round_name: "Semi Final", kickoff_order: 100, home_team_id: null, away_team_id: null, home_score: null, away_score: null, created_at: new Date().toISOString() },
        { id: `m-${Date.now()}-sf2`, fixture_set_id: setId, round_name: "Semi Final", kickoff_order: 101, home_team_id: null, away_team_id: null, home_score: null, away_score: null, created_at: new Date().toISOString() },
        { id: `m-${Date.now()}-f`, fixture_set_id: setId, round_name: "Final", kickoff_order: 102, home_team_id: null, away_team_id: null, home_score: null, away_score: null, created_at: new Date().toISOString() },
      ];
    }
    matches = matches.map(m => ({ ...m, fixture_set_id: setId }));
    const newSet: FixtureSet = { id: setId, camp_id: selectedCampId, name: fixtureSetName, format, teams: fixtureTeams, matches, created_at: new Date().toISOString() };
    setFixtureSets([...fixtureSets, newSet]);
    setCreateOpen(false);
    setSelectedCampId(""); setFixtureSetName(""); setFormat("group_stage");
    setTeams([{ name: "", colour: COLOURS[0] }, { name: "", colour: COLOURS[1] }]);
    toast.success("Fixtures generated!");
  };

  const updateScore = (setId: string, matchId: string, field: "home_score" | "away_score", value: string) => {
    setFixtureSets(fixtureSets.map(fs => {
      if (fs.id !== setId) return fs;
      return { ...fs, matches: fs.matches.map(m => m.id === matchId ? { ...m, [field]: value === "" ? null : Number(value) } : m) };
    }));
  };

  const getTeamName = (set: FixtureSet, teamId: string | null) => !teamId ? "TBD" : set.teams.find(t => t.id === teamId)?.name || "TBD";
  const getTeamColour = (set: FixtureSet, teamId: string | null) => !teamId ? "#94a3b8" : set.teams.find(t => t.id === teamId)?.colour || "#94a3b8";
  const formatLabel = (f: FixtureSet["format"]) => {
    switch (f) { case "group_stage": return "Group Stage"; case "knockout": return "Knockout"; case "group_knockout": return "Group + Knockout"; }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fixtures</h1>
          <p className="text-muted-foreground text-sm">Generate and manage camp tournament fixtures</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Create Fixtures</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Generate Fixtures</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Camp</Label>
                <Select value={selectedCampId} onValueChange={setSelectedCampId}>
                  <SelectTrigger><SelectValue placeholder="Select camp" /></SelectTrigger>
                  <SelectContent>{mockCamps.map(c => <SelectItem key={c.id} value={c.id}>{c.name} — {c.club_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fixture Set Name</Label>
                <Input value={fixtureSetName} onChange={e => setFixtureSetName(e.target.value)} placeholder="e.g. Day 3 Tournament" />
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={v => setFormat(v as FixtureSet["format"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group_stage">Group Stage</SelectItem>
                    <SelectItem value="knockout">Knockout</SelectItem>
                    <SelectItem value="group_knockout">Group Stage + Knockout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Teams</Label>
                  <Button variant="outline" size="sm" onClick={addTeam} disabled={teams.length >= 8}><Plus className="mr-1 h-3 w-3" />Add</Button>
                </div>
                <div className="space-y-2">
                  {teams.map((team, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="color" value={team.colour} onChange={e => updateTeam(i, "colour", e.target.value)} className="h-9 w-9 rounded border cursor-pointer" />
                      <Input value={team.name} onChange={e => updateTeam(i, "name", e.target.value)} placeholder={`Team ${i + 1}`} className="flex-1" />
                      {teams.length > 2 && (
                        <Button variant="ghost" size="icon" onClick={() => removeTeam(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={handleGenerate} className="w-full">Generate Fixtures</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {fixtureSets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No fixtures created yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Click "Create Fixtures" to generate a tournament</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {fixtureSets.map(set => {
            const camp = mockCamps.find(c => c.id === set.camp_id);
            const isExpanded = expandedSet === set.id;
            const rounds = [...new Set(set.matches.map(m => m.round_name))];

            return (
              <Card key={set.id}>
                <div className="p-4 sm:p-5 cursor-pointer border-b" onClick={() => setExpandedSet(isExpanded ? null : set.id)}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{set.name}</h3>
                      <p className="text-sm text-muted-foreground">{camp?.name} · {camp?.club_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{formatLabel(set.format)}</Badge>
                      <Badge variant="outline">{set.teams.length} teams</Badge>
                      <Badge variant="outline">{set.matches.length} matches</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {set.teams.map(t => (
                      <span key={t.id} className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 border" style={{ borderColor: t.colour }}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.colour }} />
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="p-4 sm:p-5 space-y-5">
                    {rounds.map(round => (
                      <div key={round}>
                        <p className="section-label">{round}</p>
                        <div className="space-y-2">
                          {set.matches.filter(m => m.round_name === round).sort((a, b) => a.kickoff_order - b.kickoff_order).map(match => (
                            <div key={match.id} className="flex items-center gap-2 rounded-lg border p-3 bg-muted/20">
                              <span className="text-xs text-muted-foreground w-6">#{match.kickoff_order}</span>
                              <div className="flex items-center gap-1 flex-1 min-w-0">
                                <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: getTeamColour(set, match.home_team_id) }} />
                                <span className="text-sm font-medium truncate">{getTeamName(set, match.home_team_id)}</span>
                              </div>
                              <Input type="number" className="w-12 h-8 text-center" value={match.home_score ?? ""} onChange={e => updateScore(set.id, match.id, "home_score", e.target.value)} />
                              <span className="text-muted-foreground text-sm font-medium">v</span>
                              <Input type="number" className="w-12 h-8 text-center" value={match.away_score ?? ""} onChange={e => updateScore(set.id, match.id, "away_score", e.target.value)} />
                              <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                                <span className="text-sm font-medium truncate">{getTeamName(set, match.away_team_id)}</span>
                                <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: getTeamColour(set, match.away_team_id) }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FixturesPage;
