import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, MapPin, Calendar, Heart, Banknote, Check, AlertTriangle, Settings, Archive, Trash2, ClipboardCheck, UserCog, Building2, FileText, ExternalLink, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import CampFinancialOverview from "@/components/camp/CampFinancialOverview";

interface CampData {
  id: string;
  name: string;
  club_name: string;
  venue: string;
  county: string;
  start_date: string;
  end_date: string;
  age_group: string;
  capacity: number;
  status?: string;
  is_auto_created?: boolean;
}

interface Participant {
  id: string;
  child_first_name: string;
  child_last_name: string;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  emergency_contact: string | null;
  alternate_phone: string | null;
  medical_condition: string | null;
  medical_notes: string | null;
  kit_size: string | null;
  payment_status: string | null;
  age: number | null;
  date_of_birth: string | null;
  camp_date: string | null;
  booking_date: string | null;
  imported_at: string | null;
  total_amount: number | null;
  amount_paid: number | null;
  amount_owed: number | null;
  sibling_discount: number | null;
  refund_amount: number | null;
  payment_type: string | null;
  photo_permission: boolean | null;
}

interface CoachAssignment {
  id: string;
  coach_id: string;
  role: string;
  coach_name: string;
}

export default function CampDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [camp, setCamp] = useState<CampData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [coachAssignments, setCoachAssignments] = useState<CoachAssignment[]>([]);
  const [clubName, setClubName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const { toast } = useToast();

  // Manage Data modal state
  const [manageOpen, setManageOpen] = useState(false);
  const [purgeScope, setPurgeScope] = useState<"this" | "multi" | "daterange">("this");
  const [selectedCampIds, setSelectedCampIds] = useState<string[]>([]);
  const [allCamps, setAllCamps] = useState<{ id: string; name: string; start_date: string; end_date: string }[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [purgeBookings, setPurgeBookings] = useState(true);
  const [purgeAttendance, setPurgeAttendance] = useState(true);
  const [purgeRosters, setPurgeRosters] = useState(false);
  const [purgeCamps, setPurgeCamps] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [purging, setPurging] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [cRes, pRes, coachRes] = await Promise.all([
      supabase.from("camps").select("*").eq("id", id).single(),
      supabase
        .from("synced_bookings")
        .select("id, child_first_name, child_last_name, parent_name, parent_phone, parent_email, emergency_contact, alternate_phone, medical_condition, medical_notes, kit_size, payment_status, age, date_of_birth, camp_date, booking_date, imported_at, total_amount, amount_paid, amount_owed, sibling_discount, refund_amount, payment_type, photo_permission")
        .eq("matched_camp_id", id)
        .order("child_last_name"),
      supabase.from("camp_coach_assignments").select("id, coach_id, role").eq("camp_id", id),
    ]);
    const campData = cRes.data as unknown as CampData & { club_id?: string };
    if (campData) {
      setCamp(campData);
      // Resolve club name
      if (campData.club_id) {
        const { data: club } = await supabase.from("clubs").select("name").eq("id", campData.club_id).single();
        setClubName(club?.name || campData.club_name);
      } else {
        setClubName(campData.club_name);
      }
    }
    setParticipants((pRes.data as unknown as Participant[]) || []);
    
    // Resolve coach names
    const assignments = (coachRes.data || []) as any[];
    if (assignments.length > 0) {
      const coachIds = assignments.map((a: any) => a.coach_id);
      const { data: coaches } = await supabase.from("coaches").select("id, full_name").in("id", coachIds);
      const nameMap = new Map((coaches || []).map((c: any) => [c.id, c.full_name]));
      setCoachAssignments(assignments.map((a: any) => ({
        id: a.id,
        coach_id: a.coach_id,
        role: a.role,
        coach_name: nameMap.get(a.coach_id) || "Unknown",
      })));
    } else {
      setCoachAssignments([]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleArchive = useCallback(async () => {
    if (!camp) return;
    setArchiving(true);
    const { error } = await supabase
      .from("camps")
      .update({ status: "archived" } as any)
      .eq("id", camp.id);
    if (error) {
      toast({ title: "Archive failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Camp archived" });
      load();
    }
    setArchiving(false);
  }, [camp, toast, load]);

  const openManageData = useCallback(async () => {
    if (!camp) return;
    setSelectedCampIds([camp.id]);
    setPurgeScope("this");
    setPurgeBookings(true);
    setPurgeAttendance(true);
    setPurgeRosters(false);
    setPurgeCamps(false);
    setPurgeConfirm("");
    setDateFrom("");
    setDateTo("");

    // Load all camps for multi-select / date-range
    const { data } = await supabase
      .from("camps")
      .select("id, name, start_date, end_date")
      .order("start_date", { ascending: false });
    setAllCamps(data || []);
    setManageOpen(true);
  }, [camp]);

  const getTargetCampIds = useCallback((): string[] => {
    if (purgeScope === "this" && camp) return [camp.id];
    if (purgeScope === "multi") return selectedCampIds;
    if (purgeScope === "daterange" && dateFrom && dateTo) {
      return allCamps
        .filter(c => c.start_date >= dateFrom && c.start_date <= dateTo)
        .map(c => c.id);
    }
    return [];
  }, [purgeScope, camp, selectedCampIds, allCamps, dateFrom, dateTo]);

  const handlePurge = useCallback(async () => {
    const campIds = getTargetCampIds();
    if (campIds.length === 0) {
      toast({ title: "No camps selected", variant: "destructive" });
      return;
    }
    setPurging(true);
    try {
      const { data, error } = await supabase.functions.invoke("purge-camp-data", {
        body: {
          camp_ids: campIds,
          delete_synced_bookings: purgeBookings,
          delete_attendance: purgeAttendance,
          delete_rosters: purgeRosters,
          delete_camp_records: purgeCamps,
        },
      });
      if (error) throw error;
      const s = data?.summary || {};
      const parts: string[] = [];
      if (s.synced_bookings) parts.push(`${s.synced_bookings} bookings`);
      if (s.attendance) parts.push(`${s.attendance} attendance`);
      if (s.roster_assignments) parts.push(`${s.roster_assignments} roster assignments`);
      if (s.camps_deleted) parts.push(`${s.camps_deleted} camps deleted`);
      toast({
        title: "Data purge complete",
        description: parts.length ? `Removed: ${parts.join(", ")}` : "No data found to remove",
      });
      setManageOpen(false);
      if (purgeCamps && campIds.includes(camp?.id || "")) {
        navigate("/camps");
      } else {
        load();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Purge failed";
      toast({ title: "Purge failed", description: message, variant: "destructive" });
    } finally {
      setPurging(false);
    }
  }, [getTargetCampIds, purgeBookings, purgeAttendance, purgeRosters, purgeCamps, camp, toast, load, navigate]);

  const toggleCampSelection = (campId: string) => {
    setSelectedCampIds(prev =>
      prev.includes(campId) ? prev.filter(id => id !== campId) : [...prev, campId]
    );
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!camp) return <div className="p-8 text-muted-foreground">Camp not found</div>;

  const payBadge = (s: string | null) => {
    if (s === "paid") return <Badge className="bg-emerald-100 text-emerald-800 border-0">Paid</Badge>;
    if (s === "pending") return <Badge className="bg-amber-100 text-amber-800 border-0">Pending</Badge>;
    if (s === "partial") return <Badge className="bg-amber-100 text-amber-800 border-0">Partial</Badge>;
    if (s === "refunded") return <Badge className="bg-red-100 text-red-800 border-0">Refunded</Badge>;
    return <Badge variant="secondary">{s || "—"}</Badge>;
  };

  const targetCount = getTargetCampIds().length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{camp.name}</h1>
            {camp.status === "draft" && (
              <Badge variant="outline" className="border-amber-300 text-amber-700">Draft</Badge>
            )}
            {camp.status === "archived" && (
              <Badge variant="outline" className="border-muted-foreground text-muted-foreground">Archived</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{camp.club_name}</p>
        </div>
        <div className="flex gap-2">
          {camp.status === "draft" && (
            <Button
              size="sm"
              disabled={publishing}
              onClick={async () => {
                setPublishing(true);
                const { error } = await supabase
                  .from("camps")
                  .update({ status: "published", is_auto_created: false } as any)
                  .eq("id", camp.id);
                if (error) {
                  toast({ title: "Publish failed", description: error.message, variant: "destructive" });
                } else {
                  toast({ title: "Camp published" });
                  load();
                }
                setPublishing(false);
              }}
            >
              <Check className="h-4 w-4 mr-1.5" />
              {publishing ? "Publishing…" : "Publish Camp"}
            </Button>
          )}
          {camp.status !== "archived" && (
            <Button size="sm" variant="outline" onClick={handleArchive} disabled={archiving}>
              <Archive className="h-4 w-4 mr-1.5" />
              {archiving ? "Archiving…" : "Archive"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={openManageData}>
            <Settings className="h-4 w-4 mr-1.5" /> Manage Data
          </Button>
        </div>
      </div>

      {camp.status === "draft" && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This camp was auto-created from a booking import and is in <strong>draft</strong> status. Review the details and publish when ready.
          </p>
        </div>
      )}

      {camp.status === "archived" && (
        <div className="flex items-center gap-2 rounded-md border px-4 py-3 bg-muted/50">
          <Archive className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            This camp has been <strong>archived</strong>. It is hidden from the default Camps view.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Venue</p>
            <p className="text-sm font-medium text-foreground">{camp.venue}, {camp.county}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Dates</p>
            <p className="text-sm font-medium text-foreground">{camp.start_date} — {camp.end_date}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Participants</p>
            <p className="text-lg font-semibold text-foreground">{participants.length} / {camp.capacity}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Age Group</p>
            <Badge variant="secondary" className="mt-1">{camp.age_group}</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Links</p>
          <div className="flex flex-wrap gap-2">
            <Link to={`/attendance`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5" /> Attendance
              </Button>
            </Link>
            <Link to={`/players`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Users className="h-3.5 w-3.5" /> Bookings
              </Button>
            </Link>
            <Link to={`/invoices`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Club Payments
              </Button>
            </Link>
            <Link to={`/roster`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <UserCog className="h-3.5 w-3.5" /> Roster
              </Button>
            </Link>
            {clubName && (
              <Link to={`/clubs`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> {clubName}
                </Button>
              </Link>
            )}
          </div>

          {/* Assigned Coaches */}
          {coachAssignments.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Assigned Staff</p>
              <div className="flex flex-wrap gap-2">
                {coachAssignments.map((a) => (
                  <Link key={a.id} to={`/coaches/${a.coach_id}`}>
                    <Badge variant="secondary" className="cursor-pointer hover:bg-accent gap-1.5">
                      <UserCog className="h-3 w-3" />
                      {a.coach_name}
                      <span className="text-[10px] text-muted-foreground">({a.role === "head_coach" ? "HC" : "Asst"})</span>
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="financial">
        <TabsList>
          <TabsTrigger value="financial" className="gap-1.5"><Banknote className="h-3.5 w-3.5" />Financial Overview</TabsTrigger>
          <TabsTrigger value="participants" className="gap-1.5"><Users className="h-3.5 w-3.5" />Participants</TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="mt-4">
          <CampFinancialOverview campId={camp.id} campName={camp.name} clubName={camp.club_name} />
        </TabsContent>

        <TabsContent value="participants" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Participants (Synced Bookings)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {participants.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No synced bookings matched to this camp yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Child Name</TableHead>
                      <TableHead>Age / DOB</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead className="hidden md:table-cell">Contact</TableHead>
                      <TableHead className="hidden lg:table-cell">Emergency</TableHead>
                      <TableHead className="hidden lg:table-cell">Medical</TableHead>
                      <TableHead>Kit</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="hidden md:table-cell">Owed</TableHead>
                      <TableHead className="hidden lg:table-cell">Indicators</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((p) => {
                      const hasMedical = !!(p.medical_condition || p.medical_notes);
                      const medText = [p.medical_condition, p.medical_notes].filter(Boolean).join(" — ");
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">
                            {p.child_first_name} {p.child_last_name}
                          </TableCell>
                          <TableCell className="text-sm">
                            {p.age && <span>{p.age} yrs</span>}
                            {p.date_of_birth && <span className="block text-xs text-muted-foreground">{p.date_of_birth}</span>}
                            {!p.age && !p.date_of_birth && "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {p.parent_name || "—"}
                            {p.parent_email && <span className="block text-xs text-muted-foreground">{p.parent_email}</span>}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {p.parent_phone || "—"}
                            {p.alternate_phone && <span className="block text-xs">Alt: {p.alternate_phone}</span>}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {p.emergency_contact || "—"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm">
                            {hasMedical ? (
                              <span className="flex items-center gap-1 text-destructive">
                                <Heart className="h-3 w-3" /> {medText}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{p.kit_size || "M"}</Badge></TableCell>
                          <TableCell>
                            {payBadge(p.payment_status)}
                            {p.payment_type && <span className="block text-[10px] text-muted-foreground">{p.payment_type}</span>}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm">
                            {(() => {
                              const totalCost = Math.max(0, (p.total_amount ?? 0) - (p.sibling_discount ?? 0));
                              const owed = (p.amount_owed ?? 0) > 0 ? p.amount_owed : Math.max(0, totalCost - (p.amount_paid ?? 0) - (p.refund_amount ?? 0));
                              return (owed ?? 0) > 0 ? (
                                <span className="text-amber-600 font-medium">€{owed}</span>
                              ) : (
                                <span className="text-muted-foreground">€0</span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex gap-1">
                              {hasMedical && <span title={medText}>🏥</span>}
                              {p.photo_permission === false && <span title="No photo permission">📷🚫</span>}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Manage Data Modal */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" /> Manage Camp Data
            </DialogTitle>
            <DialogDescription>
              Select which data to remove and the scope of camps affected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Scope selection */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Scope</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="scope" checked={purgeScope === "this"} onChange={() => setPurgeScope("this")} className="accent-primary" />
                  This camp only — <span className="text-muted-foreground">{camp.name}</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="scope" checked={purgeScope === "multi"} onChange={() => setPurgeScope("multi")} className="accent-primary" />
                  Select multiple camps
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="scope" checked={purgeScope === "daterange"} onChange={() => setPurgeScope("daterange")} className="accent-primary" />
                  Date range
                </label>
              </div>
            </div>

            {/* Multi-select camps */}
            {purgeScope === "multi" && (
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {allCamps.map(c => (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                    <Checkbox
                      checked={selectedCampIds.includes(c.id)}
                      onCheckedChange={() => toggleCampSelection(c.id)}
                    />
                    <span className="truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto shrink-0">{c.start_date}</span>
                  </label>
                ))}
              </div>
            )}

            {/* Date range */}
            {purgeScope === "daterange" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">From</p>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">To</p>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
                {dateFrom && dateTo && (
                  <p className="col-span-2 text-xs text-muted-foreground">
                    {allCamps.filter(c => c.start_date >= dateFrom && c.start_date <= dateTo).length} camp(s) in range
                  </p>
                )}
              </div>
            )}

            {/* What to delete */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Data to remove</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={purgeBookings} onCheckedChange={(v) => setPurgeBookings(!!v)} />
                  Synced Bookings
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={purgeAttendance} onCheckedChange={(v) => setPurgeAttendance(!!v)} />
                  Attendance Records
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={purgeRosters} onCheckedChange={(v) => setPurgeRosters(!!v)} />
                  Roster / Coach Assignments
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={purgeCamps} onCheckedChange={(v) => setPurgeCamps(!!v)} />
                  <span className="text-destructive font-medium">Delete camp record(s)</span>
                </label>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                This action is <strong>permanent</strong> and affects <strong>{targetCount} camp(s)</strong>. Type <strong>DELETE</strong> to confirm.
              </p>
            </div>

            <Input
              value={purgeConfirm}
              onChange={e => setPurgeConfirm(e.target.value)}
              placeholder="Type DELETE"
              className="font-mono"
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManageOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={purgeConfirm !== "DELETE" || purging || targetCount === 0}
                onClick={handlePurge}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                {purging ? "Purging…" : `Purge ${targetCount} camp(s)`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
