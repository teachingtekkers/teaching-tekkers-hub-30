import { useState, useEffect, useMemo, useCallback } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isWeekend, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { Wallet, Users, Tent, Wand2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { PayrollWeekSelector } from "@/components/payroll/PayrollWeekSelector";
import { PayrollCoachView } from "@/components/payroll/PayrollCoachView";
import { PayrollCampView } from "@/components/payroll/PayrollCampView";
import { PayrollExport } from "@/components/payroll/PayrollExport";
import type { DailyAssignment } from "@/pages/RosterPage";

// ---------- Types ----------

interface PayrollCamp {
  id: string;
  name: string;
  club_name: string;
  start_date: string;
  end_date: string;
}

interface PayrollCoach {
  id: string;
  full_name: string;
  daily_rate: number;
  head_coach_daily_rate: number;
  fuel_allowance_eligible: boolean;
  can_drive: boolean;
}

export interface PayrollCampEntry {
  campId: string;
  campName: string;
  clubName: string;
  role: "head_coach" | "assistant";
  daysWorked: number;
  dailyRate: number;
  basePay: number;
  fuel: number;
  campBonus: number;
  bonus: number;
  adjustment: number;
  lineTotal: number;
  drivingThisWeek: boolean;
}

export interface PayrollLine {
  coachId: string;
  coachName: string;
  entries: PayrollCampEntry[];
}

const DEFAULT_FUEL = 20;

function calcSatisfaction(club: number, parent: number): number {
  return Math.round(((club + parent) / 2) * 10) / 10;
}
function calcCampBonus(satisfaction: number): number {
  if (satisfaction >= 9.0) return 20;
  if (satisfaction >= 7.5) return 10;
  return 0;
}

interface ApprovedCampBonus {
  campId: string;
  bonusPerStaff: number;
}

// ---------- Component ----------

const PayrollPage = () => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [camps, setCamps] = useState<PayrollCamp[]>([]);
  const [coaches, setCoaches] = useState<PayrollCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [payrollLines, setPayrollLines] = useState<PayrollLine[]>([]);
  const [generated, setGenerated] = useState(false);
  const [rosterStatus, setRosterStatus] = useState<string | null>(null);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setGenerated(false);
      setPayrollLines([]);
      setRosterStatus(null);
      const wsISO = format(weekStart, "yyyy-MM-dd");
      const weISO = format(weekEnd, "yyyy-MM-dd");

      const [campsRes, coachesRes, rosterRes] = await Promise.all([
        supabase.from("camps").select("id, name, club_name, start_date, end_date")
          .lte("start_date", weISO).gte("end_date", wsISO).order("name"),
        supabase.from("coaches").select("id, full_name, daily_rate, head_coach_daily_rate, fuel_allowance_eligible, can_drive")
          .eq("status", "active").order("full_name"),
        supabase.from("weekly_rosters").select("assignments, status").eq("week_start", wsISO).maybeSingle(),
      ]);

      if (campsRes.error || coachesRes.error) {
        toast({ title: "Error loading data", variant: "destructive" });
        setLoading(false);
        return;
      }

      const campsList = campsRes.data || [];
      const coachesList = (coachesRes.data as PayrollCoach[]) || [];
      setCamps(campsList);
      setCoaches(coachesList);
      setRosterStatus(rosterRes.data?.status || null);

      // Fetch approved camp bonuses for camps active this week
      const campIds = campsList.map(c => c.id);
      let approvedBonuses: ApprovedCampBonus[] = [];
      if (campIds.length > 0) {
        const { data: scoreData } = await supabase
          .from("camp_week_scores")
          .select("camp_id, club_score, parent_score_avg, status")
          .in("camp_id", campIds)
          .eq("status", "approved");
        if (scoreData) {
          approvedBonuses = scoreData.map(s => ({
            campId: s.camp_id,
            bonusPerStaff: calcCampBonus(calcSatisfaction(Number(s.club_score), Number(s.parent_score_avg))),
          }));
        }
      }

      // Auto-generate payroll if a finalised roster exists
      if (rosterRes.data?.status === "finalised" && rosterRes.data.assignments) {
        buildPayroll(
          rosterRes.data.assignments as unknown as DailyAssignment[],
          campsList,
          coachesList,
          approvedBonuses
        );
      }

      setLoading(false);
    };
    load();
  }, [selectedDate]);

  const buildPayroll = useCallback((rosterAssignments: DailyAssignment[], campsList: PayrollCamp[], coachesList: PayrollCoach[], approvedBonuses: ApprovedCampBonus[] = []) => {
    const coachMap = new Map(coachesList.map(c => [c.id, c]));
    const campMap = new Map(campsList.map(c => [c.id, c]));
    const bonusMap = new Map(approvedBonuses.map(b => [b.campId, b.bonusPerStaff]));
    const linesByCoach = new Map<string, PayrollLine>();

    for (const asgn of rosterAssignments) {
      const coach = coachMap.get(asgn.coach_id);
      const camp = campMap.get(asgn.camp_id);
      if (!coach || !camp) continue;

      const daysWorked = asgn.days.length;
      if (daysWorked === 0) continue;

      const role = asgn.role;
      const dailyRate = role === "head_coach" ? coach.head_coach_daily_rate : coach.daily_rate;
      const basePay = dailyRate * daysWorked;
      const fuel = (asgn.driving_this_week && coach.fuel_allowance_eligible) ? DEFAULT_FUEL : 0;
      const campBonus = bonusMap.get(camp.id) || 0;

      const entry: PayrollCampEntry = {
        campId: camp.id, campName: camp.name, clubName: camp.club_name,
        role, daysWorked, dailyRate, basePay, fuel,
        campBonus, bonus: 0, adjustment: 0,
        lineTotal: basePay + fuel + campBonus,
        drivingThisWeek: !!asgn.driving_this_week,
      };

      if (!linesByCoach.has(coach.id)) {
        linesByCoach.set(coach.id, { coachId: coach.id, coachName: coach.full_name, entries: [] });
      }
      linesByCoach.get(coach.id)!.entries.push(entry);
    }

    setPayrollLines(Array.from(linesByCoach.values()).sort((a, b) => a.coachName.localeCompare(b.coachName)));
    setGenerated(true);
  }, []);

  const generatePayroll = useCallback(async () => {
    const wsISO = format(weekStart, "yyyy-MM-dd");
    const weISO = format(weekEnd, "yyyy-MM-dd");
    const { data, error } = await supabase.from("weekly_rosters")
      .select("assignments, status").eq("week_start", wsISO).maybeSingle();

    if (error || !data) {
      sonnerToast.error("No saved roster found for this week. Save a roster first.");
      return;
    }

    if (data.status !== "finalised") {
      sonnerToast.error("Roster must be finalised before generating payroll. Go to Roster and click Finalise.");
      return;
    }

    // Fetch approved bonuses
    const campIds = camps.map(c => c.id);
    let approvedBonuses: ApprovedCampBonus[] = [];
    if (campIds.length > 0) {
      const { data: scoreData } = await supabase
        .from("camp_week_scores")
        .select("camp_id, club_score, parent_score_avg, status")
        .in("camp_id", campIds)
        .eq("status", "approved");
      if (scoreData) {
        approvedBonuses = scoreData.map(s => ({
          campId: s.camp_id,
          bonusPerStaff: calcCampBonus(calcSatisfaction(Number(s.club_score), Number(s.parent_score_avg))),
        }));
      }
    }

    buildPayroll(data.assignments as unknown as DailyAssignment[], camps, coaches, approvedBonuses);
    sonnerToast.success("Payroll generated from finalised roster");
  }, [weekStart, weekEnd, camps, coaches, buildPayroll]);

  const updateEntry = useCallback((coachId: string, campId: string, field: "fuel" | "bonus" | "adjustment", value: number) => {
    setPayrollLines(prev => prev.map(line => {
      if (line.coachId !== coachId) return line;
      return {
        ...line,
        entries: line.entries.map(e => {
          if (e.campId !== campId) return e;
          const updated = { ...e, [field]: value };
          updated.lineTotal = updated.basePay + updated.fuel + updated.campBonus + updated.bonus + updated.adjustment;
          return updated;
        }),
      };
    }));
  }, []);

  const coachSummaries = useMemo(() => payrollLines.map(line => {
    const totalPay = line.entries.reduce((s, e) => s + e.basePay, 0);
    const totalFuel = line.entries.reduce((s, e) => s + e.fuel, 0);
    const totalCampBonus = line.entries.reduce((s, e) => s + e.campBonus, 0);
    const totalBonus = line.entries.reduce((s, e) => s + e.bonus, 0);
    const totalAdjustment = line.entries.reduce((s, e) => s + e.adjustment, 0);
    const grandTotal = line.entries.reduce((s, e) => s + e.lineTotal, 0);
    return { coachId: line.coachId, coachName: line.coachName, entries: line.entries, totalPay, totalFuel, totalCampBonus, totalBonus, totalAdjustment, grandTotal };
  }), [payrollLines]);

  const campGroups = useMemo(() => {
    const groups = new Map<string, { campId: string; campName: string; clubName: string; entries: (PayrollCampEntry & { coachName: string })[]; campTotal: number }>();
    payrollLines.forEach(line => {
      line.entries.forEach(e => {
        if (!groups.has(e.campId)) groups.set(e.campId, { campId: e.campId, campName: e.campName, clubName: e.clubName, entries: [], campTotal: 0 });
        const g = groups.get(e.campId)!;
        g.entries.push({ ...e, coachName: line.coachName });
        g.campTotal += e.lineTotal;
      });
    });
    return Array.from(groups.values());
  }, [payrollLines]);

  const weekTotal = coachSummaries.reduce((s, cs) => s + cs.grandTotal, 0);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <PayrollWeekSelector
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        weekStart={weekStart}
        weekEnd={weekEnd}
        onPrevWeek={() => setSelectedDate(subWeeks(selectedDate, 1))}
        onNextWeek={() => setSelectedDate(addWeeks(selectedDate, 1))}
      />

      <div className="stat-grid">
        <StatCard label="Total Payroll" value={`€${weekTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon={Wallet} />
        <StatCard label="Coaches" value={coachSummaries.length} icon={Users} />
        <StatCard label="Camps" value={new Set(payrollLines.flatMap(l => l.entries.map(e => e.campId))).size} icon={Tent} />
      </div>

      {/* Roster status indicator */}
      {rosterStatus && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Roster status:</span>
          <Badge variant={rosterStatus === "finalised" ? "default" : "secondary"}>
            {rosterStatus === "finalised" ? "✅ Finalised" : "📝 Draft"}
          </Badge>
          {rosterStatus === "draft" && (
            <span className="text-xs text-muted-foreground">(Finalise the roster before generating payroll)</span>
          )}
          <Link to="/roster" className="text-xs text-primary hover:underline ml-2">View Roster →</Link>
        </div>
      )}

      {!generated ? (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <Wallet className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="text-muted-foreground font-medium">No payroll generated for this week</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Payroll reads from the saved & finalised weekly roster — each coach's actual daily working blocks.
              </p>
            </div>
            <Button onClick={generatePayroll} className="gap-2">
              <Wand2 className="h-4 w-4" /> Generate from Roster
            </Button>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Requires a finalised roster for this week</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => { setGenerated(false); setPayrollLines([]); }}>Reset</Button>
            <Button onClick={generatePayroll} variant="outline" className="gap-2"><Wand2 className="h-4 w-4" /> Regenerate</Button>
            <PayrollExport coachSummaries={coachSummaries} weekStart={weekStart} weekEnd={weekEnd} weekTotal={weekTotal} />
          </div>
          <Tabs defaultValue="coach">
            <TabsList>
              <TabsTrigger value="coach">By Coach</TabsTrigger>
              <TabsTrigger value="camp">By Camp</TabsTrigger>
            </TabsList>
            <TabsContent value="coach" className="mt-4">
              <PayrollCoachView coachSummaries={coachSummaries} onUpdateEntry={updateEntry} />
            </TabsContent>
            <TabsContent value="camp" className="mt-4">
              <PayrollCampView campGroups={campGroups} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default PayrollPage;
