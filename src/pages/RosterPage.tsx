import { useState, useEffect, useMemo, useCallback } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isWeekend } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";

import { RosterWeekSelector } from "@/components/roster/RosterWeekSelector";
import { RosterStats } from "@/components/roster/RosterStats";
import { RosterAvailabilityInput } from "@/components/roster/RosterAvailabilityInput";
import { RosterDailyGrid } from "@/components/roster/RosterDailyGrid";
import { RosterCoachView } from "@/components/roster/RosterCoachView";
import { RosterExport } from "@/components/roster/RosterExport";
import { RosterUnassignedPool } from "@/components/roster/RosterUnassignedPool";
import { RosterHistory } from "@/components/roster/RosterHistory";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Wand2, Save, CheckCircle, FileEdit, History, AlertTriangle } from "lucide-react";

export type ExperienceLevel = "lead" | "senior" | "standard" | "junior";

export interface RosterCamp {
  id: string;
  name: string;
  club_name: string;
  venue: string;
  county: string;
  start_date: string;
  end_date: string;
  player_count: number;
  required_coaches: number;
}

export interface RosterCoach {
  id: string;
  full_name: string;
  county: string | null;
  can_drive: boolean;
  is_head_coach: boolean;
  role_type: string | null;
  experience_level: ExperienceLevel;
  daily_rate: number;
  head_coach_daily_rate: number;
  fuel_allowance_eligible: boolean;
  pickup_locations: string[] | null;
  preferred_counties: string[] | null;
  local_counties: string[] | null;
  home_town: string | null;
  preferred_driver_id: string | null;
  status: string | null;
}

export interface DailyAssignment {
  id: string;
  camp_id: string;
  coach_id: string;
  role: "head_coach" | "assistant";
  days: string[];
  is_day1_support?: boolean;
  driving_this_week?: boolean;
}

export type RosterStatus = "draft" | "finalised";

export function getCampDays(camp: RosterCamp): Date[] {
  const start = new Date(camp.start_date + "T00:00:00");
  const end = new Date(camp.end_date + "T00:00:00");
  return eachDayOfInterval({ start, end }).filter(d => !isWeekend(d));
}

function preferredExperience(playerCount: number): ExperienceLevel[] {
  if (playerCount >= 60) return ["lead", "senior"];
  if (playerCount >= 40) return ["senior", "standard"];
  return ["standard", "junior"];
}

