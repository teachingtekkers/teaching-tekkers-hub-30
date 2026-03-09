import { useState } from "react";
import { FileText, Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/StatCard";
import { mockCamps, mockAttendance, mockClubInvoices } from "@/data/mock";
import { ClubInvoice } from "@/types";
import { toast } from "sonner";

const InvoicesPage = () => {
  const [invoices, setInvoices] = useState<ClubInvoice[]>(mockClubInvoices);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedCampId, setSelectedCampId] = useState("");

  const handleGenerate = () => {
    if (!selectedCampId) return;
    const camp = mockCamps.find(c => c.id === selectedCampId);
    if (!camp) return;
    const existing = invoices.find(i => i.camp_id === selectedCampId);
    if (existing) { toast.error("Invoice already exists for this camp"); return; }

    const attendanceCount = new Set(
      mockAttendance.filter(a => a.camp_id === selectedCampId && a.status === "present").map(a => a.player_id)
    ).size;
    const rate = 15;
    const total = attendanceCount * rate;
    const newInvoice: ClubInvoice = {
      id: String(invoices.length + 1), camp_id: selectedCampId, club_name: camp.club_name,
      attendance_count: attendanceCount, rate_per_child: rate, total_amount: total,
      manual_amount: null, status: "draft", notes: null, created_at: new Date().toISOString(),
    };
    setInvoices([...invoices, newInvoice]);
    setGenerateOpen(false);
    setSelectedCampId("");
    toast.success(`Invoice generated: €${total} for ${camp.club_name}`);
  };

  const updateStatus = (id: string, status: ClubInvoice["status"]) => {
    setInvoices(invoices.map(i => (i.id === id ? { ...i, status } : i)));
  };

  const updateManualAmount = (id: string, value: string) => {
    const amount = value === "" ? null : Number(value);
    setInvoices(invoices.map(i => (i.id === id ? { ...i, manual_amount: amount } : i)));
  };

  const getEffectiveAmount = (invoice: ClubInvoice) => invoice.manual_amount ?? invoice.total_amount;

  const statusBadge = (status: ClubInvoice["status"]) => {
    switch (status) {
      case "draft": return <Badge variant="secondary">Draft</Badge>;
      case "sent": return <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]">Sent</Badge>;
      case "paid": return <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">Paid</Badge>;
    }
  };

  const campsWithoutInvoice = mockCamps.filter(c => !invoices.some(i => i.camp_id === c.id));
  const totalInvoiced = invoices.reduce((s, i) => s + getEffectiveAmount(i), 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + getEffectiveAmount(i), 0);
  const totalOutstanding = invoices.filter(i => i.status !== "paid").reduce((s, i) => s + getEffectiveAmount(i), 0);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Club Invoices</h1>
          <p className="text-muted-foreground text-sm">Generate and track club payments based on attendance</p>
        </div>
        <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Generate Invoice</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate Club Invoice</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Select Camp</Label>
                <Select value={selectedCampId} onValueChange={setSelectedCampId}>
                  <SelectTrigger><SelectValue placeholder="Choose a camp" /></SelectTrigger>
                  <SelectContent>
                    {campsWithoutInvoice.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} — {c.club_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCampId && (() => {
                const count = new Set(
                  mockAttendance.filter(a => a.camp_id === selectedCampId && a.status === "present").map(a => a.player_id)
                ).size;
                return (
                  <div className="rounded-lg border p-3 space-y-1 text-sm bg-muted/30">
                    <p>Attendance: <strong>{count} children</strong></p>
                    <p>Rate: <strong>€15 per child</strong></p>
                    <p>Estimated total: <strong>€{count * 15}</strong></p>
                  </div>
                );
              })()}
              <Button onClick={handleGenerate} className="w-full">Generate</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Invoiced" value={`€${totalInvoiced.toLocaleString()}`} />
        <StatCard label="Paid" value={`€${totalPaid.toLocaleString()}`} />
        <StatCard label="Outstanding" value={`€${totalOutstanding.toLocaleString()}`} />
      </div>

      {/* Mobile */}
      <div className="grid gap-4 sm:hidden">
        {invoices.map(invoice => {
          const camp = mockCamps.find(c => c.id === invoice.camp_id);
          return (
            <Card key={invoice.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{invoice.club_name}</p>
                    <p className="text-sm text-muted-foreground">{camp?.name}</p>
                  </div>
                  {statusBadge(invoice.status)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Attendance:</span> {invoice.attendance_count}</div>
                  <div><span className="text-muted-foreground">Rate:</span> €{invoice.rate_per_child}</div>
                  <div><span className="text-muted-foreground">Total:</span> <strong className="font-mono">€{getEffectiveAmount(invoice).toFixed(2)}</strong></div>
                </div>
                <Select value={invoice.status} onValueChange={(v) => updateStatus(invoice.id, v as ClubInvoice["status"])}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop */}
      <Card className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Club</TableHead>
              <TableHead>Camp</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Calculated</TableHead>
              <TableHead>Override</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map(invoice => {
              const camp = mockCamps.find(c => c.id === invoice.camp_id);
              return (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.club_name}</TableCell>
                  <TableCell>{camp?.name}</TableCell>
                  <TableCell>{invoice.attendance_count}</TableCell>
                  <TableCell>€{invoice.rate_per_child}</TableCell>
                  <TableCell className="font-mono">€{invoice.total_amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Input type="number" className="w-24 h-8" placeholder="—" value={invoice.manual_amount ?? ""} onChange={(e) => updateManualAmount(invoice.id, e.target.value)} />
                  </TableCell>
                  <TableCell>{statusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    <Select value={invoice.status} onValueChange={(v) => updateStatus(invoice.id, v as ClubInvoice["status"])}>
                      <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default InvoicesPage;
