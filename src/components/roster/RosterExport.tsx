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

    let html = `<html><head><title>Teaching Tekkers — ${weekCommencing}</title>
<style>
  @page { size: A4 landscape; margin: 6mm 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', -apple-system, system-ui, sans-serif; color: #1e293b; font-size: 8.5px; line-height: 1.2; }

  .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 6px 12px; border-radius: 4px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 13px; font-weight: 800; letter-spacing: -0.3px; }
  .header .week { font-size: 9.5px; opacity: 0.92; font-weight: 500; }
  .header .meta { font-size: 8px; opacity: 0.7; }

  .camp { margin-bottom: 4px; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; page-break-inside: avoid; }
  .camp-head { background: linear-gradient(90deg, #1e40af, #3b82f6); color: white; padding: 3px 8px; display: flex; justify-content: space-between; align-items: center; }
  .camp-head h2 { font-size: 9px; font-weight: 700; }
  .camp-head .info { font-size: 7.5px; opacity: 0.85; }
  .camp-head .players { background: rgba(255,255,255,0.22); padding: 0 5px; border-radius: 2px; font-weight: 700; font-size: 8.5px; margin-left: 6px; }
  .camp-head .travel { font-size: 7px; opacity: 0.75; margin-left: 8px; }

  table { width: 100%; border-collapse: collapse; }
  thead th { background: #eef2f7; padding: 2px 4px; font-size: 7.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #475569; border-bottom: 1px solid #cbd5e1; }
  thead th.day-col { text-align: center; width: 48px; }
  thead th:first-child { text-align: left; }
  tbody td { padding: 1.5px 4px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; height: 16px; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:nth-child(even) { background: #f8fafc; }

  .cn { font-weight: 600; font-size: 8.5px; white-space: nowrap; }
  .cr { font-size: 7px; font-weight: 600; padding: 0px 3px; border-radius: 2px; display: inline-block; margin-left: 3px; vertical-align: middle; }
  .rhc { background: #dbeafe; color: #1d4ed8; }
  .ra { background: #f1f5f9; color: #64748b; }
  .dr { font-size: 7px; color: #16a34a; margin-left: 2px; }

  .dc { text-align: center; }
  .don { display: inline-block; width: 32px; height: 13px; line-height: 13px; background: #22c55e; color: white; border-radius: 2px; font-weight: 800; font-size: 8px; }
  .dof { display: inline-block; width: 32px; height: 13px; line-height: 13px; background: #fecaca; color: #ef4444; border-radius: 2px; font-size: 8px; }

  .footer { margin-top: 4px; text-align: center; font-size: 7px; color: #94a3b8; }

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
  <div class="meta">${totalCamps} Camp${totalCamps !== 1 ? "s" : ""} · ${totalCoaches} Coaches</div>
</div>`;

    for (const camp of camps) {
      const campDays = getCampDays(camp);
      const campAssigns = assignments.filter(a => a.camp_id === camp.id);
      const dayStrs = campDays.map(d => format(d, "yyyy-MM-dd"));

      const driverNames = campAssigns
        .filter(a => coaches.find(c => c.id === a.coach_id)?.can_drive)
        .map(a => coaches.find(c => c.id === a.coach_id)?.full_name?.split(" ")[0]);
      const passengerNames = campAssigns
        .filter(a => !coaches.find(c => c.id === a.coach_id)?.can_drive)
        .map(a => coaches.find(c => c.id === a.coach_id)?.full_name?.split(" ")[0]);

      const travelNote = driverNames.length > 0 && passengerNames.length > 0
        ? `🚗 ${driverNames.join(", ")} → ${passengerNames.join(", ")}`
        : "";

      html += `<div class="camp">
  <div class="camp-head">
    <div style="display:flex;align-items:center;">
      <h2>${camp.name}</h2>
      <span class="players">${camp.player_count}</span>
      ${travelNote ? `<span class="travel">${travelNote}</span>` : ""}
    </div>
    <span class="info">${camp.venue}</span>
  </div>
  <table><thead><tr><th>Coach</th>`;

      for (const d of campDays) {
        html += `<th class="day-col">${format(d, "EEE d/M")}</th>`;
      }
      html += `</tr></thead><tbody>`;

      for (const a of campAssigns) {
        const c = coaches.find(co => co.id === a.coach_id);
        html += `<tr><td><span class="cn">${c?.full_name || "?"}</span><span class="cr ${a.role === "head_coach" ? "rhc" : "ra"}">${a.role === "head_coach" ? "HC" : ""}</span>${c?.can_drive ? '<span class="dr">🚗</span>' : ""}</td>`;
        for (const ds of dayStrs) {
          const on = a.days.includes(ds);
          html += `<td class="dc"><span class="${on ? "don" : "dof"}">${on ? "✓" : "✗"}</span></td>`;
        }
        html += `</tr>`;
      }

      if (campAssigns.length === 0) {
        html += `<tr><td colspan="${campDays.length + 1}" style="color:#94a3b8;text-align:center;padding:6px;font-style:italic">No coaches assigned</td></tr>`;
      }

      html += `</tbody></table></div>`;
    }

    html += `<div class="footer">Teaching Tekkers · ${format(new Date(), "d MMM yyyy")}</div>`;
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
