import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { FileDown, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentRow {
  clubName: string;
  campName: string;
  attendance: number;
  rate: number;
  total: number;
  status: string;
}

interface Props {
  payments: PaymentRow[];
  title: string;
  totalAmount: number;
}

export function ClubPaymentExport({ payments, title, totalAmount }: Props) {
  const { toast } = useToast();

  const exportCSV = () => {
    const rows = [["Club", "Camp", "Attendance", "Rate", "Total", "Status"]];
    payments.forEach(p => {
      rows.push([p.clubName, p.campName, String(p.attendance), `€${p.rate}`, `€${p.total.toFixed(2)}`, p.status]);
    });
    rows.push(["", "", "", "", `€${totalAmount.toFixed(2)}`, "TOTAL"]);
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `TT-Club-Payments-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported" });
  };

  const printPayments = () => {
    const html = `<!DOCTYPE html><html><head><title>${title}</title>
<style>
@page{size:A4 portrait;margin:10mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;color:#1e293b;font-size:11px;line-height:1.4}
.hdr{background:linear-gradient(135deg,#1e3a5f,#2563eb);color:#fff;padding:10px 16px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.hdr h1{font-size:16px;font-weight:800}
.hdr .sub{font-size:10px;opacity:.85}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
th{background:#eef2f7;padding:6px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;color:#475569;border-bottom:1px solid #c7d2e0;text-align:left}
th.r{text-align:right}
td{padding:6px 8px;border-bottom:1px solid #eef0f4;font-size:10.5px}
td.r{text-align:right;font-family:ui-monospace,monospace}
tr:nth-child(even){background:#f9fafb}
.tot{background:#f0fdf4;font-weight:700}
.tot td{border-top:2px solid #22c55e}
.badge{display:inline-block;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:600}
.draft{background:#e2e8f0;color:#475569}
.ready{background:#dbeafe;color:#1d4ed8}
.paid{background:#d1fae5;color:#059669}
.ft{margin-top:8px;text-align:center;font-size:8px;color:#94a3b8}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hdr">
<div><h1>Teaching Tekkers</h1><div class="sub">${title}</div></div>
<div class="sub">${payments.length} Payments · €${totalAmount.toFixed(2)}</div>
</div>
<table>
<thead><tr><th>Club</th><th>Camp</th><th class="r">Attendance</th><th class="r">Rate</th><th class="r">Total</th><th>Status</th></tr></thead>
<tbody>
${payments.map(p => `<tr><td>${p.clubName}</td><td>${p.campName}</td><td class="r">${p.attendance}</td><td class="r">€${p.rate}</td><td class="r"><b>€${p.total.toFixed(2)}</b></td><td><span class="badge ${p.status}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span></td></tr>`).join("")}
<tr class="tot"><td colspan="4" style="text-align:right">Total</td><td class="r">€${totalAmount.toFixed(2)}</td><td></td></tr>
</tbody></table>
<div class="ft">Teaching Tekkers Club Payments · Generated ${format(new Date(), "d MMM yyyy HH:mm")}</div>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
        <FileDown className="h-4 w-4" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={printPayments} className="gap-2">
        <Printer className="h-4 w-4" /> Print / PDF
      </Button>
    </div>
  );
}
