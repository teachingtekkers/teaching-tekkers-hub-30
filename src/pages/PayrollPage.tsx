import { useState, useEffect, useMemo, useCallback } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isWeekend, parseISO } from "date-fns";
import { DollarSign, Wallet, Users, Tent, Wand2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { PayrollWeekSelector } from "@/components/payroll/PayrollWeekSelector";
import { PayrollCoachView } from "@/components/payroll/PayrollCoachView";
import { PayrollCampView } from "@/components/payroll/PayrollCampView";
import { PayrollExport } from "@/components/payroll/PayrollExport";

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

/** A roster-derived assignment that feeds payroll */
interface RosterAssignment {
  camp_id: string;
  coach_id: string;
  role: "head_coach" | "assistant";
  days: string[]; // yyyy-MM-dd dates the coach is working
  driving_this_week: boolean;
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

// ---------- Helpers ----------

const DEFAULT_FUEL = 20;

function getCampWeekDays(camp: PayrollCamp, weekStart: Date, weekEnd: Date): string[] {
  const cStart = parseISO(camp.start_date);
  const cEnd = parseISO(camp.end_date);
  const rangeStart = cStart > weekStart ? cStart : weekStart;
  const rangeEnd = cEnd < weekEnd ? cEnd : weekEnd;
  if (rangeStart > rangeEnd) return [];
  return eachDayOfInterval({ start: rangeStart, end: rangeEnd })
    .filter(d => !isWeekend(d))
    .map(d => format(d, "yyyy-MM-dd"));
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

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  // Load camps + coaches for the selected week
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setGenerated(false);
      setPayrollLines([]);
      const wsISO = format(weekStart, "yyyy-MM-dd");
      const weISO = format(weekEnd, "yyyy-MM-dd");

      const [campsRes, coachesRes] = await Promise.all([
        supabase.from("camps").select("id, name, club_name, start_date, end_date")
          .lte("start_date", weISO).gte("end_date", wsISO).order("name"),
        supabase.from("coaches").select("id, full_name, daily_rate, head_coach_daily_rate, fuel_allowance_eligible, can_drive")
          .eq("status", "active").order("full_name"),
      ]);

      if (campsRes.error || coachesRes.error) {
        toast({ title: "Error loading data", variant: "destructive" });
        setLoading(false);
        return;
      }

      setCamps(campsRes.data || []);
      setCoaches((coachesRes.data as PayrollCoach[]) || []);
      setLoading(false);
    };
    load();
  }, [selectedDate]);

  // Generate payroll from roster assignments (camp_coach_assignments table)
  const generatePayroll = useCallback(async () => {
    if (camps.length === 0) {
      sonnerToast.error("No camps this week");
      return;
    }

    const campIds = camps.map(c => c.id);

    // Load actual assignments from DB
    const { data: assignmentData, error } = await supabase
      .from("camp_coach_assignments")
      .select("camp_id, coach_id, role, notes")
      .in("camp_id", campIds);

    if (error) {
      toast({ title: "Error loading assignments", variant: "destructive" });
      return;
    }

    if (!assignmentData || assignmentData.length === 0) {
      sonnerToast.error("No coach assignments found for this week's camps. Generate a roster first.");
      return;
    }

    // Build payroll lines — each assignment becomes one PayrollCampEntry per coach per camp
    const coachMap = new Map(coaches.map(c => [c.id, c]));
    const campMap = new Map(camps.map(c => [c.id, c]));
    const linesByCoach = new Map<string, PayrollLine>();

    for (const asgn of assignmentData) {
      const coach = coachMap.get(asgn.coach_id);
      const camp = campMap.get(asgn.camp_id);
      if (!coach || !camp) continue;

      const days = getCampWeekDays(camp, weekStart, weekEnd);
      const daysWorked = days.length;
      if (daysWorked === 0) continue;

      const role = asgn.role as "head_coach" | "assistant";
      const dailyRate = role === "head_coach" ? coach.head_coach_daily_rate : coach.daily_rate;
      const basePay = dailyRate * daysWorked;
      // Fuel: only if coach is fuel-eligible and can drive — admin can override
      const fuel = (coach.fuel_allowance_eligible && coach.can_drive) ? DEFAULT_FUEL : 0;

      const entry: PayrollCampEntry = {
        campId: camp.id,
        campName: camp.name,
        clubName: camp.club_name,
        role,
        daysWorked,
        dailyRate,
        basePay,
        fuel,
        bonus: 0,
        adjustment: 0,
        lineTotal: basePay + fuel,
        drivingThisWeek: coach.can_drive,
      };

      if (!linesByCoach.has(coach.id)) {
        linesByCoach.set(coach.id, { coachId: coach.id, coachName: coach.full_name, entries: [] });
      }
      linesByCoach.get(coach.id)!.entries.push(entry);
    }

    setPayrollLines(Array.from(linesByCoach.values()).sort((a, b) => a.coachName.localeCompare(b.coachName)));
    setGenerated(true);
    sonnerToast.success(`Payroll generated for ${linesByCoach.size} coaches`);
  }, [camps, coaches, weekStart, weekEnd, toast]);

  // Update a single entry field
  const updateEntry = useCallback((coachId: string, campId: string, field: "fuel" | "bonus" | "adjustment", value: number) => {
    setPayrollLines(prev => prev.map(line => {
      if (line.coachId !== coachId) return line;
      return {
        ...line,
        entries: line.entries.map(e => {
          if (e.campId !== campId) return e;
          const updated = { ...e, [field]: value };
          updated.lineTotal = updated.basePay + updated.fuel + updated.bonus + updated.adjustment;
          return updated;
        }),
      };
    }));
  }, []);

  // Compute summaries
  const coachSummaries = useMemo(() => payrollLines.map(line => {
    const totalPay = line.entries.reduce((s, e) => s + e.basePay, 0);
    const totalFuel = line.entries.reduce((s, e) => s + e.fuel, 0);
    const totalBonus = line.entries.reduce((s, e) => s + e.bonus, 0);
    const totalAdjustment = line.entries.reduce((s, e) => s + e.adjustment, 0);
    const grandTotal = line.entries.reduce((s, e) => s + e.lineTotal, 0);
    return { coachId: line.coachId, coachName: line.coachName, entries: line.entries, totalPay, totalFuel, totalBonus, totalAdjustment, grandTotal };
  }), [payrollLines]);

  const campGroups = useMemo(() => {
    const groups = new Map<string, { campId: string; campName: string; clubName: string; entries: (PayrollCampEntry & { coachName: string })[]; campTotal: number }>();
    payrollLines.forEach(line => {
      line.entries.forEach(e => {
        if (!groups.has(e.campId)) {
          groups.set(e.campId, { campId: e.campId, campName: e.campName, clubName: e.clubName, entries: [], campTotal: 0 });
        }
        const g = groups.get(e.campId)!;
        g.entries.push({ ...e, coachName: line.coachName });
        g.campTotal += e.lineTotal;
      });
    });
    return Array.from(groups.values());
  }, [payrollLines]);

  const weekTotal = coachSummaries.reduce((s, cs) => s + cs.grandTotal, 0);
  const totalCoaches = coachSummaries.length;
  const totalCamps = new Set(payrollLines.flatMap(l => l.entries.map(e => e.campId))).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
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
        <StatCard label="Coaches" value={totalCoaches} icon={Users} />
        <StatCard label="Camps" value={totalCamps} icon={Tent} />
      </div>

      {!generated ? (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <Wallet className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="text-muted-foreground font-medium">No payroll generated for this week</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Payroll is calculated from actual daily roster assignments.
              </p>
            </div>
            <Button onClick={generatePayroll} className="gap-2">
              <Wand2 className="h-4 w-4" /> Generate from Roster
            </Button>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Ensure coaches are assigned to camps before generating</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => { setGenerated(false); setPayrollLines([]); }}>
              Reset
            </Button>
            <Button onClick={generatePayroll} variant="outline" className="gap-2">
              <Wand2 className="h-4 w-4" /> Regenerate
            </Button>
            <PayrollExport
              coachSummaries={coachSummaries}
              weekStart={weekStart}
              weekEnd={weekEnd}
              weekTotal={weekTotal}
            />
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
