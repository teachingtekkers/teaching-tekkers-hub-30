import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { Plus, MapPin, Calendar, Tent, Users, CheckCircle, AlertTriangle } from "lucide-react";

interface CampRow {
  id: string;
  name: string;
  club_name: string;
  venue: string;
  county: string;
  start_date: string;
  end_date: string;
  age_group: string;
  capacity: number;
  price_per_child: number;
  participant_count?: number;
}

const CampsPage = () => {
  const navigate = useNavigate();
  const [camps, setCamps] = useState<CampRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", club_name: "", venue: "", county: "",
    start_date: "", end_date: "", daily_start_time: "10:00", daily_end_time: "15:00",
    age_group: "", capacity: "", price_per_child: "",
  });

  const loadCamps = useCallback(async () => {
    setLoading(true);
    const { data: campsData } = await supabase
      .from("camps")
      .select("id, name, club_name, venue, county, start_date, end_date, age_group, capacity, price_per_child")
      .order("start_date", { ascending: false });

    if (campsData) {
      // Count synced participants per camp
      const { data: counts } = await supabase
        .from("synced_bookings")
        .select("matched_camp_id");

      const countMap: Record<string, number> = {};
      (counts || []).forEach((r: { matched_camp_id: string | null }) => {
        if (r.matched_camp_id) countMap[r.matched_camp_id] = (countMap[r.matched_camp_id] || 0) + 1;
      });

      setCamps(campsData.map(c => ({ ...c, participant_count: countMap[c.id] || 0 })) as CampRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadCamps(); }, [loadCamps]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("camps").insert({
      name: form.name, club_name: form.club_name, venue: form.venue, county: form.county,
      start_date: form.start_date, end_date: form.end_date,
      daily_start_time: form.daily_start_time, daily_end_time: form.daily_end_time,
      age_group: form.age_group, capacity: Number(form.capacity), price_per_child: Number(form.price_per_child),
    });
    if (!error) {
      setOpen(false);
      setForm({ name: "", club_name: "", venue: "", county: "", start_date: "", end_date: "", daily_start_time: "10:00", daily_end_time: "15:00", age_group: "", capacity: "", price_per_child: "" });
      loadCamps();
    }
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
        <StatCard title="Total Participants" value={camps.reduce((s, c) => s + (c.participant_count || 0), 0)} icon={Users} />
      </div>

      {/* Mobile Cards */}
      <div className="grid gap-3 sm:hidden">
        {camps.map(camp => (
          <Card key={camp.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate(`/camps/${camp.id}`)}>
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
                <span>{camp.participant_count || 0}/{camp.capacity} participants</span>
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
                <TableHead>County</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="text-center">Participants</TableHead>
                <TableHead className="text-right">Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : camps.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No camps yet</TableCell></TableRow>
              ) : camps.map(camp => (
                <TableRow key={camp.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/camps/${camp.id}`)}>
                  <TableCell>
                    <p className="font-medium text-sm">{camp.name}</p>
                    <p className="text-xs text-muted-foreground">{camp.venue}</p>
                  </TableCell>
                  <TableCell className="text-sm">{camp.club_name}</TableCell>
                  <TableCell className="text-sm">{camp.county}</TableCell>
                  <TableCell className="text-sm">{camp.start_date} — {camp.end_date}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{camp.age_group}</Badge></TableCell>
                  <TableCell className="text-center text-sm">{camp.participant_count || 0}/{camp.capacity}</TableCell>
                  <TableCell className="text-right text-sm font-medium">€{camp.price_per_child}</TableCell>
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
