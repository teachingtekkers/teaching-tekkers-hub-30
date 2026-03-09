import { useState } from "react";
import { mockCoaches } from "@/data/mock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/StatCard";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Phone, Mail, Car, UserCog, Fuel, Shield } from "lucide-react";
import { Coach } from "@/types";

const CoachesPage = () => {
  const [coaches, setCoaches] = useState<Coach[]>(mockCoaches);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "",
    can_drive: false, is_head_coach: false, notes: "",
    daily_rate: 100, head_coach_daily_rate: 0, fuel_allowance_eligible: false,
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newCoach: Coach = {
      id: String(coaches.length + 1), ...form,
      notes: form.notes || null,
      created_at: new Date().toISOString().split('T')[0],
    };
    setCoaches([...coaches, newCoach]);
    setOpen(false);
    setForm({ full_name: "", phone: "", email: "", can_drive: false, is_head_coach: false, notes: "", daily_rate: 100, head_coach_daily_rate: 0, fuel_allowance_eligible: false });
  };

  const headCoachCount = coaches.filter(c => c.is_head_coach).length;
  const driverCount = coaches.filter(c => c.can_drive).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="page-header !mb-0">
          <h1>Coaches</h1>
          <p>Manage your coaching team</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Coach</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Coach</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1"><Label>Full Name</Label><Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required /></div>
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
              </div>
              <div className="flex items-center justify-between"><Label>Can Drive</Label><Switch checked={form.can_drive} onCheckedChange={v => setForm({...form, can_drive: v})} /></div>
              <div className="flex items-center justify-between"><Label>Head Coach</Label><Switch checked={form.is_head_coach} onCheckedChange={v => setForm({...form, is_head_coach: v})} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Daily Rate (€)</Label><Input type="number" value={form.daily_rate} onChange={e => setForm({...form, daily_rate: Number(e.target.value)})} required /></div>
                <div className="space-y-1"><Label>HC Rate (€)</Label><Input type="number" value={form.head_coach_daily_rate} onChange={e => setForm({...form, head_coach_daily_rate: Number(e.target.value)})} /></div>
              </div>
              <div className="flex items-center justify-between"><Label>Fuel Allowance</Label><Switch checked={form.fuel_allowance_eligible} onCheckedChange={v => setForm({...form, fuel_allowance_eligible: v})} /></div>
              <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <Button type="submit" className="w-full">Add Coach</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="stat-grid">
        <StatCard title="Total Coaches" value={coaches.length} icon={UserCog} />
        <StatCard title="Head Coaches" value={headCoachCount} icon={Shield} />
        <StatCard title="Drivers" value={driverCount} icon={Car} />
        <StatCard title="Fuel Eligible" value={coaches.filter(c => c.fuel_allowance_eligible).length} icon={Fuel} />
      </div>

      {/* Mobile */}
      <div className="grid gap-3 sm:hidden">
        {coaches.map(coach => (
          <Card key={coach.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-accent-foreground">
                    {coach.full_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <p className="font-semibold text-sm">{coach.full_name}</p>
                </div>
                <div className="flex gap-1">
                  {coach.is_head_coach && <Badge className="text-[10px] px-1.5 py-0">HC</Badge>}
                  {coach.can_drive && <Badge variant="secondary" className="text-[10px] px-1.5 py-0"><Car className="h-2.5 w-2.5" /></Badge>}
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{coach.phone}</p>
                <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{coach.email}</p>
                <p>€{coach.daily_rate}/day {coach.fuel_allowance_eligible ? "• ⛽ Fuel" : ""}</p>
              </div>
              {coach.notes && <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">{coach.notes}</p>}
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
                <TableHead>Coach</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Driver</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-center">Fuel</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coaches.map(coach => (
                <TableRow key={coach.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-[10px] font-semibold text-accent-foreground shrink-0">
                        {coach.full_name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-medium text-sm">{coach.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{coach.phone}</TableCell>
                  <TableCell className="text-sm">{coach.email}</TableCell>
                  <TableCell className="text-center">
                    {coach.can_drive ? (
                      <Badge variant="secondary" className="text-[10px]"><Car className="h-3 w-3" /></Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {coach.is_head_coach ? (
                      <Badge className="text-xs">Head Coach</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Coach</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    €{coach.daily_rate}
                    {coach.is_head_coach && <span className="text-muted-foreground"> / €{coach.head_coach_daily_rate}</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {coach.fuel_allowance_eligible ? (
                      <Badge variant="secondary" className="text-[10px]"><Fuel className="h-3 w-3" /></Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-48 text-xs text-muted-foreground">{coach.notes || '—'}</TableCell>
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
