import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FileDown, Printer, Receipt, X } from "lucide-react";
import { useState } from "react";

export interface ReceiptBooking {
  id: string;
  external_booking_id: string | null;
  child_first_name: string;
  child_last_name: string;
  parent_name: string | null;
  parent_email: string | null;
  camp_name: string;
  camp_date: string | null;
  venue: string | null;
  total_amount: number | null;
  amount_paid: number | null;
  amount_owed: number | null;
  sibling_discount: number | null;
  refund_amount: number | null;
  payment_status: string | null;
  payment_type: string | null;
  imported_at: string;
  matched_camp_id: string | null;
}

interface Props {
  booking: ReceiptBooking;
  trigger?: React.ReactNode;
}

function statusLabel(s: string | null): string {
  if (!s) return "Unknown";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildReceiptHTML(b: ReceiptBooking): string {
  const ref = b.external_booking_id || b.id.slice(0, 8).toUpperCase();
  const date = b.camp_date ? format(new Date(b.camp_date), "dd MMM yyyy") : b.imported_at ? format(new Date(b.imported_at), "dd MMM yyyy") : "—";
  const totalCost = Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0));

  return `<!DOCTYPE html><html><head><title>Receipt - ${ref}</title>
<style>
@page{size:A4;margin:15mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Segoe UI',Helvetica,sans-serif;color:#1e293b;font-size:12px;line-height:1.5;max-width:600px;margin:0 auto;padding:40px 20px}
.logo{text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #2563eb}
.logo h1{font-size:22px;font-weight:800;color:#2563eb;letter-spacing:-0.5px}
.logo p{font-size:11px;color:#64748b;margin-top:2px}
.receipt-title{text-align:center;margin-bottom:24px}
.receipt-title h2{font-size:18px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:1px}
.receipt-title .ref{font-size:11px;color:#64748b;margin-top:4px}
.section{margin-bottom:20px}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}
.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9}
.row:last-child{border-bottom:none}
.row .label{color:#64748b;font-size:11px}
.row .value{font-weight:600;text-align:right}
.total-row{display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #1e293b;margin-top:8px;font-size:14px;font-weight:800}
.status{display:inline-block;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px}
.status-paid{background:#dcfce7;color:#166534}
.status-pending{background:#fef9c3;color:#854d0e}
.status-refunded{background:#fee2e2;color:#991b1b}
.status-partial{background:#fff7ed;color:#9a3412}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:9px;color:#94a3b8}
@media print{body{padding:0;max-width:100%}button{display:none!important}}
</style></head><body>
<div class="logo">
<h1>Teaching Tekkers</h1>
<p>Summer Camp Booking Receipt</p>
</div>
<div class="receipt-title">
<h2>Payment Receipt</h2>
<p class="ref">Ref: ${ref} · Date: ${date}</p>
</div>
<div class="section">
<div class="section-title">Booking Details</div>
<div class="row"><span class="label">Child</span><span class="value">${b.child_first_name} ${b.child_last_name}</span></div>
<div class="row"><span class="label">Parent / Guardian</span><span class="value">${b.parent_name || "—"}</span></div>
${b.parent_email ? `<div class="row"><span class="label">Email</span><span class="value">${b.parent_email}</span></div>` : ""}
<div class="row"><span class="label">Camp</span><span class="value">${b.camp_name}</span></div>
${b.venue ? `<div class="row"><span class="label">Venue</span><span class="value">${b.venue}</span></div>` : ""}
<div class="row"><span class="label">Camp Date</span><span class="value">${date}</span></div>
</div>
<div class="section">
<div class="section-title">Payment Summary</div>
<div class="row"><span class="label">Camp Fee</span><span class="value">€${(b.total_amount ?? 0).toFixed(2)}</span></div>
${(b.sibling_discount ?? 0) > 0 ? `<div class="row"><span class="label">Sibling Discount</span><span class="value">-€${(b.sibling_discount ?? 0).toFixed(2)}</span></div>` : ""}
<div class="row"><span class="label">Total Cost</span><span class="value">€${totalCost.toFixed(2)}</span></div>
<div class="row"><span class="label">Amount Paid</span><span class="value" style="color:#166534">€${(b.amount_paid ?? 0).toFixed(2)}</span></div>
${(b.refund_amount ?? 0) > 0 ? `<div class="row"><span class="label">Refund</span><span class="value" style="color:#991b1b">€${(b.refund_amount ?? 0).toFixed(2)}</span></div>` : ""}
${(b.amount_owed ?? 0) > 0 ? `<div class="row"><span class="label">Amount Outstanding</span><span class="value" style="color:#854d0e">€${(b.amount_owed ?? 0).toFixed(2)}</span></div>` : ""}
${b.payment_type ? `<div class="row"><span class="label">Payment Method</span><span class="value">${b.payment_type}</span></div>` : ""}
<div class="total-row"><span>Payment Status</span><span class="status status-${(b.payment_status || "pending").toLowerCase()}">${statusLabel(b.payment_status)}</span></div>
</div>
<div class="footer">
<p>Teaching Tekkers · This receipt was generated from booking records.</p>
<p>Booking Reference: ${ref}</p>
</div>
</body></html>`;
}

