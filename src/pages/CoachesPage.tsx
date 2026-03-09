import { useState } from "react";
import { mockCoaches } from "@/data/mock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Phone, Mail, Car } from "lucide-react";
import { Coach } from "@/types";

const CoachesPage = () => {
  const [coaches, setCoaches] = useState<Coach[]>(mockCoaches);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "",
    can_drive: false, is_head_coach: false, notes: "",
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newCoach: Coach = {
      id: String(coaches.length + 1),
      ...form,
      notes: form.notes || null,
      created_at: new Date().toISOString().split('T')[0],
    };
    setCoaches([...coaches, newCoach]);
    setOpen(false);
    setForm({ full_name: "", phone: "", email: "", can_drive: false, is_head_coach: false, notes: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Coaches</h1>
          <p className="text-muted-foreground">Manage your coaching team</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Coach</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Coach</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <Label>Full Name</Label>
                <Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Can Drive</Label>
                <Switch checked={form.can_drive} onCheckedChange={v => setForm({...form, can_drive: v})} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Head Coach</Label>
                <Switch checked={form.is_head_coach} onCheckedChange={v => setForm({...form, is_head_coach: v})} />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
              </div>
              <Button type="submit" className="w-full">Add Coach</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile */}
      <div className="grid gap-4 sm:hidden">
        {coaches.map(coach => (
          <Card key={coach.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <p className="font-semibold">{coach.full_name}</p>
                <div className="flex gap-1">
                  {coach.is_head_coach && <Badge>Head Coach</Badge>}
                  {coach.can_drive && <Badge variant="secondary"><Car className="h-3 w-3" /></Badge>}
                </div>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-1"><Phone className="h-3 w-3" />{coach.phone}</p>
                <p className="flex items-center gap-1"><Mail className="h-3 w-3" />{coach.email}</p>
              </div>
              {coach.notes && <p className="text-sm">{coach.notes}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Drive</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coaches.map(coach => (
                <TableRow key={coach.id}>
                  <TableCell className="font-medium">{coach.full_name}</TableCell>
                  <TableCell>{coach.phone}</TableCell>
                  <TableCell>{coach.email}</TableCell>
                  <TableCell>{coach.can_drive ? '✓' : '✗'}</TableCell>
                  <TableCell>{coach.is_head_coach ? <Badge>Head Coach</Badge> : <Badge variant="secondary">Coach</Badge>}</TableCell>
                  <TableCell className="max-w-48 text-sm text-muted-foreground">{coach.notes || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoachesPage;
