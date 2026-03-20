import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, CreditCard } from "lucide-react";
import { toast } from "sonner";

const PAYMENT_TYPES = [
  { value: "single", label: "Single Session" },
  { value: "4_week", label: "4-Week Block" },
  { value: "6_week", label: "6-Week Block" },
  { value: "monthly", label: "Monthly" },
  { value: "club_paid", label: "Club Paid" },
];

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default", pending: "destructive", partial: "secondary", refunded: "outline",
};

const emptyForm = {
  child_id: "", session_group_id: "", payer_type: "child", payment_type: "single",
  amount_due: 0, amount_paid: 0, block_start_date: "", block_end_date: "",
  payment_date: "", notes: "",
};

export default function PrivatePaymentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["private-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("private_payments")
        .select("*, private_children(first_name, last_name), private_session_groups(group_name, private_venues(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: children = [] } = useQuery({
    queryKey: ["private-children"],
    queryFn: async () => {
      const { data } = await supabase.from("private_children").select("id, first_name, last_name").eq("status", "active").order("last_name");
      return data || [];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["private-sessions"],
    queryFn: async () => {
      const { data } = await supabase.from("private_session_groups").select("id, group_name, private_venues(name)").order("group_name");
      return data || [];
    },
  });

  const filtered = payments.filter((p: any) => filterStatus === "all" || p.payment_status === filterStatus);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const balance = Math.max(0, form.amount_due - form.amount_paid);
      const status = form.amount_paid >= form.amount_due && form.amount_due > 0 ? "paid"
        : form.amount_paid > 0 ? "partial" : "pending";
      const payload = {
        child_id: form.child_id || null,
        session_group_id: form.session_group_id || null,
        payer_type: form.payer_type,
        payment_type: form.payment_type,
        amount_due: form.amount_due,
        amount_paid: form.amount_paid,
        balance,
        payment_status: status,
        block_start_date: form.block_start_date || null,
        block_end_date: form.block_end_date || null,
        payment_date: form.payment_date || null,
        notes: form.notes,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from("private_payments").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("private_payments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-payments"] });
      toast.success(editing ? "Payment updated" : "Payment added");
      setOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: () => toast.error("Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("private_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-payments"] });
      toast.success("Payment removed");
    },
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      child_id: p.child_id || "", session_group_id: p.session_group_id || "",
      payer_type: p.payer_type, payment_type: p.payment_type,
      amount_due: p.amount_due, amount_paid: p.amount_paid,
      block_start_date: p.block_start_date || "", block_end_date: p.block_end_date || "",
      payment_date: p.payment_date || "", notes: p.notes || "",
    });
    setOpen(true);
  };

  const totalDue = payments.reduce((s: number, p: any) => s + (p.amount_due || 0), 0);
  const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount_paid || 0), 0);
  const totalBalance = payments.reduce((s: number, p: any) => s + (p.balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground mt-1">Track private coaching payments and balances</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Add Payment
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Due</p><p className="text-xl font-bold">€{totalDue.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Paid</p><p className="text-xl font-bold text-green-600">€{totalPaid.toFixed(2)}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-xl font-bold text-red-600">€{totalBalance.toFixed(2)}</p></CardContent></Card>
      </div>

      <div className="flex gap-2">
        {["all", "pending", "partial", "paid"].map(s => (
          <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)}>
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Child / Payer</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No payments found.</TableCell></TableRow>
              ) : filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.payer_type === "club" ? <Badge variant="secondary">Club</Badge>
                      : p.private_children ? `${p.private_children.first_name} ${p.private_children.last_name}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.private_session_groups?.group_name || "—"}
                    {p.private_session_groups?.private_venues?.name && (
                      <span className="text-xs text-muted-foreground block">{p.private_session_groups.private_venues.name}</span>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{PAYMENT_TYPES.find(t => t.value === p.payment_type)?.label || p.payment_type}</Badge></TableCell>
                  <TableCell className="text-right">€{p.amount_due?.toFixed(2)}</TableCell>
                  <TableCell className="text-right">€{p.amount_paid?.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-medium">€{p.balance?.toFixed(2)}</TableCell>
                  <TableCell><Badge variant={STATUS_COLORS[p.payment_status] || "outline"}>{p.payment_status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                        if (confirm("Delete payment?")) deleteMutation.mutate(p.id);
                      }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Payment" : "Add Payment"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Payer Type</Label>
              <Select value={form.payer_type} onValueChange={v => setForm(p => ({ ...p, payer_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="child">Child / Parent</SelectItem>
                  <SelectItem value="club">Club / Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.payer_type === "child" && (
              <div><Label>Child</Label>
                <Select value={form.child_id} onValueChange={v => setForm(p => ({ ...p, child_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
                  <SelectContent>{children.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Session Group</Label>
              <Select value={form.session_group_id} onValueChange={v => setForm(p => ({ ...p, session_group_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>{sessions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.group_name} ({(s.private_venues as any)?.name})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Payment Type</Label>
              <Select value={form.payment_type} onValueChange={v => setForm(p => ({ ...p, payment_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Amount Due (€)</Label><Input type="number" value={form.amount_due} onChange={e => setForm(p => ({ ...p, amount_due: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label>Amount Paid (€)</Label><Input type="number" value={form.amount_paid} onChange={e => setForm(p => ({ ...p, amount_paid: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
            {(form.payment_type === "4_week" || form.payment_type === "6_week" || form.payment_type === "monthly") && (
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Block Start</Label><Input type="date" value={form.block_start_date} onChange={e => setForm(p => ({ ...p, block_start_date: e.target.value }))} /></div>
                <div><Label>Block End</Label><Input type="date" value={form.block_end_date} onChange={e => setForm(p => ({ ...p, block_end_date: e.target.value }))} /></div>
              </div>
            )}
            <div><Label>Payment Date</Label><Input type="date" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : editing ? "Update Payment" : "Add Payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
