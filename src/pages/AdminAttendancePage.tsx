import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle, XCircle, Calendar, BarChart3, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AttendanceParticipantRow, { type ParticipantData } from "@/components/attendance/AttendanceParticipantRow";
import AttendanceSortControl, { type SortField } from "@/components/attendance/AttendanceSortControl";

interface CampOption { id: string; name: string; club_name: string; start_date: string; end_date: string; }
interface AttendanceRow { id?: string; synced_booking_id: string; status: "present" | "absent"; note: string | null; }

export default function AdminAttendancePage() {
  const [camps, setCamps] = useState<CampOption[]>([]);
  const [selectedCamp, setSelectedCamp] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRow>>(new Map());
  const [allAttendance, setAllAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sortField, setSortField] = useState<SortField>("last_name");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, Record<string, any>>>(new Map());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("camps")
        .select("id, name, club_name, start_date, end_date")
        .order("start_date", { ascending: false });
      setCamps((data as CampOption[]) || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (camps.length > 0 && !selectedCamp) setSelectedCamp(camps[0].id);
  }, [camps, selectedCamp]);

  const loadDayData = useCallback(async () => {
    if (!selectedCamp) return;
    const [pRes, aRes] = await Promise.all([
      supabase.from("synced_bookings")
        .select("id, child_first_name, child_last_name, age, date_of_birth, kit_size, medical_condition, medical_notes, photo_permission, payment_status, amount_paid, amount_owed, total_amount, sibling_discount, refund_amount, payment_type, staff_notes, parent_name, parent_email, parent_phone, emergency_contact, alternate_phone, booking_date")
        .eq("matched_camp_id", selectedCamp)
        .order("child_last_name"),
      supabase.from("attendance")
        .select("id, synced_booking_id, status, note")
        .eq("camp_id", selectedCamp)
        .eq("date", selectedDate),
    ]);
    setParticipants((pRes.data as ParticipantData[]) || []);
    const map = new Map<string, AttendanceRow>();
    for (const r of (aRes.data || []) as any[]) {
      if (r.synced_booking_id) map.set(r.synced_booking_id, { id: r.id, synced_booking_id: r.synced_booking_id, status: r.status, note: r.note });
    }
    setAttendance(map);
    setDirty(false);
    setPendingUpdates(new Map());
  }, [selectedCamp, selectedDate]);

  const loadSummary = useCallback(async () => {
    if (!selectedCamp) return;
    const { data } = await supabase.from("attendance")
      .select("date, status, synced_booking_id")
      .eq("camp_id", selectedCamp)
      .order("date");
    setAllAttendance(data || []);
  }, [selectedCamp]);

  useEffect(() => { loadDayData(); loadSummary(); }, [loadDayData, loadSummary]);

  const toggleStatus = (pid: string) => {
    setAttendance((prev) => {
      const next = new Map(prev);
      const ex = next.get(pid);
      next.set(pid, ex
        ? { ...ex, status: ex.status === "present" ? "absent" : "present" }
        : { synced_booking_id: pid, status: "present", note: null });
      return next;
    });
    setDirty(true);
  };

  const handleFieldUpdate = (id: string, field: string, value: any) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
    setPendingUpdates((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) || {};
      next.set(id, { ...existing, [field]: value });
      return next;
    });
    setDirty(true);
  };

  const handlePaymentUpdate = useCallback(async (bookingId: string, updates: Record<string, any>) => {
    // Update local state immediately
    setParticipants((prev) =>
      prev.map((p) => (p.id === bookingId ? { ...p, ...updates } : p))
    );

    // Persist to synced_bookings immediately
    const { error } = await supabase
      .from("synced_bookings")
      .update(updates)
      .eq("id", bookingId);

    if (error) {
      toast.error("Failed to save payment update");
    } else {
      toast.success("Payment updated");
    }
  }, []);

  const saveAttendance = async () => {
    if (!selectedCamp) return;
    setSaving(true);

    // Save attendance records
    const upserts: any[] = []; const inserts: any[] = [];
    for (const p of participants) {
      const row = attendance.get(p.id);
      const status = row?.status || "absent";
      if (row?.id) upserts.push({ id: row.id, camp_id: selectedCamp, synced_booking_id: p.id, date: selectedDate, status, note: row.note });
      else inserts.push({ camp_id: selectedCamp, synced_booking_id: p.id, date: selectedDate, status, note: row?.note || null });
    }

    let err = false;
    if (upserts.length > 0) { const { error } = await supabase.from("attendance").upsert(upserts); if (error) err = true; }
    if (inserts.length > 0) { const { error } = await supabase.from("attendance").insert(inserts); if (error) err = true; }

    // Save pending participant field updates to synced_bookings
    for (const [id, fields] of pendingUpdates.entries()) {
      const { error } = await supabase.from("synced_bookings").update(fields).eq("id", id);
      if (error) { console.error("Update error for", id, error); err = true; }
    }

    setSaving(false);
    if (err) toast.error("Failed to save"); else { toast.success("Saved successfully"); setDirty(false); setPendingUpdates(new Map()); loadDayData(); loadSummary(); }
  };

  const getStatus = (id: string): "present" | "absent" => attendance.get(id)?.status || "absent";
  const presentCount = participants.filter((p) => getStatus(p.id) === "present").length;

  const sorted = [...participants].sort((a, b) => {
    if (sortField === "first_name") return a.child_first_name.localeCompare(b.child_first_name);
    if (sortField === "age") return (a.age ?? 99) - (b.age ?? 99);
    return a.child_last_name.localeCompare(b.child_last_name);
  });

  const dateSummary = (() => {
    const map = new Map<string, { present: number; absent: number }>();
    for (const r of allAttendance) {
      const d = r.date;
      if (!map.has(d)) map.set(d, { present: 0, absent: 0 });
      const s = map.get(d)!;
      if (r.status === "present") s.present++; else s.absent++;
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  })();

  const participantSummary = (() => {
    const map = new Map<string, { present: number; absent: number }>();
    for (const r of allAttendance) {
      const id = r.synced_booking_id;
      if (!id) continue;
      if (!map.has(id)) map.set(id, { present: 0, absent: 0 });
      const s = map.get(id)!;
      if (r.status === "present") s.present++; else s.absent++;
    }
    return participants.map((p) => ({ ...p, ...(map.get(p.id) || { present: 0, absent: 0 }) }));
  })();

  const camp = camps.find((c) => c.id === selectedCamp);
  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground">View and manage daily attendance across all camps</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Camp</Label>
              <Select value={selectedCamp} onValueChange={(v) => { setSelectedCamp(v); setDirty(false); }}>
                <SelectTrigger><SelectValue placeholder="Select camp" /></SelectTrigger>
                <SelectContent>
                  {camps.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} — {c.club_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setDirty(false); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {camp && (
        <Tabs defaultValue="mark">
          <TabsList>
            <TabsTrigger value="mark" className="gap-1.5"><CheckCircle className="h-3.5 w-3.5" />Mark</TabsTrigger>
            <TabsTrigger value="by-date" className="gap-1.5"><Calendar className="h-3.5 w-3.5" />By Date</TabsTrigger>
            <TabsTrigger value="by-child" className="gap-1.5"><Users className="h-3.5 w-3.5" />By Child</TabsTrigger>
          </TabsList>

          <TabsContent value="mark" className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={presentCount === participants.length && participants.length > 0 ? "default" : "secondary"} className="gap-1 text-xs">
                  <CheckCircle className="h-3 w-3" />{presentCount}/{participants.length}
                </Badge>
                <AttendanceSortControl value={sortField} onChange={setSortField} />
              </div>
              <Button size="sm" onClick={saveAttendance} disabled={!dirty || saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Save
              </Button>
            </div>
            {participants.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No participants for this camp.</CardContent></Card>
            ) : (
              <div className="space-y-1">
                {sorted.map((p) => (
                  <AttendanceParticipantRow
                    key={p.id}
                    participant={p}
                    isPresent={getStatus(p.id) === "present"}
                    onToggle={() => toggleStatus(p.id)}
                    isAdmin={true}
                    onFieldUpdate={handleFieldUpdate}
                    onPaymentUpdate={handlePaymentUpdate}
                    expandedId={expandedId}
                    onExpand={setExpandedId}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="by-date" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" />Daily Summary</CardTitle></CardHeader>
              <CardContent className="p-0">
                {dateSummary.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No attendance recorded yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-center">Present</TableHead>
                        <TableHead className="text-center">Absent</TableHead>
                        <TableHead className="text-center">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dateSummary.map(([date, s]) => (
                        <TableRow key={date}>
                          <TableCell className="font-medium">{date}</TableCell>
                          <TableCell className="text-center"><Badge variant="default" className="text-xs gap-1"><CheckCircle className="h-3 w-3" />{s.present}</Badge></TableCell>
                          <TableCell className="text-center"><Badge variant="secondary" className="text-xs gap-1"><XCircle className="h-3 w-3" />{s.absent}</Badge></TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{s.present + s.absent > 0 ? Math.round((s.present / (s.present + s.absent)) * 100) : 0}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-child" className="mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Participant Summary</CardTitle></CardHeader>
              <CardContent className="p-0">
                {participantSummary.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No participants.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Child</TableHead>
                        <TableHead className="text-center">Present</TableHead>
                        <TableHead className="text-center">Absent</TableHead>
                        <TableHead className="text-center">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {participantSummary.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.child_first_name} {p.child_last_name}</TableCell>
                          <TableCell className="text-center">{p.present}</TableCell>
                          <TableCell className="text-center">{p.absent}</TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">{p.present + p.absent > 0 ? Math.round((p.present / (p.present + p.absent)) * 100) : 0}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