const RosterPage = () => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [camps, setCamps] = useState<RosterCamp[]>([]);
  const [allCoaches, setAllCoaches] = useState<RosterCoach[]>([]);
  const [availableCoachIds, setAvailableCoachIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<DailyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availabilitySet, setAvailabilitySet] = useState(false);
  const [dragCoach, setDragCoach] = useState<{ coachId: string; fromCampId: string | null } | null>(null);

  // Persistence state
  const [savedRosterId, setSavedRosterId] = useState<string | null>(null);
  const [rosterStatus, setRosterStatus] = useState<RosterStatus>("draft");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [rosterView, setRosterView] = useState<"camp" | "coach">("camp");

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  // Load camps, coaches, and existing saved roster
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const wsISO = format(weekStart, "yyyy-MM-dd");
      const weISO = format(weekEnd, "yyyy-MM-dd");

      const [campsRes, coachesRes, bookingsRes, rosterRes] = await Promise.all([
        supabase.from("camps").select("id, name, club_name, venue, county, start_date, end_date")
          .lte("start_date", weISO).gte("end_date", wsISO).order("name"),
        supabase.from("coaches").select("id, full_name, county, can_drive, is_head_coach, role_type, experience_level, daily_rate, head_coach_daily_rate, fuel_allowance_eligible, pickup_locations, preferred_counties, local_counties, home_town, preferred_driver_id, status")
          .eq("status", "active").order("full_name"),
        supabase.from("bookings").select("camp_id"),
        supabase.from("weekly_rosters").select("*").eq("week_start", wsISO).maybeSingle(),
      ]);

      if (campsRes.error || coachesRes.error) {
        toast({ title: "Error loading data", variant: "destructive" });
        setLoading(false);
        return;
      }

      const bookingCounts: Record<string, number> = {};
      (bookingsRes.data || []).forEach((b: { camp_id: string }) => {
        bookingCounts[b.camp_id] = (bookingCounts[b.camp_id] || 0) + 1;
      });

      const weekCamps: RosterCamp[] = (campsRes.data || []).map((c: any) => {
        const pc = bookingCounts[c.id] || 0;
        return { ...c, player_count: pc, required_coaches: Math.max(1, Math.ceil(pc / 15)) };
      });

      setCamps(weekCamps);
      setAllCoaches((coachesRes.data as RosterCoach[]) || []);

      // Load saved roster if exists
      if (rosterRes.data) {
        const saved = rosterRes.data;
        setSavedRosterId(saved.id);
        setRosterStatus(saved.status as RosterStatus);
        setAssignments((saved.assignments as unknown as DailyAssignment[]) || []);
        setAvailableCoachIds((saved.available_coach_ids as unknown as string[]) || []);
        setAvailabilitySet(true);
        setHasUnsavedChanges(false);
      } else {
        setSavedRosterId(null);
        setRosterStatus("draft");
        setAssignments([]);
        setAvailableCoachIds([]);
        setAvailabilitySet(false);
        setHasUnsavedChanges(false);
      }

      setLoading(false);
    };
    load();
  }, [selectedDate]);

  const availableCoaches = useMemo(
    () => allCoaches.filter(c => availableCoachIds.includes(c.id)),
    [allCoaches, availableCoachIds]
  );

  const assignedCoachIds = useMemo(
    () => new Set(assignments.map(a => a.coach_id)),
    [assignments]
  );

  // Get all weekdays for this week (for coach view)
  const weekDays = useMemo(() => {
    return eachDayOfInterval({ start: weekStart, end: weekEnd }).filter(d => !isWeekend(d));
  }, [weekStart, weekEnd]);

  // Conflict detection: which days is a coach busy?
  const getCoachBusyDays = useCallback((coachId: string, excludeAssignmentId?: string): Set<string> => {
    const busy = new Set<string>();
    assignments.forEach(a => {
      if (a.coach_id === coachId && a.id !== excludeAssignmentId) {
        a.days.forEach(d => busy.add(d));
      }
    });
    return busy;
  }, [assignments]);

  // Coaches with at least one free day (partially or fully unassigned)
  const unassignedCoaches = useMemo(() => {
    const allWeekDays = weekDays.map(d => format(d, "yyyy-MM-dd"));
    return availableCoaches.filter(c => {
      const busyDays = getCoachBusyDays(c.id);
      return busyDays.size < allWeekDays.length; // has at least one free day
    });
  }, [availableCoaches, getCoachBusyDays, weekDays]);

  // Mark changes as unsaved whenever assignments change after initial load
  const markDirty = useCallback(() => setHasUnsavedChanges(true), []);

  // ---- Save / Update Roster ----
  const saveRoster = useCallback(async (newStatus?: RosterStatus) => {
    setSaving(true);
    const statusToSave = newStatus || rosterStatus;
    const uniqueCoachIds = new Set(assignments.map(a => a.coach_id));

    const payload = {
      week_start: weekStartStr,
      assignments: JSON.parse(JSON.stringify(assignments)),
      available_coach_ids: JSON.parse(JSON.stringify(availableCoachIds)),
      status: statusToSave as "draft" | "finalised",
      camps_count: new Set(assignments.map(a => a.camp_id)).size,
      coaches_count: uniqueCoachIds.size,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (savedRosterId) {
      result = await supabase.from("weekly_rosters").update(payload).eq("id", savedRosterId).select().single();
    } else {
      result = await supabase.from("weekly_rosters").insert(payload).select().single();
    }

    setSaving(false);

    if (result.error) {
      toast({ title: "Error saving roster", description: result.error.message, variant: "destructive" });
      return;
    }

    setSavedRosterId(result.data.id);
    setRosterStatus(statusToSave);
    setHasUnsavedChanges(false);
    sonnerToast.success(`Roster ${savedRosterId ? "updated" : "saved"} successfully for Week Commencing ${format(weekStart, "EEEE d MMMM yyyy")}`);
  }, [assignments, availableCoachIds, weekStartStr, savedRosterId, rosterStatus, weekStart, toast]);

  const finaliseRoster = useCallback(() => saveRoster("finalised"), [saveRoster]);
  const unfinaliseRoster = useCallback(() => saveRoster("draft"), [saveRoster]);

  // ---- Auto Generate ----
  const campFitScore = useCallback((coach: RosterCoach, camp: RosterCamp): number => {
    let score = 0;
    if (coach.county === camp.county) score += 10;
    if (coach.local_counties?.includes(camp.county)) score += 8;
    if (coach.preferred_counties?.includes(camp.county)) score += 6;
    if (coach.pickup_locations?.some(p => p.toLowerCase().includes(camp.county.toLowerCase()))) score += 4;
    if (coach.home_town && camp.venue.toLowerCase().includes(coach.home_town.toLowerCase())) score += 5;
    return score;
  }, []);

  const sharePickupArea = useCallback((a: RosterCoach, b: RosterCoach): boolean => {
    if (a.home_town && b.home_town && a.home_town.toLowerCase() === b.home_town.toLowerCase()) return true;
    if (a.county && b.county && a.county === b.county) return true;
    const aLocs = (a.pickup_locations || []).map(l => l.toLowerCase());
    const bLocs = (b.pickup_locations || []).map(l => l.toLowerCase());
    return aLocs.some(l => bLocs.includes(l));
  }, []);

  const autoGenerate = useCallback(() => {
    if (camps.length === 0 || availableCoaches.length === 0) return;

    const newAssignments: DailyAssignment[] = [];
    let nextId = 1;
    const used = new Set<string>();
    const sortedCamps = [...camps].sort((a, b) => b.player_count - a.player_count);

    // PASS 1: Head Coaches
    for (const camp of sortedCamps) {
      const campDays = getCampDays(camp).map(d => format(d, "yyyy-MM-dd"));
      const preferred = preferredExperience(camp.player_count);
      const hcCandidates = availableCoaches
        .filter(c => !used.has(c.id) && (c.is_head_coach || c.role_type === "head_coach"))
        .map(c => ({ coach: c, score: (preferred.includes(c.experience_level) ? 20 : 0) + campFitScore(c, camp) }))
        .sort((a, b) => b.score - a.score);
      const headCoach = hcCandidates[0]?.coach;
      if (headCoach) {
        newAssignments.push({ id: String(nextId++), camp_id: camp.id, coach_id: headCoach.id, role: "head_coach", days: campDays, driving_this_week: headCoach.can_drive });
        used.add(headCoach.id);
      }
    }

    // PASS 2: Driver coverage
    for (const camp of sortedCamps) {
      const campDays = getCampDays(camp).map(d => format(d, "yyyy-MM-dd"));
      const campAssigns = newAssignments.filter(a => a.camp_id === camp.id);
      const hasDriver = campAssigns.some(a => a.driving_this_week);
      const remaining = camp.required_coaches - campAssigns.length;
      if (!hasDriver && remaining > 0) {
        const driver = availableCoaches.filter(c => !used.has(c.id) && c.can_drive)
          .map(c => ({ coach: c, score: campFitScore(c, camp) })).sort((a, b) => b.score - a.score)[0]?.coach;
        if (driver) {
          newAssignments.push({ id: String(nextId++), camp_id: camp.id, coach_id: driver.id, role: "assistant", days: campDays, driving_this_week: true });
          used.add(driver.id);
        }
      }
    }

    // PASS 3: Fill remaining
    for (const camp of sortedCamps) {
      const campDays = getCampDays(camp).map(d => format(d, "yyyy-MM-dd"));
      const nowAssigned = newAssignments.filter(a => a.camp_id === camp.id).length;
      const stillNeeded = camp.required_coaches - nowAssigned;
      const campDriver = newAssignments.find(a => a.camp_id === camp.id && a.driving_this_week);
      const driverCoach = campDriver ? availableCoaches.find(c => c.id === campDriver.coach_id) : null;
      for (let i = 0; i < stillNeeded; i++) {
        const coach = availableCoaches.filter(c => !used.has(c.id))
          .map(c => {
            let score = campFitScore(c, camp);
            if (driverCoach && c.preferred_driver_id === driverCoach.id) score += 15;
            if (driverCoach && driverCoach.preferred_driver_id === c.id) score += 15;
            if (driverCoach && sharePickupArea(c, driverCoach)) score += 8;
            return { coach: c, score };
          }).sort((a, b) => b.score - a.score)[0]?.coach;
        if (coach) {
          newAssignments.push({ id: String(nextId++), camp_id: camp.id, coach_id: coach.id, role: "assistant", days: campDays, driving_this_week: false });
          used.add(coach.id);
        }
      }
    }

    // PASS 4: Day 1 support for 60+ camps
    for (const camp of sortedCamps) {
      if (camp.player_count < 60) continue;
      const campDays = getCampDays(camp).map(d => format(d, "yyyy-MM-dd"));
      if (campDays.length === 0) continue;
      const day1Coach = availableCoaches.filter(c => !used.has(c.id))
        .map(c => ({ coach: c, score: campFitScore(c, camp) })).sort((a, b) => b.score - a.score)[0]?.coach;
      if (day1Coach) {
        newAssignments.push({ id: String(nextId++), camp_id: camp.id, coach_id: day1Coach.id, role: "assistant", days: [campDays[0]], is_day1_support: true, driving_this_week: false });
        used.add(day1Coach.id);
      }
    }

    // PASS 5: Minimise drivers
    for (const camp of sortedCamps) {
      const campAssigns = newAssignments.filter(a => a.camp_id === camp.id);
      const activeDrivers = campAssigns.filter(a => a.driving_this_week);
      if (activeDrivers.length > 1) {
        const nonHcDriver = activeDrivers.find(a => a.role !== "head_coach");
        for (const d of activeDrivers) {
          if (nonHcDriver && d.id !== nonHcDriver.id) d.driving_this_week = false;
          else if (!nonHcDriver && d !== activeDrivers[0]) d.driving_this_week = false;
        }
      }
    }

    setAssignments(newAssignments);
    setHasUnsavedChanges(true);
    const totalDays = newAssignments.reduce((s, a) => s + a.days.length, 0);
    const driversUsed = new Set(newAssignments.filter(a => a.driving_this_week).map(a => a.coach_id)).size;
    toast({ title: "Roster generated", description: `${newAssignments.length} coaches · ${totalDays} coach-days · ${driversUsed} drivers` });
  }, [camps, availableCoaches, toast, campFitScore, sharePickupArea]);

  // ---- Assignment editing handlers ----
  const removeAssignment = (id: string) => { setAssignments(prev => prev.filter(a => a.id !== id)); markDirty(); };

  const addAssignment = (campId: string, coachId: string, role: "head_coach" | "assistant") => {
    const camp = camps.find(c => c.id === campId);
    if (!camp) return;
    const campDays = getCampDays(camp).map(d => format(d, "yyyy-MM-dd"));
    setAssignments(prev => [...prev, { id: String(Date.now()), camp_id: campId, coach_id: coachId, role, days: campDays, driving_this_week: false }]);
    markDirty();
  };

  const addDay1Support = (campId: string, coachId: string) => {
    const camp = camps.find(c => c.id === campId);
    if (!camp) return;
    const campDays = getCampDays(camp).map(d => format(d, "yyyy-MM-dd"));
    if (campDays.length === 0) return;
    setAssignments(prev => [...prev, { id: String(Date.now()), camp_id: campId, coach_id: coachId, role: "assistant", days: [campDays[0]], is_day1_support: true, driving_this_week: false }]);
    markDirty();
  };

  const changeRole = (id: string, role: "head_coach" | "assistant") => { setAssignments(prev => prev.map(a => a.id === id ? { ...a, role } : a)); markDirty(); };

  const toggleDay = (id: string, day: string) => {
    setAssignments(prev => prev.map(a => {
      if (a.id !== id) return a;
      if (a.days.includes(day)) {
        // Removing a day is always allowed
        return { ...a, days: a.days.filter(d => d !== day) };
      }
      // Adding a day — check for conflicts
      const busyDays = getCoachBusyDays(a.coach_id, a.id);
      if (busyDays.has(day)) {
        const conflictAssignment = prev.find(o => o.id !== a.id && o.coach_id === a.coach_id && o.days.includes(day));
        const conflictCamp = conflictAssignment ? camps.find(c => c.id === conflictAssignment.camp_id) : null;
        toast({ title: "Day conflict", description: `Coach is already assigned to ${conflictCamp?.name || "another camp"} on this day`, variant: "destructive" });
        return a;
      }
      return { ...a, days: [...a.days, day].sort() };
    }));
    markDirty();
  };

  const toggleDrivingThisWeek = (id: string) => {
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, driving_this_week: !a.driving_this_week } : a));
    markDirty();
  };

  const handleDragStart = (coachId: string, fromCampId: string | null) => setDragCoach({ coachId, fromCampId });

  const handleDrop = (toCampId: string) => {
    if (!dragCoach) return;
    const { coachId, fromCampId } = dragCoach;
    if (fromCampId === toCampId) { setDragCoach(null); return; }
    if (assignments.some(a => a.camp_id === toCampId && a.coach_id === coachId)) { setDragCoach(null); return; }
    const camp = camps.find(c => c.id === toCampId);
    if (!camp) { setDragCoach(null); return; }
    const campDays = getCampDays(camp).map(d => format(d, "yyyy-MM-dd"));
    setAssignments(prev => {
      let updated = fromCampId ? prev.filter(a => !(a.camp_id === fromCampId && a.coach_id === coachId)) : prev;
      return [...updated, { id: String(Date.now()), camp_id: toCampId, coach_id: coachId, role: "assistant" as const, days: campDays, driving_this_week: false }];
    });
    setDragCoach(null);
    markDirty();
  };

  // Handle loading a roster from history
  const handleLoadRoster = (weekDate: Date) => {
    setSelectedDate(weekDate);
    setShowHistory(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RosterWeekSelector
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        weekStart={weekStart}
        weekEnd={weekEnd}
        onPrevWeek={() => setSelectedDate(subWeeks(selectedDate, 1))}
        onNextWeek={() => setSelectedDate(addWeeks(selectedDate, 1))}
      />

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3">
        {savedRosterId && (
          <Badge variant={rosterStatus === "finalised" ? "default" : "secondary"} className="text-xs">
            {rosterStatus === "finalised" ? "✅ Finalised" : "📝 Draft"}
          </Badge>
        )}
        {hasUnsavedChanges && (
          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Unsaved changes</Badge>
        )}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)} className="gap-2">
            <History className="h-4 w-4" /> {showHistory ? "Hide History" : "Roster History"}
          </Button>
        </div>
      </div>

      {showHistory && <RosterHistory onLoadRoster={handleLoadRoster} currentWeekStart={weekStartStr} />}

      <RosterStats camps={camps} assignments={assignments} availableCoaches={availableCoaches} allCoaches={allCoaches} />

      {camps.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No camps scheduled this week</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Select a different week to view the roster</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <RosterAvailabilityInput
            allCoaches={allCoaches}
            onAvailabilitySet={(ids) => { setAvailableCoachIds(ids); setAvailabilitySet(true); markDirty(); }}
            availabilitySet={availabilitySet}
          />

          {availabilitySet && (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={autoGenerate} variant="outline" className="gap-2">
                <Wand2 className="h-4 w-4" /> Auto-Generate
              </Button>
              {assignments.length > 0 && (
                <Button variant="outline" onClick={() => { setAssignments([]); markDirty(); }}>Clear All</Button>
              )}
              {assignments.length > 0 && (
                <>
                  <Button onClick={() => saveRoster()} disabled={saving} className="gap-2">
                    <Save className="h-4 w-4" /> {saving ? "Saving…" : savedRosterId ? "Update Roster" : "Save Roster"}
                  </Button>
                  {rosterStatus === "draft" ? (
                    <Button onClick={finaliseRoster} disabled={saving} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-primary-foreground">
                      <CheckCircle className="h-4 w-4" /> Finalise
                    </Button>
                  ) : (
                    <Button onClick={unfinaliseRoster} disabled={saving} variant="outline" className="gap-2">
                      <FileEdit className="h-4 w-4" /> Revert to Draft
                    </Button>
                  )}
                  <RosterExport camps={camps} assignments={assignments} coaches={availableCoaches} weekStart={weekStart} weekEnd={weekEnd} />
                </>
              )}
            </div>
          )}

          {availabilitySet && unassignedCoaches.length > 0 && (
            <RosterUnassignedPool coaches={unassignedCoaches} onDragStart={handleDragStart} />
          )}

          <div className="space-y-4">
            {camps.map(camp => (
              <RosterDailyGrid
                key={camp.id}
                camp={camp}
                assignments={assignments.filter(a => a.camp_id === camp.id)}
                coaches={availableCoaches}
                unassignedCoaches={unassignedCoaches}
                onRemove={removeAssignment}
                onAdd={addAssignment}
                onAddDay1Support={addDay1Support}
                onChangeRole={changeRole}
                onToggleDay={toggleDay}
                onToggleDriving={toggleDrivingThisWeek}
                onDragStart={handleDragStart}
                onDrop={() => handleDrop(camp.id)}
                availabilitySet={availabilitySet}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default RosterPage;
