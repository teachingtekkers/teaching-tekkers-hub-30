import { useState, useEffect, useCallback } from "react";
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
import { Users, CheckCircle, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AttendanceParticipantRow, { type ParticipantData } from "@/components/attendance/AttendanceParticipantRow";
import AttendanceSortControl, { type SortField } from "@/components/attendance/AttendanceSortControl";

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
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [sortField, setSortField] = useState<SortField>("last_name");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    setDirty(false);
  }, [selectedCamp, selectedDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleStatus = (participantId: string) => {
    setAttendance((prev) => {
      const next = new Map(prev);
      const existing = next.get(participantId);
      if (existing) {
        next.set(participantId, { ...existing, status: existing.status === "present" ? "absent" : "present" });
      } else {
        next.set(participantId, { synced_booking_id: participantId, status: "present", note: null });
      }
      return next;
    });
    setDirty(true);
  };

  const markAllPresent = () => {
    setAttendance(() => {
      const next = new Map<string, AttendanceRow>();
      for (const p of participants) {
        const existing = attendance.get(p.id);
        next.set(p.id, { id: existing?.id, synced_booking_id: p.id, status: "present", note: existing?.note || null });
      }
      return next;
    });
    setDirty(true);
  };

  const handlePaymentUpdate = useCallback(async (bookingId: string, updates: Record<string, any>) => {
    // Update local state immediately
    setParticipants((prev) =>
      prev.map((p) => (p.id === bookingId ? { ...p, ...updates } : p))
    );

    // Persist to synced_bookings
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

    const upserts: any[] = [];
    const inserts: any[] = [];

    for (const p of participants) {
      const row = attendance.get(p.id);
      const status = row?.status || "absent";
      if (row?.id) {
        upserts.push({ id: row.id, camp_id: selectedCamp, synced_booking_id: p.id, date: selectedDate, status, note: row.note });
      } else {
        inserts.push({ camp_id: selectedCamp, synced_booking_id: p.id, date: selectedDate, status, note: row?.note || null });
      }
    }

    let hasError = false;
    if (upserts.length > 0) {
      const { error } = await supabase.from("attendance").upsert(upserts);
      if (error) hasError = true;
    }
    if (inserts.length > 0) {
      const { error } = await supabase.from("attendance").insert(inserts);
      if (error) hasError = true;
    }

    setSaving(false);
    if (hasError) {
      toast.error("Failed to save attendance");
    } else {
      toast.success("Attendance saved");
      setDirty(false);
      loadData();
    }
  };

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
      <div className="page-header">
        <h1 className="text-xl font-bold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground">Mark daily attendance for camp participants</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Camp</Label>
              <Select value={selectedCamp} onValueChange={(v) => { setSelectedCamp(v); setDirty(false); }}>
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
              <Input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setDirty(false); }} />
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
            <AttendanceSortControl value={sortField} onChange={setSortField} />
          </div>

          <div className="flex gap-2 px-1">
            <Button variant="outline" size="sm" onClick={markAllPresent} disabled={participants.length === 0}>
              Mark All Present
            </Button>
            <Button size="sm" onClick={saveAttendance} disabled={!dirty || saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>

          {participants.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No participants for this camp.</p>
              </CardContent>
            </Card>
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
