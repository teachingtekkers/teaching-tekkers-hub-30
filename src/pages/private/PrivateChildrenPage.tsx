import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

interface Child {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  medical_notes: string;
  notes: string;
  status: string;
}

const emptyChild = {
  first_name: "", last_name: "", date_of_birth: "",
  parent_name: "", parent_phone: "", parent_email: "",
  medical_notes: "", notes: "", status: "active",
};

export default function PrivateChildrenPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [form, setForm] = useState(emptyChild);
  const [search, setSearch] = useState("");

  const { data: children = [], isLoading } = useQuery({
    queryKey: ["private-children"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("private_children")
        .select("*")
        .order("last_name");
      if (error) throw error;
      return data as Child[];
    },
  });

  const filtered = children.filter(c => {
    const q = search.toLowerCase();
    return !q || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)
      || c.parent_name.toLowerCase().includes(q);
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        first_name: form.first_name, last_name: form.last_name,
        date_of_birth: form.date_of_birth || null,
        parent_name: form.parent_name, parent_phone: form.parent_phone,
        parent_email: form.parent_email, medical_notes: form.medical_notes,
        notes: form.notes, status: form.status,
      };
      if (editing) {
        const { error } = await supabase.from("private_children").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("private_children").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-children"] });
      toast.success(editing ? "Child updated" : "Child added");
      setOpen(false); setEditing(null); setForm(emptyChild);
    },
    onError: () => toast.error("Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("private_children").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["private-children"] });
      toast.success("Child removed");
    },
  });

  const openEdit = (c: Child) => {
    setEditing(c);
    setForm({
      first_name: c.first_name, last_name: c.last_name,
      date_of_birth: c.date_of_birth || "", parent_name: c.parent_name,
      parent_phone: c.parent_phone, parent_email: c.parent_email,
      medical_notes: c.medical_notes, notes: c.notes, status: c.status,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Children</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage private coaching children</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyChild); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Add Child
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search children or parents…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Child</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Medical</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {children.length === 0 ? "No children yet. Add your first child." : "No results found."}
                </TableCell></TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.first_name} {c.last_name}</TableCell>
                  <TableCell>{c.parent_name || "—"}</TableCell>
                  <TableCell>
                    {c.parent_phone ? <a href={`tel:${c.parent_phone}`} className="text-primary hover:underline text-sm">{c.parent_phone}</a> : "—"}
                  </TableCell>
                  <TableCell>
                    {c.medical_notes ? <Badge variant="destructive" className="text-xs">Medical</Badge> : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (confirm("Remove this child?")) deleteMutation.mutate(c.id);
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
          <DialogHeader><DialogTitle>{editing ? "Edit Child" : "Add Child"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>First Name *</Label><Input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} /></div>
              <div><Label>Last Name *</Label><Input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} /></div>
            </div>
            <div><Label>Date of Birth</Label><Input type="date" value={form.date_of_birth} onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Parent Name</Label><Input value={form.parent_name} onChange={e => setForm(p => ({ ...p, parent_name: e.target.value }))} /></div>
              <div><Label>Parent Phone</Label><Input value={form.parent_phone} onChange={e => setForm(p => ({ ...p, parent_phone: e.target.value }))} /></div>
            </div>
            <div><Label>Parent Email</Label><Input value={form.parent_email} onChange={e => setForm(p => ({ ...p, parent_email: e.target.value }))} /></div>
            <div><Label>Medical Notes</Label><Textarea value={form.medical_notes} onChange={e => setForm(p => ({ ...p, medical_notes: e.target.value }))} rows={2} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" disabled={!form.first_name || !form.last_name || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving…" : editing ? "Update Child" : "Add Child"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
