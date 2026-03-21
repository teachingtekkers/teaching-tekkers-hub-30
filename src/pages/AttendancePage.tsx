import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, CheckCircle, Save, Loader2, Zap, ClipboardList, Check } from "lucide-react";
import { toast } from "sonner";
import AttendanceParticipantRow, { type ParticipantData } from "@/components/attendance/AttendanceParticipantRow";
import AttendanceSortControl, { type SortField } from "@/components/attendance/AttendanceSortControl";
import CoachModeList from "@/components/attendance/CoachModeList";

interface CampOption {
  id: string;
  name: string;
  club_name: string;
  start_date: string;
  end_date: string;
}

interface AttendanceRow {
  id?: string;
  synced_booking_id: string;
  status: "present" | "absent";
  note: string | null;
}

export default function AttendancePage() {
  const { user, role } = useAuth();
  const [camps, setCamps] = useState<CampOption[]>([]);
  const [selectedCamp, setSelectedCamp] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [participants, setParticipants] = useState<ParticipantData[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("last_name");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"admin" | "coach">("admin");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const attendanceRef = useRef(attendance);

  useEffect(() => {
    (async () => {
      if (role === "head_coach" && user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("coach_id")
          .eq("id", user.id)
          .single();

        if (profile?.coach_id) {
          const { data: assignments } = await supabase
            .from("camp_coach_assignments")
            .select("camp_id")
            .eq("coach_id", profile.coach_id);

          const campIds = (assignments || []).map((a) => a.camp_id);
          if (campIds.length > 0) {
            const { data } = await supabase
              .from("camps")
              .select("id, name, club_name, start_date, end_date")
              .in("id", campIds)
              .order("start_date", { ascending: false });
            setCamps((data as CampOption[]) || []);
          }
        }
        // Default to coach mode for head_coach role
        setViewMode("coach");
      } else {
        const { data } = await supabase
          .from("camps")
          .select("id, name, club_name, start_date, end_date")
          .order("start_date", { ascending: false });
        setCamps((data as CampOption[]) || []);
      }
      setLoading(false);
    })();
  }, [user, role]);

  useEffect(() => {
    if (camps.length > 0 && !selectedCamp) setSelectedCamp(camps[0].id);
  }, [camps, selectedCamp]);

  const loadData = useCallback(async () => {
    if (!selectedCamp) return;

    const [pRes, aRes] = await Promise.all([
      supabase
        .from("synced_bookings")
        .select("id, child_first_name, child_last_name, age, date_of_birth, kit_size, medical_condition, medical_notes, photo_permission, payment_status, amount_paid, amount_owed, total_amount, sibling_discount, refund_amount, payment_type, staff_notes, parent_name, parent_email, parent_phone, emergency_contact, alternate_phone, booking_date")
        .eq("matched_camp_id", selectedCamp)
        .order("child_last_name"),
      supabase
        .from("attendance")
        .select("id, synced_booking_id, status, note")
        .eq("camp_id", selectedCamp)
        .eq("date", selectedDate),
    ]);

    setParticipants((pRes.data as ParticipantData[]) || []);

    const map = new Map<string, AttendanceRow>();
    for (const row of (aRes.data || []) as any[]) {
      if (row.synced_booking_id) {
        map.set(row.synced_booking_id, {
          id: row.id,
          synced_booking_id: row.synced_booking_id,
          status: row.status,
          note: row.note,
        });
      }
    }
    setAttendance(map);
  }, [selectedCamp, selectedDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // Keep ref in sync so persistAttendance always sees latest map
  useEffect(() => { attendanceRef.current = attendance; }, [attendance]);

  /** Persist a single attendance toggle to the database */
  const persistAttendance = useCallback(async (participantId: string, newStatus: "present" | "absent") => {
    if (!selectedCamp) return;
    setAutoSaveStatus("saving");
    clearTimeout(autoSaveTimer.current);

    const existing = attendanceRef.current.get(participantId);
    if (existing?.id) {
      await supabase.from("attendance").update({ status: newStatus }).eq("id", existing.id);
    } else {
      // Delete any stale rows first to prevent duplicates
      await supabase.from("attendance")
        .delete()
        .eq("camp_id", selectedCamp)
        .eq("synced_booking_id", participantId)
        .eq("date", selectedDate);
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
  }, [selectedCamp, selectedDate]);

  const toggleStatus = useCallback((participantId: string) => {
    let newStatus: "present" | "absent" = "present";
    setAttendance((prev) => {
      const next = new Map(prev);
      const existing = next.get(participantId);
      if (existing) {
        newStatus = existing.status === "present" ? "absent" : "present";
        next.set(participantId, { ...existing, status: newStatus });
      } else {
        newStatus = "present";
        next.set(participantId, { synced_booking_id: participantId, status: "present", note: null });
      }
      return next;
    });
    persistAttendance(participantId, newStatus);
  }, [persistAttendance]);

  const markAllPresent = useCallback(async () => {
    if (!selectedCamp) return;
    setAutoSaveStatus("saving");
    clearTimeout(autoSaveTimer.current);

    const newMap = new Map<string, AttendanceRow>();
    const upserts: any[] = [];
    const inserts: any[] = [];
    for (const p of participants) {
      const existing = attendanceRef.current.get(p.id);
      newMap.set(p.id, { id: existing?.id, synced_booking_id: p.id, status: "present", note: existing?.note || null });
      if (existing?.id) {
        upserts.push({ id: existing.id, camp_id: selectedCamp, synced_booking_id: p.id, date: selectedDate, status: "present", note: existing.note });
      } else {
        inserts.push({ camp_id: selectedCamp, synced_booking_id: p.id, date: selectedDate, status: "present", note: null });
      }
    }
    setAttendance(newMap);
    if (upserts.length > 0) await supabase.from("attendance").upsert(upserts);
    if (inserts.length > 0) await supabase.from("attendance").insert(inserts);
    setAutoSaveStatus("saved");
    autoSaveTimer.current = setTimeout(() => setAutoSaveStatus("idle"), 1500);
    loadData();
  }, [selectedCamp, selectedDate, participants, loadData]);

  const handlePaymentUpdate = useCallback(async (bookingId: string, updates: Record<string, any>) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === bookingId ? { ...p, ...updates } : p))
    );
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


  const getStatus = (id: string): "present" | "absent" => attendance.get(id)?.status || "absent";
  const presentCount = participants.filter((p) => getStatus(p.id) === "present").length;
  const camp = camps.find((c) => c.id === selectedCamp);

  const sorted = [...participants].sort((a, b) => {
    if (sortField === "first_name") return a.child_first_name.localeCompare(b.child_first_name);
    if (sortField === "age") return (a.age ?? 99) - (b.age ?? 99);
    return a.child_last_name.localeCompare(b.child_last_name);
  });

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            {viewMode === "coach" ? "Fast check-in mode" : "Mark daily attendance for camp participants"}
          </p>
        </div>
        {/* View mode toggle */}
        <div className="flex rounded-lg border overflow-hidden">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "admin" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
            }`}
            onClick={() => setViewMode("admin")}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Admin
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "coach" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
            }`}
            onClick={() => setViewMode("coach")}
          >
            <Zap className="h-3.5 w-3.5" />
            Coach Mode
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Camp</Label>
              <Select value={selectedCamp} onValueChange={(v) => { setSelectedCamp(v); }}>
                <SelectTrigger><SelectValue placeholder="Select camp" /></SelectTrigger>
                <SelectContent>
                  {camps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.club_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {camp && (
        <>
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{camp.name}</span>
              <Badge variant={presentCount === participants.length && participants.length > 0 ? "default" : "secondary"} className="gap-1 text-xs">
                <CheckCircle className="h-3 w-3" />
                {presentCount}/{participants.length}
              </Badge>
            </div>
            {viewMode === "admin" && <AttendanceSortControl value={sortField} onChange={setSortField} />}
          </div>

          <div className="flex items-center gap-2 px-1">
            <Button variant="outline" size="sm" onClick={markAllPresent} disabled={participants.length === 0}>
              Mark All Present
            </Button>
            {autoSaveStatus !== "idle" && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground animate-in fade-in duration-200">
                {autoSaveStatus === "saving" ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                ) : (
                  <><Check className="h-3 w-3 text-emerald-600" /> Saved</>
                )}
              </span>
            )}
          </div>

          {participants.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No participants for this camp.</p>
              </CardContent>
            </Card>
          ) : viewMode === "coach" ? (
            <CoachModeList
              participants={sorted}
              getStatus={getStatus}
              onToggle={toggleStatus}
              onInstantSave={persistAttendance}
            />
          ) : (
            <div className="space-y-1">
              {sorted.map((p) => (
                <AttendanceParticipantRow
                  key={p.id}
                  participant={p}
                  isPresent={getStatus(p.id) === "present"}
                  onToggle={() => toggleStatus(p.id)}
                  isAdmin={false}
                  onPaymentUpdate={handlePaymentUpdate}
                  expandedId={expandedId}
                  onExpand={setExpandedId}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