export function BookingReceiptButton({ booking, trigger }: Props) {
  const [open, setOpen] = useState(false);

  const ref = booking.external_booking_id || booking.id.slice(0, 8).toUpperCase();

  const printReceipt = () => {
    const html = buildReceiptHTML(booking);
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  };

  const downloadPDF = () => {
    const html = buildReceiptHTML(booking);
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      // Browser print-to-PDF
      setTimeout(() => w.print(), 300);
    }
  };

  const totalCost = Math.max(0, (booking.total_amount ?? 0) - (booking.sibling_discount ?? 0));
  const date = booking.camp_date ? format(new Date(booking.camp_date), "dd MMM yyyy") : booking.imported_at ? format(new Date(booking.imported_at), "dd MMM yyyy") : "—";

  return (
    <>
      <span onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
            <Receipt className="h-3.5 w-3.5" /> Receipt
          </Button>
        )}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Booking Receipt
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Receipt Preview */}
            <div className="border rounded-lg p-5 space-y-4 bg-card">
              <div className="text-center border-b pb-3">
                <h3 className="text-lg font-bold text-primary">Teaching Tekkers</h3>
                <p className="text-xs text-muted-foreground">Payment Receipt</p>
                <p className="text-xs text-muted-foreground mt-1">Ref: {ref} · {date}</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Child</span><span className="font-medium">{booking.child_first_name} {booking.child_last_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Parent</span><span className="font-medium">{booking.parent_name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Camp</span><span className="font-medium">{booking.camp_name}</span></div>
                {booking.venue && <div className="flex justify-between"><span className="text-muted-foreground">Venue</span><span className="font-medium">{booking.venue}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{date}</span></div>
              </div>

              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Camp Fee</span><span className="font-mono">€{(booking.total_amount ?? 0).toFixed(2)}</span></div>
                {(booking.sibling_discount ?? 0) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Sibling Discount</span><span className="font-mono text-emerald-600">-€{(booking.sibling_discount ?? 0).toFixed(2)}</span></div>
                )}
                <div className="flex justify-between font-medium"><span>Total Cost</span><span className="font-mono">€{totalCost.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Amount Paid</span><span className="font-mono text-emerald-600">€{(booking.amount_paid ?? 0).toFixed(2)}</span></div>
                {(booking.refund_amount ?? 0) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Refund</span><span className="font-mono text-destructive">€{(booking.refund_amount ?? 0).toFixed(2)}</span></div>
                )}
                {(booking.amount_owed ?? 0) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="font-mono text-amber-600">€{(booking.amount_owed ?? 0).toFixed(2)}</span></div>
                )}
              </div>

              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-sm font-semibold">Payment Status</span>
                <Badge variant={
                  booking.payment_status === "paid" ? "default" :
                  booking.payment_status === "refunded" ? "destructive" : "secondary"
                }>
                  {statusLabel(booking.payment_status)}
                </Badge>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={printReceipt} className="gap-1.5">
                <Printer className="h-4 w-4" /> Print
              </Button>
              <Button size="sm" onClick={downloadPDF} className="gap-1.5">
                <FileDown className="h-4 w-4" /> Download PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
