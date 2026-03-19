import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
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
import { Users, CheckCircle, XCircle, Calendar, BarChart3, Loader2, Check, Banknote, Shirt, UsersRound } from "lucide-react";
import { toast } from "sonner";
import AttendanceParticipantRow, { type ParticipantData } from "@/components/attendance/AttendanceParticipantRow";
import AttendanceSortControl, { type SortField } from "@/components/attendance/AttendanceSortControl";
import AttendanceMetricsSummary from "@/components/attendance/AttendanceMetricsSummary";
import AttendanceFilters, { type AttendanceFilterState } from "@/components/attendance/AttendanceFilters";
import AttendanceExport from "@/components/attendance/AttendanceExport";
import AttendanceFinancialSummary from "@/components/attendance/AttendanceFinancialSummary";
import AttendanceKitSummary from "@/components/attendance/AttendanceKitSummary";
import AttendanceFamilyGroups from "@/components/attendance/AttendanceFamilyGroups";

interface CampOption { id: string; name: string; club_name: string; start_date: string; end_date: string; }
interface AttendanceRow { id?: string; synced_booking_id: string; status: "present" | "absent"; note: string | null; }

function calcTotalCost(p: ParticipantData): number {
  return Math.max(0, (p.total_amount ?? 0) - (p.sibling_discount ?? 0));
}

