import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { FileDown, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RosterCamp, DailyAssignment, RosterCoach } from "@/pages/RosterPage";
import { getCampDays } from "@/pages/RosterPage";

interface Props {
  camps: RosterCamp[];
  assignments: DailyAssignment[];
  coaches: RosterCoach[];
  weekStart: Date;
  weekEnd: Date;
}

export function RosterExport({ camps, assignments, coaches, weekStart, weekEnd }: Props) {
  const { toast } = useToast();

  const exportCSV = () => {
    const allDays = new Set<string>();
    camps.forEach(c => getCampDays(c).forEach(d => allDays.add(format(d, "yyyy-MM-dd"))));
    const sortedDays = [...allDays].sort();
    const dayHeaders = sortedDays.map(d => format(new Date(d + "T00:00:00"), "EEE d MMM"));

    const rows = [["Camp", "Club", "Players", "Coach", "Role", "Driver", ...dayHeaders, "Total Days"]];

    for (const camp of camps) {
      const campAssigns = assignments.filter(a => a.camp_id === camp.id);
      if (campAssigns.length === 0) {
        rows.push([camp.name, camp.club_name, String(camp.player_count), "UNASSIGNED", "", "", ...sortedDays.map(() => ""), ""]);
      } else {
        for (const a of campAssigns) {
          const c = coaches.find(co => co.id === a.coach_id);
          rows.push([
            camp.name, camp.club_name, String(camp.player_count),
            c?.full_name || "?",
            a.role === "head_coach" ? "Head Coach" : "Assistant",
            c?.can_drive ? "Yes" : "No",
            ...sortedDays.map(d => a.days.includes(d) ? "✓" : ""),
            String(a.days.length),
          ]);
        }
      }
    }

    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TT-Roster-${format(weekStart, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Roster exported" });
  };

  const printRoster = () => {
    const weekCommencing = format(weekStart, "EEEE d MMMM yyyy");
    const totalCoaches = new Set(assignments.map(a => a.coach_id)).size;
    const totalCamps = camps.length;

    let html = `<html><head><title>Teaching Tekkers — Week Commencing ${weekCommencing}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', -apple-system, system-ui, sans-serif; color: #1e293b; font-size: 10px; line-height: 1.3; }

  /* Header bar */
  .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 12px 16px; border-radius: 6px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 16px; font-weight: 800; letter-spacing: -0.3px; }
  .header .week { font-size: 11px; opacity: 0.9; font-weight: 500; }
  .header .meta { font-size: 9px; opacity: 0.7; text-align: right; }

  /* Camp block */
  .camp { margin-bottom: 8px; border: 1.5px solid #cbd5e1; border-radius: 5px; overflow: hidden; page-break-inside: avoid; }
  .camp-head { background: linear-gradient(90deg, #1e40af, #2563eb); color: white; padding: 5px 10px; display: flex; justify-content: space-between; align-items: center; }
  .camp-head h2 { font-size: 11px; font-weight: 700; }
  .camp-head .info { font-size: 9px; opacity: 0.85; }
  .camp-head .players { background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 3px; font-weight: 700; font-size: 10px; }

  /* Grid */
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #f1f5f9; padding: 3px 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 1.5px solid #cbd5e1; }
  thead th.day-col { text-align: center; width: 56px; }
  thead th:first-child { text-align: left; }
  tbody td { padding: 3px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:nth-child(even) { background: #f8fafc; }

  /* Coach name */
  .coach-name { font-weight: 600; font-size: 10px; }
  .coach-role { font-size: 8px; font-weight: 600; padding: 1px 4px; border-radius: 2px; display: inline-block; margin-left: 4px; }
  .role-hc { background: #dbeafe; color: #1d4ed8; }
  .role-asst { background: #f1f5f9; color: #64748b; }
  .driver-tag { font-size: 8px; color: #16a34a; margin-left: 3px; }

  /* Day cells */
  .day-cell { text-align: center; }
  .day-on { display: inline-block; width: 36px; height: 16px; line-height: 16px; background: #22c55e; color: white; border-radius: 3px; font-weight: 800; font-size: 9px; }
  .day-off { display: inline-block; width: 36px; height: 16px; line-height: 16px; background: #fee2e2; color: #ef4444; border-radius: 3px; font-size: 9px; }

  /* Travel */
  .travel-row td { padding: 2px 6px; font-size: 8px; color: #64748b; border-bottom: none; background: #f8fafc; }
  .travel-row td:first-child { padding-left: 10px; }

  /* Footer */
  .footer { margin-top: 8px; text-align: center; font-size: 8px; color: #94a3b8; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .camp { break-inside: avoid; }
  }
</style>
</head><body>

<div class="header">
  <div>
    <h1>Teaching Tekkers</h1>
    <div class="week">Week Commencing: ${weekCommencing}</div>
  </div>
  <div class="meta">
    ${totalCamps} Camp${totalCamps !== 1 ? "s" : ""} · ${totalCoaches} Coach${totalCoaches !== 1 ? "es" : ""}
  </div>
</div>`;

    for (const camp of camps) {
      const campDays = getCampDays(camp);
      const campAssigns = assignments.filter(a => a.camp_id === camp.id);
      const dayStrings = campDays.map(d => format(d, "yyyy-MM-dd"));

      // Find drivers and passengers for travel note
      const drivers = campAssigns.filter(a => coaches.find(c => c.id === a.coach_id)?.can_drive);
      const passengers = campAssigns.filter(a => !coaches.find(c => c.id === a.coach_id)?.can_drive);

      html += `<div class="camp">
  <div class="camp-head">
    <h2>${camp.name}</h2>
    <div style="display:flex;align-items:center;gap:8px;">
      <span class="info">${camp.club_name} · ${camp.venue}</span>
      <span class="players">${camp.player_count} players</span>
    </div>
  </div>
  <table>
    <thead><tr>
      <th style="min-width:130px">Coach</th>`;

      for (const d of campDays) {
        html += `<th class="day-col">${format(d, "EEE")}<br/><span style="font-weight:500;text-transform:none;font-size:8px">${format(d, "d MMM")}</span></th>`;
      }
      html += `</tr></thead><tbody>`;

      for (const a of campAssigns) {
        const c = coaches.find(co => co.id === a.coach_id);
        const roleLabel = a.role === "head_coach" ? "HC" : "Asst";
        const roleClass = a.role === "head_coach" ? "role-hc" : "role-asst";

        html += `<tr>
          <td>
            <span class="coach-name">${c?.full_name || "?"}</span>
            <span class="coach-role ${roleClass}">${roleLabel}</span>
            ${c?.can_drive ? '<span class="driver-tag">🚗 Driver</span>' : ""}
          </td>`;

        for (const ds of dayStrings) {
          const on = a.days.includes(ds);
          html += `<td class="day-cell"><span class="${on ? "day-on" : "day-off"}">${on ? "✓" : "✗"}</span></td>`;
        }
        html += `</tr>`;
      }

      if (campAssigns.length === 0) {
        html += `<tr><td colspan="${campDays.length + 1}" style="color:#94a3b8;text-align:center;padding:8px;font-style:italic">No coaches assigned</td></tr>`;
      }

      // Travel note row
      if (drivers.length > 0 && passengers.length > 0) {
        html += `<tr class="travel-row"><td colspan="${campDays.length + 1}">🚗 ${drivers.map(d => coaches.find(c => c.id === d.coach_id)?.full_name).join(", ")} driving — picking up ${passengers.map(p => coaches.find(c => c.id === p.coach_id)?.full_name).join(", ")}</td></tr>`;
      }

      html += `</tbody></table></div>`;
    }

    html += `<div class="footer">Teaching Tekkers · Generated ${format(new Date(), "d MMM yyyy, HH:mm")}</div>`;
    html += `</body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
        <FileDown className="h-4 w-4" /> Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={printRoster} className="gap-2">
        <Printer className="h-4 w-4" /> Print Roster
      </Button>
    </div>
  );
}
