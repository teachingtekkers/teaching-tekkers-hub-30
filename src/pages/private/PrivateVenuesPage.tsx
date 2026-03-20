import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Venue {
  id: string;
  name: string;
  address: string;
  county: string;
  venue_cost_per_session: number;
  notes: string;
  contact_name: string;
  contact_phone: string;
  status: string;
}

const emptyVenue = {
  name: "", address: "", county: "", venue_cost_per_session: 0,
  notes: "", contact_name: "", contact_phone: "", status: "active",
};

export default function PrivateVenuesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [form, setForm] = useState(emptyVenue);

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ["private-venues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("private_venues")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Venue[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("private_venues").update({
          name: form.name, address: form.address, county: form.county,
          venue_cost_per_session: form.venue_cost_per_session, notes: form.notes,
          contact_name: form.contact_name, contact_phone: form.contact_phone,
          status: form.status, updated_at: new Date().toISOString(),
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("private_venues").insert({
          name: form.name, address: form.address, county: form.county,
          venue_cost_per_session: form.venue_cost_per_session, notes: form.notes,
          contact_name: form.contact_name, contact_phone: form.contact_phone,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-venues"] });
      toast.success(editing ? "Venue updated" : "Venue added");
      setOpen(false); setEditing(null); setForm(emptyVenue);
    },
    onError: () => toast.error("Failed to save venue"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("private_venues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-venues"] });
      toast.success("Venue removed");
    },
  });

  const openEdit = (v: Venue) => {
    setEditing(v);
    setForm({ name: v.name, address: v.address, county: v.county,
      venue_cost_per_session: v.venue_cost_per_session, notes: v.notes,
      contact_name: v.contact_name, contact_phone: v.contact_phone, status: v.status });
    setOpen(true);
  };

  const openNew = () => { setEditing(null); setForm(emptyVenue); setOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Venues</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage private coaching venues</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Venue</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>County</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Cost / Session</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : venues.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No venues yet. Add your first venue to get started.</TableCell></TableRow>
              ) : venues.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-medium">{v.name}</p>
                        {v.address && <p className="text-xs text-muted-foreground">{v.address}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{v.county || "—"}</TableCell>
                  <TableCell>
                    {v.contact_name && <p className="text-sm">{v.contact_name}</p>}
                    {v.contact_phone && <p className="text-xs text-muted-foreground">{v.contact_phone}</p>}
                    {!v.contact_name && !v.contact_phone && "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">€{v.venue_cost_per_session}</TableCell>
                  <TableCell>
                    <Badge variant={v.status === "active" ? "default" : "secondary"}>{v.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (confirm("Remove this venue?")) deleteMutation.mutate(v.id);
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Venue" : "Add Venue"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Venue Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>County</Label><Input value={form.county} onChange={e => setForm(p => ({ ...p, county: e.target.value }))} /></div>
            </div>
            <div><Label>Address</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} /></div>
              <div><Label>Contact Phone</Label><Input value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} /></div>
            </div>
            <div><Label>Venue Cost per Session (€)</Label><Input type="number" value={form.venue_cost_per_session} onChange={e => setForm(p => ({ ...p, venue_cost_per_session: parseFloat(e.target.value) || 0 }))} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" disabled={!form.name || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : editing ? "Update Venue" : "Add Venue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
