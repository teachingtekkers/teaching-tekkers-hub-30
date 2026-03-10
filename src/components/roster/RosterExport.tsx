import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RosterCamp, RosterAssignment, RosterCoach } from "@/pages/RosterPage";

interface Props {
  camps: RosterCamp[];
  assignments: RosterAssignment[];
  coaches: RosterCoach[];
  weekStart: Date;
  weekEnd: Date;
}

export function RosterExport({ camps, assignments, coaches, weekStart, weekEnd }: Props) {
  const { toast } = useToast();

  const exportCSV = () => {
    const rows = [["Camp", "Club", "County", "Players", "Required", "Coach", "Role", "Driver", "Pickup Locations"]];

    for (const camp of camps) {
      const campAssigns = assignments.filter(a => a.camp_id === camp.id);
      if (campAssigns.length === 0) {
        rows.push([camp.name, camp.club_name, camp.county, String(camp.player_count), String(camp.required_coaches), "UNASSIGNED", "", "", ""]);
      } else {
        for (const a of campAssigns) {
          const c = coaches.find(co => co.id === a.coach_id);
          rows.push([
            camp.name, camp.club_name, camp.county,
            String(camp.player_count), String(camp.required_coaches),
            c?.full_name || "?", a.role === "head_coach" ? "Head Coach" : "Assistant",
            c?.can_drive ? "Yes" : "No",
            (c?.pickup_locations || []).join("; "),
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
        body { font-family: -apple-system, sans-serif; padding: 24px; color: #1a1a1a; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
        .camp { margin-bottom: 20px; page-break-inside: avoid; }
        .camp-header { background: #f4f4f5; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; }
        .camp-header h2 { font-size: 14px; margin: 0; }
        .camp-header p { font-size: 12px; color: #666; margin: 2px 0 0; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #e4e4e7; font-size: 11px; text-transform: uppercase; color: #888; }
        td { padding: 6px 8px; border-bottom: 1px solid #e4e4e7; }
        .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .hc { background: #dbeafe; color: #1d4ed8; }
        .driver { background: #dcfce7; color: #16a34a; }
        @media print { body { padding: 12px; } }
      </style>
    </head><body>
    <h1>Teaching Tekkers — Weekly Roster</h1>
    <p class="subtitle">${weekLabel}</p>`;

    for (const camp of camps) {
      const campAssigns = assignments.filter(a => a.camp_id === camp.id);
      html += `<div class="camp">
        <div class="camp-header">
          <h2>${camp.name} — ${camp.club_name}</h2>
          <p>${camp.venue} · ${camp.county} · ${camp.player_count} players · ${campAssigns.length}/${camp.required_coaches} coaches</p>
        </div>
        <table><tr><th>Coach</th><th>Role</th><th>Driver</th><th>Pickup Locations</th></tr>`;

      for (const a of campAssigns) {
        const c = coaches.find(co => co.id === a.coach_id);
        html += `<tr>
          <td>${c?.full_name || "?"}</td>
          <td><span class="badge ${a.role === "head_coach" ? "hc" : ""}">${a.role === "head_coach" ? "Head Coach" : "Assistant"}</span></td>
          <td>${c?.can_drive ? '<span class="badge driver">Driver</span>' : "—"}</td>
          <td>${(c?.pickup_locations || []).join(", ") || "—"}</td>
        </tr>`;
      }
      if (campAssigns.length === 0) {
        html += `<tr><td colspan="4" style="color:#999;text-align:center;padding:12px">No coaches assigned</td></tr>`;
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
