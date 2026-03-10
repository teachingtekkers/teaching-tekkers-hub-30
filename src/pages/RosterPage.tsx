import { useState, useEffect, useMemo, useCallback } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isWeekend } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { RosterWeekSelector } from "@/components/roster/RosterWeekSelector";
import { RosterStats } from "@/components/roster/RosterStats";
import { RosterAvailabilityInput } from "@/components/roster/RosterAvailabilityInput";
import { RosterDailyGrid } from "@/components/roster/RosterDailyGrid";
import { RosterExport } from "@/components/roster/RosterExport";
import { RosterUnassignedPool } from "@/components/roster/RosterUnassignedPool";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Wand2 } from "lucide-react";

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
  /** Whether this coach is driving this week for this camp */
  driving_this_week?: boolean;
}

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
  const [availabilitySet, setAvailabilitySet] = useState(false);
  const [dragCoach, setDragCoach] = useState<{ coachId: string; fromCampId: string | null } | null>(null);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const wsISO = format(weekStart, "yyyy-MM-dd");
      const weISO = format(weekEnd, "yyyy-MM-dd");

      const [campsRes, coachesRes, bookingsRes] = await Promise.all([
        supabase.from("camps").select("id, name, club_name, venue, county, start_date, end_date")
          .lte("start_date", weISO).gte("end_date", wsISO).order("name"),
        supabase.from("coaches").select("id, full_name, county, can_drive, is_head_coach, role_type, experience_level, daily_rate, head_coach_daily_rate, fuel_allowance_eligible, pickup_locations, preferred_counties, local_counties, home_town, preferred_driver_id, status")
          .eq("status", "active").order("full_name"),
        supabase.from("bookings").select("camp_id"),
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
      setAssignments([]);
      setAvailabilitySet(false);
      setAvailableCoachIds([]);
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

  const unassignedCoaches = useMemo(
    () => availableCoaches.filter(c => !assignedCoachIds.has(c.id)),
    [availableCoaches, assignedCoachIds]
  );

  const autoGenerate = useCallback(() => {
    if (camps.length === 0 || availableCoaches.length === 0) return;

    const newAssignments: DailyAssignment[] = [];
    let nextId = 1;
    const used = new Set<string>();
    const sortedCamps = [...camps].sort((a, b) => b.required_coaches - a.required_coaches);

    // Pass 1: head coaches with experience matching
    for (const camp of sortedCamps) {
      const campDays = getCampDays(camp).map(d => format(d, "yyyy-MM-dd"));
      const preferred = preferredExperience(camp.player_count);

      const headCoach = availableCoaches.find(c =>
        !used.has(c.id) && (c.is_head_coach || c.role_type === "head_coach") &&
        preferred.includes(c.experience_level) &&
        (c.preferred_counties?.includes(camp.county) || c.local_counties?.includes(camp.county) || c.county === camp.county)
      ) || availableCoaches.find(c =>
        !used.has(c.id) && (c.is_head_coach || c.role_type === "head_coach") && preferred.includes(c.experience_level)
      ) || availableCoaches.find(c =>
        !used.has(c.id) && (c.is_head_coach || c.role_type === "head_coach")
      );

      if (headCoach) {
        newAssignments.push({
          id: String(nextId++), camp_id: camp.id, coach_id: headCoach.id,
          role: "head_coach", days: campDays, driving_this_week: headCoach.can_drive,
        });
        used.add(headCoach.id);
      }
    }

    // Pass 2: minimise drivers — only assign one driver per camp if needed
    for (const camp of sortedCamps) {
      const campDays = getCampDays(camp).map(d => format(d, "yyyy-MM-dd"));
      const campAssigns = newAssignments.filter(a => a.camp_id === camp.id);
      const hasDriver = campAssigns.some(a => a.driving_this_week);
      const remaining = camp.required_coaches - campAssigns.length;

      // Need a driver? Assign one who can drive
      if (!hasDriver && remaining > 0) {
        const driver = availableCoaches.find(c =>
          !used.has(c.id) && c.can_drive &&
          (c.preferred_counties?.includes(camp.county) || c.local_counties?.includes(camp.county) || c.county === camp.county)
        ) || availableCoaches.find(c => !used.has(c.id) && c.can_drive);

        if (driver) {
          newAssignments.push({
            id: String(nextId++), camp_id: camp.id, coach_id: driver.id,
            role: "assistant", days: campDays, driving_this_week: true,
          });
          used.add(driver.id);
        }
      }

      // Fill remaining — these are NOT driving
      const nowAssigned = newAssignments.filter(a => a.camp_id === camp.id).length;
      const stillNeeded = camp.required_coaches - nowAssigned;
      for (let i = 0; i < stillNeeded; i++) {
        const coach = availableCoaches.find(c =>
          !used.has(c.id) &&
          (c.preferred_counties?.includes(camp.county) || c.local_counties?.includes(camp.county) || c.county === camp.county)
        ) || availableCoaches.find(c => !used.has(c.id));

        if (coach) {
          newAssignments.push({
            id: String(nextId++), camp_id: camp.id, coach_id: coach.id,
            role: "assistant", days: campDays, driving_this_week: false,
          });
          used.add(coach.id);
        }
      }

      // Day 1 overflow for large camps
      if (camp.player_count >= 60) {
        const day1Coach = availableCoaches.find(c => !used.has(c.id));
        if (day1Coach && campDays.length > 0) {
          newAssignments.push({
            id: String(nextId++), camp_id: camp.id, coach_id: day1Coach.id,
            role: "assistant", days: [campDays[0]], is_day1_support: true, driving_this_week: false,
          });
          used.add(day1Coach.id);
        }
      }
    }

    setAssignments(newAssignments);
    toast({ title: "Roster generated", description: `${newAssignments.length} assignments across ${camps.length} camps` });
  }, [camps, availableCoaches, toast]);

  const removeAssignment = (assignmentId: string) => {
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));
  };

  const addAssignment = (campId: string, coachId: string, role: "head_coach" | "assistant") => {
    const camp = camps.find(c => c.id === campId);
    if (!camp) return;
    const campDays = getCampDays(camp).map(d => format(d, "yyyy-MM-dd"));
    const coach = availableCoaches.find(c => c.id === coachId);
    setAssignments(prev => [...prev, {
      id: String(Date.now()), camp_id: campId, coach_id: coachId, role, days: campDays,
      driving_this_week: false,
    }]);
  };

  const addDay1Support = (campId: string, coachId: string) => {
    const camp = camps.find(c => c.id === campId);
    if (!camp) return;
    const campDays = getCampDays(camp).map(d => format(d, "yyyy-MM-dd"));
    if (campDays.length === 0) return;
    setAssignments(prev => [...prev, {
      id: String(Date.now()), camp_id: campId, coach_id: coachId,
      role: "assistant", days: [campDays[0]], is_day1_support: true, driving_this_week: false,
    }]);
  };

  const changeRole = (assignmentId: string, role: "head_coach" | "assistant") => {
    setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, role } : a));
  };

  const toggleDay = (assignmentId: string, day: string) => {
    setAssignments(prev => prev.map(a => {
      if (a.id !== assignmentId) return a;
      const days = a.days.includes(day) ? a.days.filter(d => d !== day) : [...a.days, day].sort();
      return { ...a, days };
    }));
  };

  const toggleDrivingThisWeek = (assignmentId: string) => {
    setAssignments(prev => prev.map(a =>
      a.id === assignmentId ? { ...a, driving_this_week: !a.driving_this_week } : a
    ));
  };

  const handleDragStart = (coachId: string, fromCampId: string | null) => {
    setDragCoach({ coachId, fromCampId });
  };

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

      <RosterStats
        camps={camps}
        assignments={assignments}
        availableCoaches={availableCoaches}
        allCoaches={allCoaches}
      />

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
            onAvailabilitySet={(ids) => { setAvailableCoachIds(ids); setAvailabilitySet(true); }}
            availabilitySet={availabilitySet}
          />

          {availabilitySet && (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={autoGenerate} className="gap-2">
                <Wand2 className="h-4 w-4" /> Auto-Generate Roster
              </Button>
              {assignments.length > 0 && (
                <Button variant="outline" onClick={() => setAssignments([])}>Clear All</Button>
              )}
              {assignments.length > 0 && (
                <RosterExport
                  camps={camps}
                  assignments={assignments}
                  coaches={availableCoaches}
                  weekStart={weekStart}
                  weekEnd={weekEnd}
                />
              )}
            </div>
          )}

          {availabilitySet && unassignedCoaches.length > 0 && (
            <RosterUnassignedPool
              coaches={unassignedCoaches}
              onDragStart={handleDragStart}
            />
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
