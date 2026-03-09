import { useState } from "react";
import { mockCamps, mockBookings } from "@/data/mock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, MapPin, Calendar } from "lucide-react";
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
      id: String(camps.length + 1),
      ...form,
      capacity: Number(form.capacity),
      price_per_child: Number(form.price_per_child),
      created_at: new Date().toISOString().split('T')[0],
    };
    setCamps([...camps, newCamp]);
    setOpen(false);
    setForm({ name: "", club_name: "", venue: "", county: "", start_date: "", end_date: "", daily_start_time: "10:00", daily_end_time: "15:00", age_group: "", capacity: "", price_per_child: "" });
  };

  const getBookingCount = (campId: string) => mockBookings.filter(b => b.camp_id === campId).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Camps</h1>
          <p className="text-muted-foreground">Manage your football camps</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New Camp</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Camp</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Camp Name</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <Label>Club Name</Label>
                  <Input value={form.club_name} onChange={e => setForm({...form, club_name: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <Label>Venue</Label>
                  <Input value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <Label>County</Label>
                  <Input value={form.county} onChange={e => setForm({...form, county: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <Label>End Date</Label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <Label>Start Time</Label>
                  <Input type="time" value={form.daily_start_time} onChange={e => setForm({...form, daily_start_time: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>End Time</Label>
                  <Input type="time" value={form.daily_end_time} onChange={e => setForm({...form, daily_end_time: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <Label>Age Group</Label>
                  <Input value={form.age_group} onChange={e => setForm({...form, age_group: e.target.value})} placeholder="e.g. U8-U12" required />
                </div>
                <div className="space-y-1">
                  <Label>Capacity</Label>
                  <Input type="number" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} required />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>Price per Child (€)</Label>
                  <Input type="number" value={form.price_per_child} onChange={e => setForm({...form, price_per_child: e.target.value})} required />
                </div>
              </div>
              <Button type="submit" className="w-full">Create Camp</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Mobile Cards */}
      <div className="grid gap-4 sm:hidden">
        {camps.map(camp => (
          <Card key={camp.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{camp.name}</p>
                  <p className="text-sm text-muted-foreground">{camp.club_name}</p>
                </div>
                <Badge variant="secondary">{camp.age_group}</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{camp.venue}, {camp.county}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{camp.start_date} — {camp.end_date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{getBookingCount(camp.id)}/{camp.capacity} booked</span>
                <span className="font-medium">€{camp.price_per_child}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Camp</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Booked</TableHead>
                <TableHead>Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {camps.map(camp => (
                <TableRow key={camp.id}>
                  <TableCell className="font-medium">{camp.name}</TableCell>
                  <TableCell>{camp.club_name}</TableCell>
                  <TableCell>{camp.venue}, {camp.county}</TableCell>
                  <TableCell>{camp.start_date} — {camp.end_date}</TableCell>
                  <TableCell><Badge variant="secondary">{camp.age_group}</Badge></TableCell>
                  <TableCell>{getBookingCount(camp.id)}/{camp.capacity}</TableCell>
                  <TableCell>€{camp.price_per_child}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CampsPage;
