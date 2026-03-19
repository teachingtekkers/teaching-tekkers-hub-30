import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Calculator, Plus, Pencil, Trash2, Trophy, Medal, TrendingUp,
  DollarSign, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

/* ── constants ── */
const WEEKS = Array.from({ length: 8 }, (_, i) => `Week ${i + 1}`);
const STATUSES = ["draft", "reviewed", "approved"] as const;
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", reviewed: "Reviewed", approved: "Approved",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  reviewed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

/* ── types ── */
interface BonusRow {
  id: string;
  coach_id: string;
  camp_id: string;
  week_label: string;
  club_feedback_points: number;
  parent_feedback_points: number;
  admin_adjustment: number;
  total_points: number;
  notes: string | null;
  status: string;
  approved_bonus_amount: number;
  payroll_linked: boolean;
  created_at: string;
}
interface CoachOption { id: string; full_name: string; }
interface CampOption { id: string; name: string; }

const emptyForm = {
  coach_id: "", camp_id: "", week_label: "Week 1",
  club_feedback_points: 0, parent_feedback_points: 0, admin_adjustment: 0,
  notes: "", status: "draft", approved_bonus_amount: 0,
};

export default function BonusCalculatorPage() {
  const [records, setRecords] = useState<BonusRow[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [camps, setCamps] = useState<CampOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterWeek, setFilterWeek] = useState<string>("all");

  /* ── data fetching ── */
  const fetchRecords = async () => {
    const { data } = await supabase
      .from("bonus_records")
      .select("*")
      .order("week_label", { ascending: true });
    setRecords((data || []) as unknown as BonusRow[]);
  };

  useEffect(() => {
    (async () => {
      const [, coachesRes, campsRes] = await Promise.all([
        fetchRecords(),
        supabase.from("coaches").select("id, full_name").order("full_name"),
        supabase.from("camps").select("id, name").order("name"),
      ]);
      setCoaches((coachesRes.data || []) as CoachOption[]);
      setCamps((campsRes.data || []) as CampOption[]);
      setLoading(false);
    })();
  }, []);

  /* ── helpers ── */
  const coachMap = useMemo(() => new Map(coaches.map(c => [c.id, c.full_name])), [coaches]);
  const campMap = useMemo(() => new Map(camps.map(c => [c.id, c.name])), [camps]);

  const filtered = useMemo(() => {
    if (filterWeek === "all") return records;
    return records.filter(r => r.week_label === filterWeek);
  }, [records, filterWeek]);

  /* ── leaderboard ── */
  const leaderboard = useMemo(() => {
    const map = new Map<string, { total: number; camps: Set<string>; count: number }>();
    records.forEach(r => {
      const entry = map.get(r.coach_id) || { total: 0, camps: new Set<string>(), count: 0 };
      entry.total += r.total_points;
      entry.camps.add(r.camp_id);
      entry.count += 1;
      map.set(r.coach_id, entry);
    });
    return [...map.entries()]
      .map(([coachId, d]) => ({
        coachId, coachName: coachMap.get(coachId) || "Unknown",
        totalPoints: d.total, campsScored: d.camps.size,
        avgPoints: d.count > 0 ? Math.round(d.total / d.count) : 0,
        entries: d.count,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [records, coachMap]);

  /* ── weekly top coach ── */
  const weeklyTop = useMemo(() => {
    const week = filterWeek === "all" ? null : filterWeek;
    const subset = week ? records.filter(r => r.week_label === week) : records;
    const map = new Map<string, number>();
    subset.forEach(r => map.set(r.coach_id, (map.get(r.coach_id) || 0) + r.total_points));
    let topId = "";
    let topPts = -Infinity;
    map.forEach((pts, id) => { if (pts > topPts) { topPts = pts; topId = id; } });
    return topId ? { coachId: topId, name: coachMap.get(topId) || "Unknown", points: topPts } : null;
  }, [records, filterWeek, coachMap]);

  /* ── dialog open/close ── */
  const openNew = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(true); };
  const openEdit = (r: BonusRow) => {
    setForm({
      coach_id: r.coach_id, camp_id: r.camp_id, week_label: r.week_label,
      club_feedback_points: r.club_feedback_points,
      parent_feedback_points: r.parent_feedback_points,
      admin_adjustment: r.admin_adjustment, notes: r.notes || "",
      status: r.status, approved_bonus_amount: r.approved_bonus_amount,
    });
    setEditingId(r.id);
    setDialogOpen(true);
  };

  /* ── save ── */
  const handleSave = async () => {
    if (!form.coach_id || !form.camp_id) {
      toast.error("Staff member and camp are required");
      return;
    }
    const payload = {
      coach_id: form.coach_id,
      camp_id: form.camp_id,
      week_label: form.week_label,
      club_feedback_points: Number(form.club_feedback_points) || 0,
      parent_feedback_points: Number(form.parent_feedback_points) || 0,
      admin_adjustment: Number(form.admin_adjustment) || 0,
      notes: form.notes || null,
      status: form.status as "draft" | "reviewed" | "approved",
      approved_bonus_amount: Number(form.approved_bonus_amount) || 0,
      updated_at: new Date().toISOString(),
    };
    if (editingId) {
      const { error } = await supabase.from("bonus_records").update(payload).eq("id", editingId);
      if (error) { toast.error("Failed to update: " + error.message); return; }
      toast.success("Bonus record updated");
    } else {
      const { error } = await supabase.from("bonus_records").insert([payload]);
      if (error) { toast.error("Failed to create: " + error.message); return; }
      toast.success("Bonus record created");
    }
    setDialogOpen(false);
    fetchRecords();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("bonus_records").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Record deleted");
    fetchRecords();
  };

  /* ── summary stats ── */
  const totalApproved = useMemo(
    () => records.filter(r => r.status === "approved").reduce((s, r) => s + r.approved_bonus_amount, 0),
    [records],
  );
  const totalRecords = records.length;
  const approvedCount = records.filter(r => r.status === "approved").length;

  const formTotal = Number(form.club_feedback_points || 0) + Number(form.parent_feedback_points || 0) + Number(form.admin_adjustment || 0);

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bonus Calculator</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track staff bonus points across the 8-week camp block
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> New Bonus Record
        </Button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalRecords}</p>
                <p className="text-xs text-muted-foreground">Total Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{approvedCount}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">€{totalApproved.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Approved Bonus Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {weeklyTop && (
          <Card className="border-primary/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-400/20">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <Link to={`/coaches/${weeklyTop.coachId}`} className="text-sm font-bold text-primary hover:underline">
                    {weeklyTop.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {filterWeek === "all" ? "Overall" : filterWeek} Top · {weeklyTop.points} pts
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs: Records / Leaderboard / End-of-Block */}
      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">Bonus Records</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="block-summary">End-of-Block</TabsTrigger>
        </TabsList>

        {/* ── Tab: Records ── */}
        <TabsContent value="records" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={filterWeek} onValueChange={setFilterWeek}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Week" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Weeks</SelectItem>
                {WEEKS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Camp</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead className="text-center">Club</TableHead>
                    <TableHead className="text-center">Parent</TableHead>
                    <TableHead className="text-center">Adj</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bonus €</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-12">
                        No bonus records found. Create one to get started.
                      </TableCell>
                    </TableRow>
                  ) : filtered.map(r => (
                    <TableRow key={r.id} className="cursor-pointer group" onClick={() => openEdit(r)}>
                      <TableCell>
                        <Link to={`/coaches/${r.coach_id}`} onClick={e => e.stopPropagation()} className="text-sm font-medium text-primary hover:underline">
                          {coachMap.get(r.coach_id) || "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link to={`/camps/${r.camp_id}`} onClick={e => e.stopPropagation()} className="text-sm text-primary hover:underline">
                          {campMap.get(r.camp_id) || "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{r.week_label}</TableCell>
                      <TableCell className="text-center text-sm">{r.club_feedback_points}</TableCell>
                      <TableCell className="text-center text-sm">{r.parent_feedback_points}</TableCell>
                      <TableCell className="text-center text-sm">{r.admin_adjustment}</TableCell>
                      <TableCell className="text-center font-semibold text-sm">{r.total_points}</TableCell>
                      <TableCell>
                        <Badge className={`${STATUS_COLORS[r.status]} text-[10px] border-0`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {r.approved_bonus_amount > 0 ? `€${r.approved_bonus_amount}` : "—"}
                        {r.payroll_linked && (
                          <span className="ml-1 text-[10px] text-emerald-600" title="Linked to payroll">✓</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(r); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); handleDelete(r.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Leaderboard ── */}
        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" /> Running League Table
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] text-center">Rank</TableHead>
                    <TableHead>Staff Member</TableHead>
                    <TableHead className="text-center">Total Pts</TableHead>
                    <TableHead className="text-center">Camps Scored</TableHead>
                    <TableHead className="text-center">Entries</TableHead>
                    <TableHead className="text-center">Avg Pts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                        No data yet.
                      </TableCell>
                    </TableRow>
                  ) : leaderboard.map(e => (
                    <TableRow key={e.coachId}>
                      <TableCell className="text-center font-bold">
                        {e.rank === 1 ? <Medal className="h-5 w-5 text-yellow-500 mx-auto" /> :
                         e.rank === 2 ? <Medal className="h-5 w-5 text-gray-400 mx-auto" /> :
                         e.rank === 3 ? <Medal className="h-5 w-5 text-amber-700 mx-auto" /> :
                         e.rank}
                      </TableCell>
                      <TableCell>
                        <Link to={`/coaches/${e.coachId}`} className="text-sm font-medium text-primary hover:underline">
                          {e.coachName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center font-semibold">{e.totalPoints}</TableCell>
                      <TableCell className="text-center text-sm">{e.campsScored}</TableCell>
                      <TableCell className="text-center text-sm">{e.entries}</TableCell>
                      <TableCell className="text-center text-sm">{e.avgPoints}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: End-of-Block ── */}
        <TabsContent value="block-summary">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-yellow-500" /> End-of-Block Bonus Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px] text-center">Rank</TableHead>
                    <TableHead>Staff Member</TableHead>
                    <TableHead className="text-center">Total Pts</TableHead>
                    <TableHead className="text-center">Camps</TableHead>
                    <TableHead className="text-right">Approved Bonus €</TableHead>
                    <TableHead className="text-center">Payroll Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                        No data yet.
                      </TableCell>
                    </TableRow>
                  ) : leaderboard.map(e => {
                    const coachRecords = records.filter(r => r.coach_id === e.coachId);
                    const approvedTotal = coachRecords
                      .filter(r => r.status === "approved")
                      .reduce((s, r) => s + r.approved_bonus_amount, 0);
                    const allApproved = coachRecords.length > 0 && coachRecords.every(r => r.status === "approved");
                    const anyLinked = coachRecords.some(r => r.payroll_linked);
                    return (
                      <TableRow key={e.coachId}>
                        <TableCell className="text-center font-bold">{e.rank}</TableCell>
                        <TableCell>
                          <Link to={`/coaches/${e.coachId}`} className="text-sm font-medium text-primary hover:underline">
                            {e.coachName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{e.totalPoints}</TableCell>
                        <TableCell className="text-center text-sm">{e.campsScored}</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {approvedTotal > 0 ? `€${approvedTotal}` : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {anyLinked ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px] border-0">
                              Linked
                            </Badge>
                          ) : allApproved ? (
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-[10px] border-0">
                              Ready
                            </Badge>
                          ) : (
                            <Badge className="bg-muted text-muted-foreground text-[10px] border-0">
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Bonus Record" : "New Bonus Record"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Staff */}
            <div>
              <Label>Staff Member *</Label>
              <Select value={form.coach_id || "none"} onValueChange={v => setForm(f => ({ ...f, coach_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select staff…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select staff…</SelectItem>
                  {coaches.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Camp */}
            <div>
              <Label>Camp *</Label>
              <Select value={form.camp_id || "none"} onValueChange={v => setForm(f => ({ ...f, camp_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Select camp…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select camp…</SelectItem>
                  {camps.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {/* Week + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Week</Label>
                <Select value={form.week_label} onValueChange={v => setForm(f => ({ ...f, week_label: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Points */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Club Feedback</Label>
                <Input type="number" value={form.club_feedback_points} onChange={e => setForm(f => ({ ...f, club_feedback_points: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Parent Feedback</Label>
                <Input type="number" value={form.parent_feedback_points} onChange={e => setForm(f => ({ ...f, parent_feedback_points: Number(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Admin Adj</Label>
                <Input type="number" value={form.admin_adjustment} onChange={e => setForm(f => ({ ...f, admin_adjustment: Number(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <span className="text-muted-foreground">Calculated Total:</span>{" "}
              <span className="font-semibold text-foreground">{formTotal} pts</span>
            </div>
            {/* Approved bonus */}
            <div>
              <Label>Approved Bonus Amount (€)</Label>
              <Input type="number" min={0} step={5} value={form.approved_bonus_amount} onChange={e => setForm(f => ({ ...f, approved_bonus_amount: Number(e.target.value) || 0 }))} placeholder="0" />
              <p className="text-[11px] text-muted-foreground mt-1">Set once approved — can be pulled into Staff Payroll later.</p>
            </div>
            {/* Notes */}
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes…" rows={2} />
            </div>
            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editingId ? "Save Changes" : "Create Record"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