export default function AdminAttendancePage() {
  const [camps, setCamps] = useState<CampOption[]>([]);
  const [selectedCamp, setSelectedCamp] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRow>>(new Map());
  const [allAttendance, setAllAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("last_name");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [filters, setFilters] = useState<AttendanceFilterState>({ search: "", paymentFilter: "all", statusFilter: "all" });
  const [kitGivenMap, setKitGivenMap] = useState<Map<string, boolean>>(new Map());
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const attendanceRef = useRef(attendance);

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
        .select("id, child_first_name, child_last_name, age, date_of_birth, kit_size, medical_condition, medical_notes, photo_permission, payment_status, amount_paid, amount_owed, total_amount, sibling_discount, refund_amount, payment_type, staff_notes, parent_name, parent_email, parent_phone, emergency_contact, alternate_phone, booking_date, kit_given")
        .eq("matched_camp_id", selectedCamp)
        .order("child_last_name"),
      supabase.from("attendance")
        .select("id, synced_booking_id, status, note")
        .eq("camp_id", selectedCamp)
        .eq("date", selectedDate),
    ]);
    const pData = (pRes.data || []) as any[];
    setParticipants(pData as ParticipantData[]);
    // Build kit given map
    const kMap = new Map<string, boolean>();
    for (const p of pData) kMap.set(p.id, p.kit_given ?? false);
    setKitGivenMap(kMap);

    const map = new Map<string, AttendanceRow>();
    for (const r of (aRes.data || []) as any[]) {
      if (r.synced_booking_id) map.set(r.synced_booking_id, { id: r.id, synced_booking_id: r.synced_booking_id, status: r.status, note: r.note });
    }
    setAttendance(map);
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
  useEffect(() => { attendanceRef.current = attendance; }, [attendance]);

  const persistAttendance = useCallback(async (participantId: string, newStatus: "present" | "absent") => {
    if (!selectedCamp) return;
    setAutoSaveStatus("saving");
    clearTimeout(autoSaveTimer.current);
    const existing = attendanceRef.current.get(participantId);
    if (existing?.id) {
      await supabase.from("attendance").update({ status: newStatus }).eq("id", existing.id);
    } else {
      const { data } = await supabase
        .from("attendance")
        .insert({ camp_id: selectedCamp, synced_booking_id: participantId, date: selectedDate, status: newStatus, note: null })
        .select("id")
        .single();
      if (data) {
        setAttendance((prev) => {
          const next = new Map(prev);
          const cur = next.get(participantId);
          if (cur) next.set(participantId, { ...cur, id: data.id });
          return next;
        });
      }
    }
    setAutoSaveStatus("saved");
    autoSaveTimer.current = setTimeout(() => setAutoSaveStatus("idle"), 1500);
    loadSummary();
  }, [selectedCamp, selectedDate, loadSummary]);

  const toggleStatus = useCallback((pid: string) => {
    let newStatus: "present" | "absent" = "present";
    setAttendance((prev) => {
      const next = new Map(prev);
      const ex = next.get(pid);
      if (ex) {
        newStatus = ex.status === "present" ? "absent" : "present";
        next.set(pid, { ...ex, status: newStatus });
      } else {
        newStatus = "present";
        next.set(pid, { synced_booking_id: pid, status: "present", note: null });
      }
      return next;
    });
    persistAttendance(pid, newStatus);
  }, [persistAttendance]);

  const handleFieldUpdate = useCallback(async (id: string, field: string, value: any) => {
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    await supabase.from("synced_bookings").update({ [field]: value }).eq("id", id);
  }, []);

  const handlePaymentUpdate = useCallback(async (bookingId: string, updates: Record<string, any>) => {
    setParticipants((prev) => prev.map((p) => (p.id === bookingId ? { ...p, ...updates } : p)));
    const { error } = await supabase.from("synced_bookings").update(updates).eq("id", bookingId);
    if (error) toast.error("Failed to save payment update");
    else toast.success("Payment updated");
  }, []);

  const handleToggleKitGiven = useCallback(async (id: string, given: boolean) => {
    setKitGivenMap((prev) => { const n = new Map(prev); n.set(id, given); return n; });
    await supabase.from("synced_bookings").update({ kit_given: given }).eq("id", id);
  }, []);

  const getStatus = (id: string): "present" | "absent" => attendance.get(id)?.status || "absent";

  const filtered = useMemo(() => {
    let list = [...participants];
    const q = filters.search.toLowerCase().trim();
    if (q) list = list.filter((p) => `${p.child_first_name} ${p.child_last_name}`.toLowerCase().includes(q));
    if (filters.paymentFilter === "unpaid") {
      list = list.filter((p) => {
        const owed = p.amount_owed ?? Math.max(0, calcTotalCost(p) - (p.amount_paid ?? 0) - (p.refund_amount ?? 0));
        return owed > 0;
      });
    } else if (filters.paymentFilter === "paid") {
      list = list.filter((p) => {
        const owed = p.amount_owed ?? Math.max(0, calcTotalCost(p) - (p.amount_paid ?? 0) - (p.refund_amount ?? 0));
        return owed <= 0;
      });
    }
    if (filters.statusFilter === "present") list = list.filter((p) => getStatus(p.id) === "present");
    else if (filters.statusFilter === "absent") list = list.filter((p) => getStatus(p.id) !== "present");
    return list;
  }, [participants, filters, attendance]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortField === "first_name") return a.child_first_name.localeCompare(b.child_first_name);
      if (sortField === "age") return (a.age ?? 99) - (b.age ?? 99);
      return a.child_last_name.localeCompare(b.child_last_name);
    });
  }, [filtered, sortField]);

  const dateSummary = useMemo(() => {
    const map = new Map<string, { present: number; absent: number }>();
    for (const r of allAttendance) {
      if (!map.has(r.date)) map.set(r.date, { present: 0, absent: 0 });
      const s = map.get(r.date)!;
      if (r.status === "present") s.present++; else s.absent++;
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [allAttendance]);

  const participantSummary = useMemo(() => {
    const map = new Map<string, { present: number; absent: number }>();
    for (const r of allAttendance) {
      if (!r.synced_booking_id) continue;
      if (!map.has(r.synced_booking_id)) map.set(r.synced_booking_id, { present: 0, absent: 0 });
      const s = map.get(r.synced_booking_id)!;
      if (r.status === "present") s.present++; else s.absent++;
    }
    return participants.map((p) => ({ ...p, ...(map.get(p.id) || { present: 0, absent: 0 }) }));
  }, [allAttendance, participants]);

  const camp = camps.find((c) => c.id === selectedCamp);
  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground">View and manage daily attendance across all camps</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Camp</Label>
              <Select value={selectedCamp} onValueChange={setSelectedCamp}>
                <SelectTrigger><SelectValue placeholder="Select camp" /></SelectTrigger>
                <SelectContent>
                  {camps.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} — {c.club_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {camp && (
        <>
          <AttendanceMetricsSummary
            participants={participants}
            getStatus={getStatus}
            campName={`${camp.name} — ${camp.club_name}`}
            selectedDate={selectedDate}
          />

          <Tabs defaultValue="mark">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="mark" className="gap-1.5"><CheckCircle className="h-3.5 w-3.5" />Mark</TabsTrigger>
              <TabsTrigger value="by-date" className="gap-1.5"><Calendar className="h-3.5 w-3.5" />By Date</TabsTrigger>
              <TabsTrigger value="by-child" className="gap-1.5"><Users className="h-3.5 w-3.5" />By Child</TabsTrigger>
              <TabsTrigger value="finance" className="gap-1.5"><Banknote className="h-3.5 w-3.5" />Finance</TabsTrigger>
              <TabsTrigger value="kit" className="gap-1.5"><Shirt className="h-3.5 w-3.5" />Kit</TabsTrigger>
              <TabsTrigger value="families" className="gap-1.5"><UsersRound className="h-3.5 w-3.5" />Families</TabsTrigger>
            </TabsList>

            <TabsContent value="mark" className="space-y-3 mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <AttendanceFilters filters={filters} onChange={setFilters} />
                <div className="flex items-center gap-2">
                  <AttendanceExport participants={sorted} getStatus={getStatus} campName={camp.name} selectedDate={selectedDate} />
                  <AttendanceSortControl value={sortField} onChange={setSortField} />
                  {autoSaveStatus !== "idle" && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground animate-in fade-in duration-200">
                      {autoSaveStatus === "saving" ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</> : <><Check className="h-3 w-3 text-emerald-600" /> Saved</>}
                    </span>
                  )}
                </div>
              </div>
              {sorted.length === 0 ? (
                <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
                  {participants.length === 0 ? "No participants for this camp." : "No participants match your filters."}
                </CardContent></Card>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground px-1">Showing {sorted.length} of {participants.length} participants</div>
                  {sorted.map((p) => (
                    <AttendanceParticipantRow
                      key={p.id} participant={p} isPresent={getStatus(p.id) === "present"}
                      onToggle={() => toggleStatus(p.id)} isAdmin={true}
                      onFieldUpdate={handleFieldUpdate} onPaymentUpdate={handlePaymentUpdate}
                      expandedId={expandedId} onExpand={setExpandedId}
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
                      <TableHeader><TableRow>
                        <TableHead>Date</TableHead><TableHead className="text-center">Present</TableHead>
                        <TableHead className="text-center">Absent</TableHead><TableHead className="text-center">Rate</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {dateSummary.map(([date, s]) => (
                          <TableRow key={date} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedDate(date)}>
                            <TableCell className={`font-medium ${date === selectedDate ? "text-primary" : ""}`}>{date}</TableCell>
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
                      <TableHeader><TableRow>
                        <TableHead>Child</TableHead><TableHead className="text-center">Present</TableHead>
                        <TableHead className="text-center">Absent</TableHead><TableHead className="text-center">Rate</TableHead>
                      </TableRow></TableHeader>
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

            <TabsContent value="finance" className="mt-4">
              <AttendanceFinancialSummary participants={participants} />
            </TabsContent>

            <TabsContent value="kit" className="mt-4">
              <AttendanceKitSummary participants={participants} kitGivenMap={kitGivenMap} onToggleKitGiven={handleToggleKitGiven} />
            </TabsContent>

            <TabsContent value="families" className="mt-4">
              <AttendanceFamilyGroups participants={participants} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
