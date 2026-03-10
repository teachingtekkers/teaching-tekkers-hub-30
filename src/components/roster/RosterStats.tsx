import { StatCard } from "@/components/StatCard";
import { Users, UserCheck, Car, Shield } from "lucide-react";
import type { RosterCamp, RosterAssignment, RosterCoach } from "@/pages/RosterPage";

interface Props {
  camps: RosterCamp[];
  assignments: RosterAssignment[];
  availableCoaches: RosterCoach[];
  allCoaches: RosterCoach[];
}

export function RosterStats({ camps, assignments, availableCoaches }: Props) {
  const totalRequired = camps.reduce((s, c) => s + c.required_coaches, 0);
  const campsWithHC = camps.filter(c => assignments.some(a => a.camp_id === c.id && a.role === "head_coach")).length;
  const driversAssigned = new Set(
    assignments.filter(a => {
      const coach = availableCoaches.find(co => co.id === a.coach_id);
      return coach?.can_drive;
    }).map(a => a.camp_id)
  ).size;

  return (
    <div className="stat-grid">
      <StatCard title="Camps This Week" value={camps.length} icon={Users} />
      <StatCard title="Coaches Assigned" value={`${assignments.length}/${totalRequired}`} icon={UserCheck} />
      <StatCard title="Head Coaches Set" value={`${campsWithHC}/${camps.length}`} icon={Shield} />
      <StatCard title="Camps With Driver" value={`${driversAssigned}/${camps.length}`} icon={Car} />
    </div>
  );
}
