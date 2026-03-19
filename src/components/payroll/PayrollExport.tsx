import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { FileDown, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { PayrollCampEntry } from "@/pages/PayrollPage";

interface CoachSummary {
  coachName: string;
  entries: PayrollCampEntry[];
  grandTotal: number;
  totalCampBonus?: number;
}

interface Props {
  coachSummaries: CoachSummary[];
  weekStart: Date;
  weekEnd: Date;
  weekTotal: number;
}

export function PayrollExport({ coachSummaries, weekStart, weekEnd, weekTotal }: Props) {
  const { toast } = useToast();

  const exportCSV = () => {
    const rows = [["Coach", "Camp", "Role", "Days", "Rate", "Base", "Fuel", "Camp Bonus", "Manual Bonus", "Adj", "Total"]];
    coachSummaries.forEach(cs => {
      cs.entries.forEach(e => {
        rows.push([
          cs.coachName, e.campName, e.role === "head_coach" ? "HC" : "Asst",
          String(e.daysWorked), String(e.dailyRate), e.basePay.toFixed(2),
          e.fuel.toFixed(2), e.campBonus.toFixed(2), e.bonus.toFixed(2),
          e.adjustment.toFixed(2), e.lineTotal.toFixed(2),
        ]);
      });
    });
    rows.push(["", "", "", "", "", "", "", "", "", "TOTAL", weekTotal.toFixed(2)]);
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `TT-Payroll-${format(weekStart, "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Payroll CSV exported" });
  };

  const printPayroll = () => {
    const weekLabel = `${format(weekStart, "d MMM")} — ${format(weekEnd, "d MMM yyyy")}`;
    const html = `<!DOCTYPE html><html><head><title>Teaching Tekkers Payroll</title>
<style>
@page{size:A4 landscape;margin:8mm 10mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;color:#1e293b;font-size:10px;line-height:1.3}
.hdr{background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;padding:8px 14px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.hdr h1{font-size:16px;font-weight:800}
.hdr .sub{font-size:10px;opacity:.85}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
th{background:#eef2f7;padding:4px 6px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:#475569;border-bottom:1px solid #c7d2e0;text-align:left}
th.r{text-align:right}
td{padding:4px 6px;border-bottom:1px solid #eef0f4;font-size:9.5px}
td.r{text-align:right;font-family:ui-monospace,monospace}
tr:nth-child(even){background:#f9fafb}
.tot{background:#f0fdf4;font-weight:700}
.tot td{border-top:2px solid #22c55e}
.ft{margin-top:6px;text-align:center;font-size:7.5px;color:#94a3b8}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hdr">
<div><h1>Teaching Tekkers — Payroll</h1><div class="sub">Week: ${weekLabel}</div></div>
<div class="sub">${coachSummaries.length} Coaches · €${weekTotal.toFixed(2)} Total</div>
</div>
<table>
<thead><tr><th>Coach</th><th>Camp</th><th>Role</th><th class="r">Days</th><th class="r">Rate</th><th class="r">Base</th><th class="r">Fuel</th><th class="r">Camp Bonus</th><th class="r">Manual</th><th class="r">Adj.</th><th class="r">Total</th></tr></thead>
<tbody>
${coachSummaries.map(cs => {
  const rows = cs.entries.map((e, i) =>
    `<tr><td>${i === 0 ? cs.coachName : ""}</td><td>${e.campName}</td><td>${e.role === "head_coach" ? "HC" : "Asst"}</td><td class="r">${e.daysWorked}</td><td class="r">€${e.dailyRate}</td><td class="r">€${e.basePay.toFixed(2)}</td><td class="r">€${e.fuel.toFixed(2)}</td><td class="r">${e.campBonus > 0 ? "€" + e.campBonus.toFixed(2) : "—"}</td><td class="r">€${e.bonus.toFixed(2)}</td><td class="r">€${e.adjustment.toFixed(2)}</td><td class="r"><b>€${e.lineTotal.toFixed(2)}</b></td></tr>`
  ).join("");
  const subtotal = cs.entries.length > 1
    ? `<tr style="background:#f0f9ff"><td colspan="10" style="text-align:right;font-weight:600">${cs.coachName} Total</td><td class="r" style="font-weight:700">€${cs.grandTotal.toFixed(2)}</td></tr>`
    : "";
  return rows + subtotal;
}).join("")}
<tr class="tot"><td colspan="10" style="text-align:right;font-size:11px">Week Total</td><td class="r" style="font-size:11px">€${weekTotal.toFixed(2)}</td></tr>
</tbody></table>
<div class="ft">Teaching Tekkers Payroll · Generated ${format(new Date(), "d MMM yyyy HH:mm")}</div>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
        <FileDown className="h-4 w-4" /> Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={printPayroll} className="gap-2">
        <Printer className="h-4 w-4" /> Print Payroll
      </Button>
    </div>
  );
}
