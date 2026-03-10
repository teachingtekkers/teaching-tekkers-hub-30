import { useState, useEffect, useMemo, useCallback } from "react";
import { format, startOfWeek, endOfWeek, parseISO, addWeeks, subWeeks } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { RosterWeekSelector } from "@/components/roster/RosterWeekSelector";
import { RosterStats } from "@/components/roster/RosterStats";
import { RosterAvailabilityInput } from "@/components/roster/RosterAvailabilityInput";
import { RosterCampCard } from "@/components/roster/RosterCampCard";
import { RosterExport } from "@/components/roster/RosterExport";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Wand2 } from "lucide-react";

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
  daily_rate: number;
  head_coach_daily_rate: number;
  fuel_allowance_eligible: boolean;
  pickup_locations: string[] | null;
  preferred_counties: string[] | null;
  local_counties: string[] | null;
  status: string | null;
}

export interface RosterAssignment {
  id: string;
  camp_id: string;
  coach_id: string;
  role: "head_coach" | "assistant";
}

const RosterPage = () => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [camps, setCamps] = useState<RosterCamp[]>([]);
  const [allCoaches, setAllCoaches] = useState<RosterCoach[]>([]);
  const [availableCoachIds, setAvailableCoachIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<RosterAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [availabilitySet, setAvailabilitySet] = useState(false);
  const [dragCoach, setDragCoach] = useState<{ coachId: string; fromCampId: string | null } | null>(null);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

  // Fetch camps + coaches
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const wsISO = format(weekStart, "yyyy-MM-dd");
      const weISO = format(weekEnd, "yyyy-MM-dd");

      const [campsRes, coachesRes, bookingsRes] = await Promise.all([
        supabase.from("camps").select("id, name, club_name, venue, county, start_date, end_date")
          .lte("start_date", weISO).gte("end_date", wsISO).order("name"),
        supabase.from("coaches").select("id, full_name, county, can_drive, is_head_coach, role_type, daily_rate, head_coach_daily_rate, fuel_allowance_eligible, pickup_locations, preferred_counties, local_counties, status")
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

  // Auto-generate assignments
  const autoGenerate = useCallback(() => {
    if (camps.length === 0 || availableCoaches.length === 0) return;

    const newAssignments: RosterAssignment[] = [];
    let nextId = 1;
    const used = new Set<string>();

    // Sort camps by required coaches desc so biggest camps get priority
    const sortedCamps = [...camps].sort((a, b) => b.required_coaches - a.required_coaches);

    // Pass 1: assign head coaches
    for (const camp of sortedCamps) {
      const headCoach = availableCoaches.find(c =>
        !used.has(c.id) &&
        (c.is_head_coach || c.role_type === "head_coach") &&
        (c.preferred_counties?.includes(camp.county) || c.local_counties?.includes(camp.county) || c.county === camp.county)
      ) || availableCoaches.find(c =>
        !used.has(c.id) && (c.is_head_coach || c.role_type === "head_coach")
      );

      if (headCoach) {
        newAssignments.push({ id: String(nextId++), camp_id: camp.id, coach_id: headCoach.id, role: "head_coach" });
        used.add(headCoach.id);
      }
    }

    // Pass 2: fill remaining spots, prioritise drivers for camps without one
    for (const camp of sortedCamps) {
      const campAssigns = newAssignments.filter(a => a.camp_id === camp.id);
      const remaining = camp.required_coaches - campAssigns.length;
      const hasDriver = campAssigns.some(a => {
        const c = availableCoaches.find(co => co.id === a.coach_id);
        return c?.can_drive;
      });

      // If no driver yet, try to assign one first
      if (!hasDriver && remaining > 0) {
        const driver = availableCoaches.find(c =>
          !used.has(c.id) && c.can_drive &&
          (c.preferred_counties?.includes(camp.county) || c.local_counties?.includes(camp.county) || c.county === camp.county)
        ) || availableCoaches.find(c => !used.has(c.id) && c.can_drive);

        if (driver) {
          newAssignments.push({ id: String(nextId++), camp_id: camp.id, coach_id: driver.id, role: "assistant" });
          used.add(driver.id);
        }
      }

      // Fill the rest
      const nowAssigned = newAssignments.filter(a => a.camp_id === camp.id).length;
      const stillNeeded = camp.required_coaches - nowAssigned;
      for (let i = 0; i < stillNeeded; i++) {
        const coach = availableCoaches.find(c =>
          !used.has(c.id) &&
          (c.preferred_counties?.includes(camp.county) || c.local_counties?.includes(camp.county) || c.county === camp.county)
        ) || availableCoaches.find(c => !used.has(c.id));

        if (coach) {
          newAssignments.push({ id: String(nextId++), camp_id: camp.id, coach_id: coach.id, role: "assistant" });
          used.add(coach.id);
        }
      }
    }

    setAssignments(newAssignments);
    toast({ title: "Roster generated", description: `${newAssignments.length} assignments across ${camps.length} camps` });
  }, [camps, availableCoaches, toast]);

  // Manual actions
  const removeAssignment = (assignmentId: string) => {
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));
  };

  const addAssignment = (campId: string, coachId: string, role: "head_coach" | "assistant") => {
    setAssignments(prev => [...prev, { id: String(Date.now()), camp_id: campId, coach_id: coachId, role }]);
  };

  const changeRole = (assignmentId: string, role: "head_coach" | "assistant") => {
    setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, role } : a));
  };

  // Drag and drop
  const handleDragStart = (coachId: string, fromCampId: string | null) => {
    setDragCoach({ coachId, fromCampId });
  };

  const handleDrop = (toCampId: string) => {
    if (!dragCoach) return;
    const { coachId, fromCampId } = dragCoach;
    if (fromCampId === toCampId) { setDragCoach(null); return; }

    // Already in target camp?
    if (assignments.some(a => a.camp_id === toCampId && a.coach_id === coachId)) { setDragCoach(null); return; }

    setAssignments(prev => {
      let updated = fromCampId ? prev.filter(a => !(a.camp_id === fromCampId && a.coach_id === coachId)) : prev;
      return [...updated, { id: String(Date.now()), camp_id: toCampId, coach_id: coachId, role: "assistant" as const }];
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
      {/* Header + Week Selector */}
      <RosterWeekSelector
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        weekStart={weekStart}
        weekEnd={weekEnd}
        onPrevWeek={() => setSelectedDate(subWeeks(selectedDate, 1))}
        onNextWeek={() => setSelectedDate(addWeeks(selectedDate, 1))}
      />

      {/* Stats */}
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
          {/* Step 3: Availability Input */}
          <RosterAvailabilityInput
            allCoaches={allCoaches}
            onAvailabilitySet={(ids) => { setAvailableCoachIds(ids); setAvailabilitySet(true); }}
            availabilitySet={availabilitySet}
          />

          {/* Auto-generate button */}
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

          {/* Unassigned coaches pool (drag source) */}
          {availabilitySet && unassignedCoaches.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Unassigned Available Coaches ({unassignedCoaches.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {unassignedCoaches.map(c => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => handleDragStart(c.id, null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border bg-card text-sm cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors"
                    >
                      <span className="font-medium">{c.full_name}</span>
                      {c.can_drive && <span title="Driver">🚗</span>}
                      {(c.is_head_coach || c.role_type === "head_coach") && <span title="HC eligible">⭐</span>}
                      {c.county && <span className="text-muted-foreground text-xs">({c.county})</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Camp cards with assignments */}
          <div className="space-y-4">
            {camps.map(camp => (
              <RosterCampCard
                key={camp.id}
                camp={camp}
                assignments={assignments.filter(a => a.camp_id === camp.id)}
                coaches={availableCoaches}
                allCoaches={allCoaches}
                unassignedCoaches={unassignedCoaches}
                onRemove={removeAssignment}
                onAdd={addAssignment}
                onChangeRole={changeRole}
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
