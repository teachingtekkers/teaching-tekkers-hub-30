import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
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

const EXP_SHORT: Record<string, string> = { lead: "Lead HC", senior: "Senior HC", standard: "Standard", junior: "Junior" };

export function RosterExport({ camps, assignments, coaches, weekStart, weekEnd }: Props) {
  const { toast } = useToast();

  const exportCSV = () => {
    const allDays = new Set<string>();
    camps.forEach(c => getCampDays(c).forEach(d => allDays.add(format(d, "yyyy-MM-dd"))));
    const sortedDays = [...allDays].sort();
    const dayHeaders = sortedDays.map(d => format(new Date(d + "T00:00:00"), "EEE d MMM"));

    const rows = [["Camp", "Club", "Players", "Coach", "Role", "Level", "Driver", ...dayHeaders, "Total Days"]];

    for (const camp of camps) {
      const campAssigns = assignments.filter(a => a.camp_id === camp.id);
      if (campAssigns.length === 0) {
        rows.push([camp.name, camp.club_name, String(camp.player_count), "UNASSIGNED", "", "", "", ...sortedDays.map(() => ""), ""]);
      } else {
        for (const a of campAssigns) {
          const c = coaches.find(co => co.id === a.coach_id);
          rows.push([
            camp.name, camp.club_name, String(camp.player_count),
            c?.full_name || "?",
            a.role === "head_coach" ? "Head Coach" : (a.is_day1_support ? "Day 1 Support" : "Assistant"),
            EXP_SHORT[c?.experience_level || "standard"] || "",
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
    const weekLabel = `${format(weekStart, "d MMM")} — ${format(weekEnd, "d MMM yyyy")}`;

    let html = `<html><head><title>Teaching Tekkers Roster — ${weekLabel}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, 'Segoe UI', sans-serif; padding: 20px; color: #1a1a1a; font-size: 12px; }
        h1 { font-size: 18px; margin-bottom: 2px; }
        .subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }
        .camp { margin-bottom: 16px; page-break-inside: avoid; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; }
        .camp-header { background: #f4f4f5; padding: 8px 12px; border-bottom: 1px solid #e0e0e0; }
        .camp-header h2 { font-size: 13px; font-weight: 700; }
        .camp-header span { font-size: 11px; color: #666; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: center; padding: 4px 6px; border-bottom: 2px solid #d4d4d8; font-size: 10px; text-transform: uppercase; color: #71717a; background: #fafafa; }
        th:first-child, th:nth-child(2) { text-align: left; }
        td { padding: 4px 6px; border-bottom: 1px solid #f0f0f0; }
        .day-cell { width: 54px; text-align: center; }
        .day-on { background: #22c55e; color: white; border-radius: 3px; padding: 2px 4px; font-weight: 700; font-size: 10px; }
        .day-off { background: #fecaca; color: #dc2626; border-radius: 3px; padding: 2px 4px; font-size: 10px; }
        .badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: 600; margin-left: 4px; }
        .hc { background: #dbeafe; color: #1d4ed8; }
        .driver { background: #dcfce7; color: #16a34a; }
        .d1 { background: #fef3c7; color: #92400e; }
        .exp { font-size: 9px; color: #888; }
        @media print { body { padding: 10px; } .camp { break-inside: avoid; } }
      </style>
    </head><body>
    <h1>Teaching Tekkers — Weekly Roster</h1>
    <p class="subtitle">${weekLabel}</p>`;

    for (const camp of camps) {
      const campDays = getCampDays(camp);
      const campAssigns = assignments.filter(a => a.camp_id === camp.id);

      html += `<div class="camp">
        <div class="camp-header">
          <h2>${camp.name} <span>· ${camp.club_name} · ${camp.venue} · ${camp.county}</span></h2>
          <span>${camp.player_count} players · ${campAssigns.filter(a => !a.is_day1_support).length}/${camp.required_coaches} coaches</span>
        </div>
        <table>
          <tr><th style="min-width:140px">Coach</th><th style="width:80px">Role</th>`;

      for (const d of campDays) {
        html += `<th class="day-cell">${format(d, "EEE")}<br/>${format(d, "d MMM")}</th>`;
      }
      html += `<th style="width:40px">Days</th></tr>`;

      for (const a of campAssigns) {
        const c = coaches.find(co => co.id === a.coach_id);
        const dayStrings = campDays.map(d => format(d, "yyyy-MM-dd"));
        html += `<tr>
          <td><strong>${c?.full_name || "?"}</strong>${c?.can_drive ? ' <span class="badge driver">🚗</span>' : ''} <span class="exp">${EXP_SHORT[c?.experience_level || "standard"] || ""}</span></td>
          <td><span class="badge ${a.role === "head_coach" ? "hc" : ""} ${a.is_day1_support ? "d1" : ""}">${a.role === "head_coach" ? "HC" : (a.is_day1_support ? "D1" : "Asst")}</span></td>`;

        for (const ds of dayStrings) {
          const on = a.days.includes(ds);
          html += `<td class="day-cell"><span class="${on ? "day-on" : "day-off"}">${on ? "✓" : "✗"}</span></td>`;
        }
        html += `<td style="text-align:center;font-weight:700">${a.days.length}</td></tr>`;
      }

      if (campAssigns.length === 0) {
        html += `<tr><td colspan="${campDays.length + 3}" style="color:#999;text-align:center;padding:10px">No coaches assigned</td></tr>`;
      }
      html += `</table></div>`;
    }

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
        <FileDown className="h-4 w-4" /> Print Roster
      </Button>
    </div>
  );
}
