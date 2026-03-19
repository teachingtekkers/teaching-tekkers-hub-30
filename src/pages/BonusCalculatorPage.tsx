import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { startOfWeek, format } from "date-fns";
import {
  Plus, Pencil, Trash2, Trophy, Medal, TrendingUp,
  DollarSign, CheckCircle2, Users, Star, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

/* ── constants ── */
const WEEKS = Array.from({ length: 8 }, (_, i) => `Week ${i + 1}`);
const COACH_PRIZES = [250, 100, 50];
const HC_PRIZES = [750, 250, 100];

/* ── business logic helpers ── */
function calcSatisfaction(club: number, parent: number): number {
  return Math.round(((club + parent) / 2) * 10) / 10;
}
function calcBonusPerStaff(satisfaction: number): number {
  if (satisfaction >= 9.0) return 20;
  if (satisfaction >= 7.5) return 10;
  return 0;
}
function calcRatingPoints(score: number): number {
  if (score >= 9.0) return 2;
  if (score >= 7.5) return 1;
  return 0;
}

/* ── types ── */
interface CampWeekScore {
  id: string;
  camp_id: string;
  week_label: string;
  club_score: number;
  parent_score_avg: number;
  club_would_return: boolean;
  status: string;
  notes: string | null;
  created_at: string;
}
interface StaffWeekPoint {
  id: string;
  coach_id: string;
  camp_id: string;
  week_label: string;
  role_that_week: string;
  attendance_complete: boolean;
  hc_rating_score: number | null;
  notes: string | null;
  created_at: string;
}
interface CoachOption { id: string; full_name: string; is_head_coach: boolean; }
interface CampOption { id: string; name: string; start_date: string; }

export default function BonusCalculatorPage() {
  const [campScores, setCampScores] = useState<CampWeekScore[]>([]);
  const [staffPoints, setStaffPoints] = useState<StaffWeekPoint[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [camps, setCamps] = useState<CampOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterWeek, setFilterWeek] = useState<string>("all");

  /* Camp score dialog */
  const [csDialogOpen, setCsDialogOpen] = useState(false);
  const [csEditingId, setCsEditingId] = useState<string | null>(null);
  const [csForm, setCsForm] = useState({
    camp_id: "", week_label: "Week 1", club_score: 0, parent_score_avg: 0,
    club_would_return: false, status: "draft", notes: "",
  });

  /* Staff points dialog */
  const [spDialogOpen, setSpDialogOpen] = useState(false);
  const [spEditingId, setSpEditingId] = useState<string | null>(null);
  const [spForm, setSpForm] = useState({
    coach_id: "", camp_id: "", week_label: "Week 1", role_that_week: "assistant",
    attendance_complete: false, hc_rating_score: "", notes: "",
  });

  /* ── data fetching ── */
  const fetchAll = async () => {
    const [csRes, spRes, coachRes, campRes] = await Promise.all([
      supabase.from("camp_week_scores").select("*").order("week_label"),
      supabase.from("staff_week_points").select("*").order("week_label"),
      supabase.from("coaches").select("id, full_name, is_head_coach").order("full_name"),
      supabase.from("camps").select("id, name").order("name"),
    ]);
    setCampScores((csRes.data || []) as unknown as CampWeekScore[]);
    setStaffPoints((spRes.data || []) as unknown as StaffWeekPoint[]);
    setCoaches((coachRes.data || []) as CoachOption[]);
    setCamps((campRes.data || []) as CampOption[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  /* ── maps ── */
  const coachMap = useMemo(() => new Map(coaches.map(c => [c.id, c])), [coaches]);
  const campMap = useMemo(() => new Map(camps.map(c => [c.id, c.name])), [camps]);
  const scoreKey = (campId: string, week: string) => `${campId}::${week}`;
  const scoreMap = useMemo(() => {
    const m = new Map<string, CampWeekScore>();
    campScores.forEach(cs => m.set(scoreKey(cs.camp_id, cs.week_label), cs));
    return m;
  }, [campScores]);

  /* ── compute points for a staff record ── */
  function computePoints(sp: StaffWeekPoint) {
    const cs = scoreMap.get(scoreKey(sp.camp_id, sp.week_label));
    const satisfaction = cs ? calcSatisfaction(cs.club_score, cs.parent_score_avg) : 0;
    const attPts = sp.attendance_complete ? 1 : 0;
    const satPts = calcRatingPoints(satisfaction);
    let thirdPts = 0;
    if (sp.role_that_week === "head_coach") {
      thirdPts = cs?.club_would_return ? 2 : 0;
    } else {
      thirdPts = calcRatingPoints(sp.hc_rating_score || 0);
    }
    return { attPts, satPts, thirdPts, total: attPts + satPts + thirdPts, satisfaction };
  }

  /* ── filtered data ── */
  const filteredScores = useMemo(() => {
    if (filterWeek === "all") return campScores;
    return campScores.filter(cs => cs.week_label === filterWeek);
  }, [campScores, filterWeek]);

  const filteredPoints = useMemo(() => {
    if (filterWeek === "all") return staffPoints;
    return staffPoints.filter(sp => sp.week_label === filterWeek);
  }, [staffPoints, filterWeek]);

  /* ── leaderboards with role determination + tiebreakers ── */
  const { coachBoard, hcBoard } = useMemo(() => {
    const agg = new Map<string, {
      totalPts: number; attPts: number; satSum: number; satCount: number;
      weeksAsCoach: number; weeksAsHC: number; weeks: number;
    }>();

    staffPoints.forEach(sp => {
      const pts = computePoints(sp);
      const entry = agg.get(sp.coach_id) || {
        totalPts: 0, attPts: 0, satSum: 0, satCount: 0,
        weeksAsCoach: 0, weeksAsHC: 0, weeks: 0,
      };
      entry.totalPts += pts.total;
      entry.attPts += pts.attPts;
      entry.satSum += pts.satisfaction;
      entry.satCount += 1;
      entry.weeks += 1;
      if (sp.role_that_week === "head_coach") entry.weeksAsHC++;
      else entry.weeksAsCoach++;
      agg.set(sp.coach_id, entry);
    });

    const coachEntries: LeaderEntry[] = [];
    const hcEntries: LeaderEntry[] = [];

    agg.forEach((d, coachId) => {
      const coach = coachMap.get(coachId);
      const entry: LeaderEntry = {
        coachId,
        name: coach?.full_name || "Unknown",
        totalPts: d.totalPts,
        attPts: d.attPts,
        avgSat: d.satCount > 0 ? Math.round((d.satSum / d.satCount) * 10) / 10 : 0,
        weeks: d.weeks,
        rank: 0,
      };
      // Place in board for role performed most often; equal → HC
      if (d.weeksAsHC >= d.weeksAsCoach && d.weeksAsHC > 0) {
        hcEntries.push(entry);
      } else {
        coachEntries.push(entry);
      }
    });

    const sortFn = (a: LeaderEntry, b: LeaderEntry) => {
      if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
      if (b.attPts !== a.attPts) return b.attPts - a.attPts;
      return b.avgSat - a.avgSat;
    };

    coachEntries.sort(sortFn);
    hcEntries.sort(sortFn);

    return {
      coachBoard: coachEntries.map((e, i) => ({ ...e, rank: i + 1 })),
      hcBoard: hcEntries.map((e, i) => ({ ...e, rank: i + 1 })),
    };
  }, [staffPoints, scoreMap, coachMap]);

  /* ── Camp Score CRUD ── */
  const openNewCampScore = () => {
    setCsForm({ camp_id: "", week_label: "Week 1", club_score: 0, parent_score_avg: 0, club_would_return: false, status: "draft", notes: "" });
    setCsEditingId(null);
    setCsDialogOpen(true);
  };
  const openEditCampScore = (cs: CampWeekScore) => {
    setCsForm({
      camp_id: cs.camp_id, week_label: cs.week_label,
      club_score: cs.club_score, parent_score_avg: cs.parent_score_avg,
      club_would_return: cs.club_would_return, status: cs.status, notes: cs.notes || "",
    });
    setCsEditingId(cs.id);
    setCsDialogOpen(true);
  };
  const saveCampScore = async () => {
    if (!csForm.camp_id) { toast.error("Camp is required"); return; }
    const payload = {
      camp_id: csForm.camp_id,
      week_label: csForm.week_label,
      club_score: Number(csForm.club_score) || 0,
      parent_score_avg: Number(csForm.parent_score_avg) || 0,
      club_would_return: csForm.club_would_return,
      status: csForm.status,
      notes: csForm.notes || null,
      updated_at: new Date().toISOString(),
    };
    if (csEditingId) {
      const { error } = await supabase.from("camp_week_scores").update(payload).eq("id", csEditingId);
      if (error) { toast.error("Failed: " + error.message); return; }
      toast.success("Camp score updated");
    } else {
      const { error } = await supabase.from("camp_week_scores").insert([payload]);
      if (error) { toast.error("Failed: " + error.message); return; }
      toast.success("Camp score created");
    }
    setCsDialogOpen(false);
    fetchAll();
  };
  const deleteCampScore = async (id: string) => {
    await supabase.from("camp_week_scores").delete().eq("id", id);
    toast.success("Deleted");
    fetchAll();
  };

  /* ── Staff Points CRUD ── */
  const openNewStaffPoint = () => {
    setSpForm({ coach_id: "", camp_id: "", week_label: "Week 1", role_that_week: "assistant", attendance_complete: false, hc_rating_score: "", notes: "" });
    setSpEditingId(null);
    setSpDialogOpen(true);
  };
  const openEditStaffPoint = (sp: StaffWeekPoint) => {
    setSpForm({
      coach_id: sp.coach_id, camp_id: sp.camp_id, week_label: sp.week_label,
      role_that_week: sp.role_that_week, attendance_complete: sp.attendance_complete,
      hc_rating_score: sp.hc_rating_score != null ? String(sp.hc_rating_score) : "",
      notes: sp.notes || "",
    });
    setSpEditingId(sp.id);
    setSpDialogOpen(true);
  };
  const saveStaffPoint = async () => {
    if (!spForm.coach_id || !spForm.camp_id) { toast.error("Staff and camp are required"); return; }
    const payload = {
      coach_id: spForm.coach_id,
      camp_id: spForm.camp_id,
      week_label: spForm.week_label,
      role_that_week: spForm.role_that_week,
      attendance_complete: spForm.attendance_complete,
      hc_rating_score: spForm.hc_rating_score ? Number(spForm.hc_rating_score) : null,
      notes: spForm.notes || null,
    };
    if (spEditingId) {
      const { error } = await supabase.from("staff_week_points").update(payload).eq("id", spEditingId);
      if (error) { toast.error("Failed: " + error.message); return; }
      toast.success("Staff points updated");
    } else {
      const { error } = await supabase.from("staff_week_points").insert([payload]);
      if (error) { toast.error("Failed: " + error.message); return; }
      toast.success("Staff points created");
    }
    setSpDialogOpen(false);
    fetchAll();
  };
  const deleteStaffPoint = async (id: string) => {
    await supabase.from("staff_week_points").delete().eq("id", id);
    toast.success("Deleted");
    fetchAll();
  };

  /* ── summary stats ── */
  const totalBonusPayout = useMemo(() => {
    let total = 0;
    campScores.forEach(cs => {
      const sat = calcSatisfaction(cs.club_score, cs.parent_score_avg);
      const bonus = calcBonusPerStaff(sat);
      const staffCount = staffPoints.filter(sp => sp.camp_id === cs.camp_id && sp.week_label === cs.week_label).length;
      total += bonus * staffCount;
    });
    return total;
  }, [campScores, staffPoints]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const csSatisfaction = calcSatisfaction(Number(csForm.club_score), Number(csForm.parent_score_avg));
  const csBonus = calcBonusPerStaff(csSatisfaction);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bonus Calculator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Weekly camp bonuses &amp; 8-week staff leaderboard
          </p>
        </div>
        <Select value={filterWeek} onValueChange={setFilterWeek}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Weeks</SelectItem>
            {WEEKS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{campScores.length}</p>
                <p className="text-xs text-muted-foreground">Camp Scores</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{staffPoints.length}</p>
                <p className="text-xs text-muted-foreground">Staff Point Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">€{totalBonusPayout}</p>
                <p className="text-xs text-muted-foreground">Camp Bonus Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-400/20">
                <Trophy className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                {coachBoard[0] ? (
                  <>
                    <Link to={`/coaches/${coachBoard[0].coachId}`} className="text-sm font-bold text-primary hover:underline">
                      {coachBoard[0].name}
                    </Link>
                    <p className="text-xs text-muted-foreground">Coach Leader · {coachBoard[0].totalPts} pts</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No data yet</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="camp-scores" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="camp-scores">Camp Scores</TabsTrigger>
          <TabsTrigger value="staff-points">Staff Points</TabsTrigger>
          <TabsTrigger value="coach-board">Coach Board</TabsTrigger>
          <TabsTrigger value="hc-board">HC Board</TabsTrigger>
          <TabsTrigger value="prizes">Prizes</TabsTrigger>
        </TabsList>

        {/* ── Tab: Camp Scores ── */}
        <TabsContent value="camp-scores" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewCampScore} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Add Camp Score
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Camp</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead className="text-center">Club (0–10)</TableHead>
                    <TableHead className="text-center">Parent Avg (0–10)</TableHead>
                    <TableHead className="text-center">Satisfaction</TableHead>
                    <TableHead className="text-center">Bonus/Staff</TableHead>
                    <TableHead className="text-center">Club Return</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScores.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                        No camp scores yet. Add one to get started.
                      </TableCell>
                    </TableRow>
                  ) : filteredScores.map(cs => {
                    const sat = calcSatisfaction(cs.club_score, cs.parent_score_avg);
                    const bonus = calcBonusPerStaff(sat);
                    return (
                      <TableRow key={cs.id} className="cursor-pointer group" onClick={() => openEditCampScore(cs)}>
                        <TableCell>
                          <Link to={`/camps/${cs.camp_id}`} onClick={e => e.stopPropagation()} className="text-sm font-medium text-primary hover:underline">
                            {campMap.get(cs.camp_id) || "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{cs.week_label}</TableCell>
                        <TableCell className="text-center text-sm">{cs.club_score}</TableCell>
                        <TableCell className="text-center text-sm">{cs.parent_score_avg}</TableCell>
                        <TableCell className="text-center font-semibold text-sm">{sat.toFixed(1)}</TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          {bonus > 0 ? <span className="text-emerald-600">€{bonus}</span> : "€0"}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {cs.club_would_return ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" /> : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{cs.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEditCampScore(cs); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); deleteCampScore(cs.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Staff Points ── */}
        <TabsContent value="staff-points" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewStaffPoint} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Add Staff Points
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Camp</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-center">Attended</TableHead>
                    <TableHead className="text-center">Att</TableHead>
                    <TableHead className="text-center">Sat</TableHead>
                    <TableHead className="text-center">HC/Ret</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPoints.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                        No staff point records yet.
                      </TableCell>
                    </TableRow>
                  ) : filteredPoints.map(sp => {
                    const pts = computePoints(sp);
                    const coach = coachMap.get(sp.coach_id);
                    return (
                      <TableRow key={sp.id} className="cursor-pointer group" onClick={() => openEditStaffPoint(sp)}>
                        <TableCell>
                          <Link to={`/coaches/${sp.coach_id}`} onClick={e => e.stopPropagation()} className="text-sm font-medium text-primary hover:underline">
                            {coach?.full_name || "—"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link to={`/camps/${sp.camp_id}`} onClick={e => e.stopPropagation()} className="text-sm text-primary hover:underline">
                            {campMap.get(sp.camp_id) || "—"}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{sp.week_label}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {sp.role_that_week === "head_coach" ? "Head Coach" : "Coach"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {sp.attendance_complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" /> : "—"}
                        </TableCell>
                        <TableCell className="text-center text-sm">{pts.attPts}</TableCell>
                        <TableCell className="text-center text-sm">{pts.satPts}</TableCell>
                        <TableCell className="text-center text-sm">{pts.thirdPts}</TableCell>
                        <TableCell className="text-center font-semibold text-sm">{pts.total}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEditStaffPoint(sp); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); deleteStaffPoint(sp.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Coach Leaderboard ── */}
        <TabsContent value="coach-board">
          <LeaderboardTable title="Coach Leaderboard" board={coachBoard} prizes={COACH_PRIZES} />
        </TabsContent>

        {/* ── Tab: HC Leaderboard ── */}
        <TabsContent value="hc-board">
          <LeaderboardTable title="Head Coach Leaderboard" board={hcBoard} prizes={HC_PRIZES} />
        </TabsContent>

        {/* ── Tab: Prizes ── */}
        <TabsContent value="prizes" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PrizeCard title="Coach Prizes" board={coachBoard} prizes={COACH_PRIZES} />
            <PrizeCard title="Head Coach Prizes" board={hcBoard} prizes={HC_PRIZES} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" /> Weekly Camp Bonus Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Camp</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead className="text-center">Satisfaction</TableHead>
                    <TableHead className="text-center">Bonus/Staff</TableHead>
                    <TableHead className="text-center">Staff Count</TableHead>
                    <TableHead className="text-right">Week Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campScores.map(cs => {
                    const sat = calcSatisfaction(cs.club_score, cs.parent_score_avg);
                    const bonus = calcBonusPerStaff(sat);
                    const count = staffPoints.filter(sp => sp.camp_id === cs.camp_id && sp.week_label === cs.week_label).length;
                    return (
                      <TableRow key={cs.id}>
                        <TableCell className="text-sm">
                          <Link to={`/camps/${cs.camp_id}`} className="text-primary hover:underline">{campMap.get(cs.camp_id) || "—"}</Link>
                        </TableCell>
                        <TableCell className="text-sm">{cs.week_label}</TableCell>
                        <TableCell className="text-center text-sm">{sat.toFixed(1)}</TableCell>
                        <TableCell className="text-center text-sm">€{bonus}</TableCell>
                        <TableCell className="text-center text-sm">{count}</TableCell>
                        <TableCell className="text-right font-medium text-sm">€{bonus * count}</TableCell>
                      </TableRow>
                    );
                  })}
                  {campScores.length > 0 && (
                    <TableRow className="border-t-2">
                      <TableCell colSpan={5} className="text-right font-semibold">Grand Total</TableCell>
                      <TableCell className="text-right font-bold">€{totalBonusPayout}</TableCell>
                    </TableRow>
                  )}
                  {campScores.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">No camp scores yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Camp Score Dialog ── */}
      <Dialog open={csDialogOpen} onOpenChange={setCsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{csEditingId ? "Edit Camp Score" : "New Camp Score"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Camp *</Label>
              <Select value={csForm.camp_id || "none"} onValueChange={v => setCsForm(f => ({ ...f, camp_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select camp…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select camp…</SelectItem>
                  {camps.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Week</Label>
                <Select value={csForm.week_label} onValueChange={v => setCsForm(f => ({ ...f, week_label: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={csForm.status} onValueChange={v => setCsForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Club Score (0–10)</Label>
                <Input type="number" min={0} max={10} step={0.1} value={csForm.club_score} onChange={e => setCsForm(f => ({ ...f, club_score: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Parent Score Avg (0–10)</Label>
                <Input type="number" min={0} max={10} step={0.1} value={csForm.parent_score_avg} onChange={e => setCsForm(f => ({ ...f, parent_score_avg: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="rounded-md bg-muted px-3 py-2 text-sm space-y-1">
              <div><span className="text-muted-foreground">Overall Satisfaction:</span> <span className="font-semibold">{csSatisfaction.toFixed(1)}</span></div>
              <div><span className="text-muted-foreground">Bonus per Staff:</span> <span className="font-semibold text-emerald-600">€{csBonus}</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={csForm.club_would_return} onCheckedChange={v => setCsForm(f => ({ ...f, club_would_return: !!v }))} id="club-return" />
              <Label htmlFor="club-return" className="text-sm">Club confirms they would happily run another camp</Label>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={csForm.notes} onChange={e => setCsForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCsDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveCampScore}>{csEditingId ? "Save" : "Create"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Staff Points Dialog ── */}
      <Dialog open={spDialogOpen} onOpenChange={setSpDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{spEditingId ? "Edit Staff Points" : "New Staff Points"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Staff Member *</Label>
              <Select value={spForm.coach_id || "none"} onValueChange={v => setSpForm(f => ({ ...f, coach_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select staff…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select staff…</SelectItem>
                  {coaches.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Camp *</Label>
              <Select value={spForm.camp_id || "none"} onValueChange={v => setSpForm(f => ({ ...f, camp_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select camp…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select camp…</SelectItem>
                  {camps.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Week</Label>
                <Select value={spForm.week_label} onValueChange={v => setSpForm(f => ({ ...f, week_label: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role That Week</Label>
                <Select value={spForm.role_that_week} onValueChange={v => setSpForm(f => ({ ...f, role_that_week: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assistant">Coach</SelectItem>
                    <SelectItem value="head_coach">Head Coach</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={spForm.attendance_complete} onCheckedChange={v => setSpForm(f => ({ ...f, attendance_complete: !!v }))} id="attendance" />
              <Label htmlFor="attendance" className="text-sm">Full attendance (all 4 days)</Label>
            </div>
            {spForm.role_that_week === "assistant" && (
              <div>
                <Label>Head Coach Rating (0–10)</Label>
                <Input type="number" min={0} max={10} step={0.1} value={spForm.hc_rating_score} onChange={e => setSpForm(f => ({ ...f, hc_rating_score: e.target.value }))} placeholder="Head coach rates this staff member" />
                <p className="text-[11px] text-muted-foreground mt-1">9–10 = 2pts · 7.5–8.99 = 1pt · below 7.5 = 0pts</p>
              </div>
            )}
            {spForm.role_that_week === "head_coach" && (
              <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
                Head coach points use camp satisfaction score + club return confirmation from the Camp Scores tab.
              </p>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={spForm.notes} onChange={e => setSpForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSpDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveStaffPoint}>{spEditingId ? "Save" : "Create"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── helper types ── */
interface LeaderEntry {
  coachId: string;
  name: string;
  totalPts: number;
  attPts: number;
  avgSat: number;
  weeks: number;
  rank: number;
}

/* ── Leaderboard Table component ── */
function LeaderboardTable({ title, board, prizes }: { title: string; board: LeaderEntry[]; prizes: number[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] text-center">Rank</TableHead>
              <TableHead>Staff Member</TableHead>
              <TableHead className="text-center">Total Pts</TableHead>
              <TableHead className="text-center">Att Pts</TableHead>
              <TableHead className="text-center">Avg Sat</TableHead>
              <TableHead className="text-center">Weeks</TableHead>
              <TableHead className="text-right">Prize</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {board.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">No data yet.</TableCell>
              </TableRow>
            ) : board.map(e => (
              <TableRow key={e.coachId}>
                <TableCell className="text-center font-bold">
                  {e.rank <= 3 ? (
                    <Medal className={`h-5 w-5 mx-auto ${e.rank === 1 ? "text-yellow-500" : e.rank === 2 ? "text-gray-400" : "text-amber-700"}`} />
                  ) : e.rank}
                </TableCell>
                <TableCell>
                  <Link to={`/coaches/${e.coachId}`} className="text-sm font-medium text-primary hover:underline">{e.name}</Link>
                </TableCell>
                <TableCell className="text-center font-semibold">{e.totalPts}</TableCell>
                <TableCell className="text-center text-sm">{e.attPts}</TableCell>
                <TableCell className="text-center text-sm">{e.avgSat.toFixed(1)}</TableCell>
                <TableCell className="text-center text-sm">{e.weeks}</TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {e.rank <= 3 ? <span className="text-emerald-600">€{prizes[e.rank - 1]}</span> : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ── Prize Card component ── */
function PrizeCard({ title, board, prizes }: { title: string; board: LeaderEntry[]; prizes: number[] }) {
  const top3 = board.slice(0, 3);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5 text-yellow-500" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {top3.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="space-y-3">
            {top3.map((e, i) => (
              <div key={e.coachId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Medal className={`h-6 w-6 ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-700"}`} />
                  <div>
                    <Link to={`/coaches/${e.coachId}`} className="text-sm font-semibold text-primary hover:underline">{e.name}</Link>
                    <p className="text-xs text-muted-foreground">{e.totalPts} pts · {e.weeks} weeks</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-emerald-600">€{prizes[i]}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
