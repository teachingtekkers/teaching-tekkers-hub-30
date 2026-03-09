import { useState } from "react";
import { mockCamps, mockBookings, mockCampCoaches, getCoachesRequired } from "@/data/mock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/StatCard";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, MapPin, Calendar, Tent, Users, UserCog, CheckCircle, AlertTriangle } from "lucide-react";
import { Camp } from "@/types";

const CampsPage = () => {
  const [camps, setCamps] = useState<Camp[]>(mockCamps);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", club_name: "", venue: "", county: "",
    start_date: "", end_date: "", daily_start_time: "10:00", daily_end_time: "15:00",
    age_group: "", capacity: "", price_per_child: "",
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newCamp: Camp = {
      id: String(camps.length + 1), ...form,
      capacity: Number(form.capacity), price_per_child: Number(form.price_per_child),
      created_at: new Date().toISOString().split('T')[0],
    };
    setCamps([...camps, newCamp]);
    setOpen(false);
    setForm({ name: "", club_name: "", venue: "", county: "", start_date: "", end_date: "", daily_start_time: "10:00", daily_end_time: "15:00", age_group: "", capacity: "", price_per_child: "" });
  };

  const getBookingCount = (campId: string) => mockBookings.filter(b => b.camp_id === campId).length;
  const getAssignedCount = (campId: string) => mockCampCoaches.filter(a => a.camp_id === campId).length;

  const getCampStatus = (camp: Camp) => {
    const players = getBookingCount(camp.id);
    const required = getCoachesRequired(players);
    const assigned = getAssignedCount(camp.id);
    const hasHead = mockCampCoaches.filter(a => a.camp_id === camp.id).some(a => a.role === 'head_coach');
    if (assigned >= required && hasHead) return "ready";
    if (assigned >= required) return "review";
    return "action";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="page-header !mb-0">
          <h1>Camps</h1>
          <p>Manage your football camps</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" /> New Camp</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Camp</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Camp Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
                <div className="space-y-1"><Label>Club Name</Label><Input value={form.club_name} onChange={e => setForm({...form, club_name: e.target.value})} required /></div>
                <div className="space-y-1"><Label>Venue</Label><Input value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} required /></div>
                <div className="space-y-1"><Label>County</Label><Input value={form.county} onChange={e => setForm({...form, county: e.target.value})} required /></div>
                <div className="space-y-1"><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required /></div>
                <div className="space-y-1"><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} required /></div>
                <div className="space-y-1"><Label>Start Time</Label><Input type="time" value={form.daily_start_time} onChange={e => setForm({...form, daily_start_time: e.target.value})} /></div>
                <div className="space-y-1"><Label>End Time</Label><Input type="time" value={form.daily_end_time} onChange={e => setForm({...form, daily_end_time: e.target.value})} /></div>
                <div className="space-y-1"><Label>Age Group</Label><Input value={form.age_group} onChange={e => setForm({...form, age_group: e.target.value})} placeholder="e.g. U8-U12" required /></div>
                <div className="space-y-1"><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} required /></div>
                <div className="space-y-1 col-span-2"><Label>Price per Child (€)</Label><Input type="number" value={form.price_per_child} onChange={e => setForm({...form, price_per_child: e.target.value})} required /></div>
              </div>
              <Button type="submit" className="w-full">Create Camp</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="stat-grid">
        <StatCard title="Total Camps" value={camps.length} icon={Tent} />
        <StatCard title="Total Bookings" value={mockBookings.length} icon={Users} />
        <StatCard title="Coaches Active" value={new Set(mockCampCoaches.map(a => a.coach_id)).size} icon={UserCog} />
      </div>

      {/* Mobile Cards */}
      <div className="grid gap-3 sm:hidden">
        {camps.map(camp => {
          const status = getCampStatus(camp);
          return (
            <Card key={camp.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm">{camp.name}</p>
                    <p className="text-xs text-muted-foreground">{camp.club_name}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{camp.age_group}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{camp.venue}, {camp.county}</p>
                  <p className="flex items-center gap-1"><Calendar className="h-3 w-3" />{camp.start_date} — {camp.end_date}</p>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span>{getBookingCount(camp.id)}/{camp.capacity} booked</span>
                  <span className="font-medium">€{camp.price_per_child}</span>
                  {status === "ready" ? (
                    <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] text-[10px]"><CheckCircle className="mr-0.5 h-2.5 w-2.5" />Ready</Badge>
                  ) : (
                    <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] text-[10px]"><AlertTriangle className="mr-0.5 h-2.5 w-2.5" />Review</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop Table */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Camp</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>County</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="text-center">Booked</TableHead>
                <TableHead className="text-center">Coaches</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {camps.map(camp => {
                const status = getCampStatus(camp);
                const players = getBookingCount(camp.id);
                return (
                  <TableRow key={camp.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{camp.name}</p>
                      <p className="text-xs text-muted-foreground">{camp.venue}</p>
                    </TableCell>
                    <TableCell className="text-sm">{camp.club_name}</TableCell>
                    <TableCell className="text-sm">{camp.county}</TableCell>
                    <TableCell className="text-sm">{camp.start_date} — {camp.end_date}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{camp.age_group}</Badge></TableCell>
                    <TableCell className="text-center text-sm">{players}/{camp.capacity}</TableCell>
                    <TableCell className="text-center text-sm">{getAssignedCount(camp.id)}/{getCoachesRequired(players)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">€{camp.price_per_child}</TableCell>
                    <TableCell>
                      {status === "ready" ? (
                        <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] text-xs gap-1"><CheckCircle className="h-3 w-3" />Ready</Badge>
                      ) : status === "review" ? (
                        <Badge className="bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] text-xs gap-1"><AlertTriangle className="h-3 w-3" />Review</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Action</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CampsPage;
