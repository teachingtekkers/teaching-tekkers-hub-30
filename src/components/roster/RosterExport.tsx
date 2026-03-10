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
    const rows = [["Camp", "Players", "Coach", "Role", ...dayHeaders, "Days"]];

    for (const camp of camps) {
      const ca = assignments.filter(a => a.camp_id === camp.id);
      if (ca.length === 0) {
        rows.push([camp.name, String(camp.player_count), "—", "", ...sortedDays.map(() => ""), ""]);
      } else {
        for (const a of ca) {
          const c = coaches.find(co => co.id === a.coach_id);
          rows.push([
            camp.name, String(camp.player_count), c?.full_name || "?",
            a.role === "head_coach" ? "HC" : "Asst",
            ...sortedDays.map(d => a.days.includes(d) ? "✓" : ""), String(a.days.length),
          ]);
        }
      }
    }
    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `TT-Roster-${format(weekStart, "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported" });
  };

  const printRoster = () => {
    const weekLabel = format(weekStart, "d MMMM yyyy");

    const html = `<!DOCTYPE html><html><head><title>Teaching Tekkers Roster</title>
<style>
@page{size:A4 landscape;margin:5mm 7mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;color:#1e293b;font-size:9px;line-height:1.15}

.hdr{background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;padding:5px 10px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.hdr h1{font-size:14px;font-weight:800}
.hdr .wk{font-size:9px;opacity:.85}
.hdr .sm{font-size:7.5px;opacity:.6}

.camp{margin-bottom:3px;border:1px solid #c7d2e0;border-radius:3px;overflow:hidden;page-break-inside:avoid}
.ch{background:linear-gradient(90deg,#1e40af,#3b82f6);color:#fff;padding:3px 8px;display:flex;justify-content:space-between;align-items:center}
.ch h2{font-size:9.5px;font-weight:700}
.ch .pl{background:rgba(255,255,255,.2);padding:0 4px;border-radius:2px;font-weight:700;font-size:8.5px;margin-left:5px}
.ch .tr{font-size:7px;opacity:.7;margin-left:6px;font-style:italic}
.ch .vn{font-size:7.5px;opacity:.8}

.g{width:100%;border-collapse:collapse}
.g th{background:#eef2f7;padding:2px 3px;font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:#475569;border-bottom:1px solid #c7d2e0;text-align:center}
.g th:first-child{text-align:left;width:120px}
.g td{padding:1.5px 3px;border-bottom:1px solid #eef0f4;vertical-align:middle;height:14px}
.g tr:nth-child(even){background:#f9fafb}
.g tr:last-child td{border-bottom:0}

.cn{font-weight:600;font-size:8.5px;white-space:nowrap}
.rl{font-size:7px;font-weight:600;padding:0 3px;border-radius:2px;display:inline;margin-left:3px}
.hc{background:#dbeafe;color:#1d4ed8}

.dc{text-align:center;width:40px}
.on{display:inline-block;width:26px;height:12px;line-height:12px;background:#22c55e;color:#fff;border-radius:2px;font-weight:800;font-size:7.5px;text-align:center}
.of{display:inline-block;width:26px;height:12px;line-height:12px;background:#fecaca;color:#ef4444;border-radius:2px;font-size:7.5px;text-align:center}

.ft{margin-top:3px;text-align:center;font-size:6.5px;color:#94a3b8}

@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.camp{break-inside:avoid}}
</style></head><body>

<div class="hdr">
<div><h1>Teaching Tekkers</h1><div class="wk">Week Commencing ${weekLabel}</div></div>
<div class="sm">${camps.length} Camps · ${new Set(assignments.map(a => a.coach_id)).size} Coaches</div>
</div>

${camps.map(camp => {
  const campDays = getCampDays(camp);
  const dayStrs = campDays.map(d => format(d, "yyyy-MM-dd"));
  const ca = assignments.filter(a => a.camp_id === camp.id);

  const drvrs = ca.filter(a => a.driving_this_week).map(a => coaches.find(c => c.id === a.coach_id)?.full_name?.split(" ")[0]).filter(Boolean);
  const pax = ca.filter(a => !a.driving_this_week).map(a => coaches.find(c => c.id === a.coach_id)?.full_name?.split(" ")[0]).filter(Boolean);
  const tNote = drvrs.length > 0 && pax.length > 0 ? `🚗 ${drvrs.join(", ")} → ${pax.join(", ")}` : "";

  return `<div class="camp">
<div class="ch">
  <div style="display:flex;align-items:center"><h2>${camp.name}</h2><span class="pl">${camp.player_count}</span>${tNote ? `<span class="tr">${tNote}</span>` : ""}</div>
  <span class="vn">${camp.venue}</span>
</div>
<table class="g"><thead><tr><th>Coach</th>${campDays.map(d => `<th class="dc">${format(d, "EEE")}<br/>${format(d, "d/M")}</th>`).join("")}</tr></thead>
<tbody>${ca.length === 0
  ? `<tr><td colspan="${campDays.length + 1}" style="text-align:center;color:#94a3b8;padding:4px">—</td></tr>`
  : ca.map(a => {
    const c = coaches.find(co => co.id === a.coach_id);
    return `<tr><td><span class="cn">${c?.full_name || "?"}</span>${a.role === "head_coach" ? '<span class="rl hc">HC</span>' : ""}</td>${dayStrs.map(ds => `<td class="dc"><span class="${a.days.includes(ds) ? "on" : "of"}">${a.days.includes(ds) ? "✓" : "✗"}</span></td>`).join("")}</tr>`;
  }).join("")}
</tbody></table></div>`;
}).join("")}

<div class="ft">Teaching Tekkers · ${format(new Date(), "d MMM yyyy")}</div>
</body></html>`;

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
