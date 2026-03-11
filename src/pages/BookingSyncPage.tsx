import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { RefreshCw, CloudDownload, AlertTriangle, CheckCircle, Clock, Search, ExternalLink, Upload, Zap, Wrench } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import BookingImportDialog from "@/components/booking-sync/BookingImportDialog";

interface SyncedBooking {
  id: string;
  external_booking_id: string | null;
  camp_name: string;
  camp_date: string | null;
  venue: string | null;
  county: string | null;
  child_first_name: string;
  child_last_name: string;
  date_of_birth: string | null;
  age: number | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  emergency_contact: string | null;
  medical_notes: string | null;
  kit_size: string | null;
  payment_status: string | null;
  booking_status: string | null;
  source_system: string;
  imported_at: string;
  last_synced_at: string;
  matched_camp_id: string | null;
  match_status: string;
  duplicate_warning: boolean;
  notes: string | null;
  total_amount: number | null;
  amount_paid: number | null;
  amount_owed: number | null;
  sibling_discount: number | null;
  refund_amount: number | null;
  payment_type: string | null;
}

interface SyncLog {
  id: string;
  sync_started_at: string;
  sync_completed_at: string | null;
  status: string;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_notes: string | null;
  source_system: string;
}

export default function BookingSyncPage() {
  const [bookings, setBookings] = useState<SyncedBooking[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<any>(null);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [bRes, lRes] = await Promise.all([
      supabase.from("synced_bookings").select("*").order("imported_at", { ascending: false }).limit(500),
      supabase.from("sync_logs").select("*").order("sync_started_at", { ascending: false }).limit(50),
    ]);
    if (bRes.data) setBookings(bRes.data as unknown as SyncedBooking[]);
    if (lRes.data) setSyncLogs(lRes.data as unknown as SyncLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRematch = useCallback(async () => {
    setRematching(true);
    try {
      const unmatchedBookings = bookings
        .filter((b) => b.match_status === "unmatched")
        .map((b) => ({
          external_booking_id: b.external_booking_id,
          camp_name: b.camp_name,
          camp_date: b.camp_date,
          venue: b.venue,
          county: b.county,
          child_first_name: b.child_first_name,
          child_last_name: b.child_last_name,
          date_of_birth: b.date_of_birth,
          age: b.age,
          parent_name: b.parent_name,
          parent_phone: b.parent_phone,
          parent_email: b.parent_email,
          emergency_contact: b.emergency_contact,
          medical_notes: b.medical_notes,
          kit_size: b.kit_size,
          payment_status: b.payment_status,
          booking_status: b.booking_status,
        }));

      const { data, error } = await supabase.functions.invoke("booking-intake", {
        body: { bookings: unmatchedBookings },
      });
      if (error) throw error;

      const summary = data?.summary;
      toast({
        title: "Re-match complete",
        description: `${summary?.processed || 0} processed, ${summary?.created || 0} created, ${summary?.updated || 0} updated, ${summary?.camps_created || 0} camps created`,
      });
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Re-match failed";
      toast({ title: "Re-match failed", description: message, variant: "destructive" });
    } finally {
      setRematching(false);
    }
  }, [bookings, toast, loadData]);

  const handleRepairLinks = useCallback(async () => {
    setRepairing(true);
    setRepairResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("repair-camp-links", {
        body: { mode: "all" },
      });
      if (error) throw error;
      setRepairResult(data);
      const s = data?.summary;
      toast({
        title: "Repair complete",
        description: `${s?.repaired || 0} repaired, ${s?.already_correct || 0} already correct, ${s?.still_unmatched || 0} still unmatched, ${s?.duplicates_found || 0} duplicates found`,
      });
      await loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Repair failed";
      toast({ title: "Repair failed", description: message, variant: "destructive" });
    } finally {
      setRepairing(false);
    }
  }, [toast, loadData]);

  const lastSync = syncLogs[0];
  const totalSynced = bookings.length;
  const unmatched = bookings.filter(b => b.match_status === "unmatched").length;
  const duplicates = bookings.filter(b => b.duplicate_warning).length;

  const filtered = useMemo(() => {
    if (!search) return bookings;
    const q = search.toLowerCase();
    return bookings.filter(b =>
      `${b.child_first_name} ${b.child_last_name}`.toLowerCase().includes(q) ||
      b.camp_name.toLowerCase().includes(q) ||
      b.parent_name?.toLowerCase().includes(q) ||
      b.parent_email?.toLowerCase().includes(q) ||
      b.venue?.toLowerCase().includes(q)
    );
  }, [bookings, search]);

  const statusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-emerald-100 text-emerald-800 border-0">Completed</Badge>;
      case "completed_with_errors": return <Badge className="bg-amber-100 text-amber-800 border-0">Partial</Badge>;
      case "running": return <Badge className="bg-blue-100 text-blue-800 border-0">Running</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const matchBadge = (status: string, dup: boolean) => (
    <div className="flex gap-1">
      {status === "matched"
        ? <Badge className="bg-emerald-100 text-emerald-800 border-0">Matched</Badge>
        : <Badge className="bg-amber-100 text-amber-800 border-0">Unmatched</Badge>}
      {dup && <Badge variant="destructive" className="text-xs">Dup</Badge>}
    </div>
  );

  const payBadge = (s: string | null) => {
    if (s === "paid") return <Badge className="bg-emerald-100 text-emerald-800 border-0">Paid</Badge>;
    if (s === "pending") return <Badge className="bg-amber-100 text-amber-800 border-0">Pending</Badge>;
    return <Badge variant="secondary">{s || "—"}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Booking Sync / Intake</h1>
          <p className="text-sm text-muted-foreground">
            Import and manage booking data from <span className="font-medium">bookings.teachingtekkers.com</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Import Booking File
          </Button>
          {unmatched > 0 && (
            <Button size="sm" variant="secondary" onClick={handleRematch} disabled={rematching}>
              <Zap className={`h-4 w-4 mr-1.5 ${rematching ? "animate-pulse" : ""}`} />
              {rematching ? "Re-matching…" : `Re-match ${unmatched} Unmatched`}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <a href="https://bookings.teachingtekkers.com" target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1.5" /> Booking Site
            </Button>
          </a>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Last Sync</p>
            <p className="text-lg font-semibold text-foreground">
              {lastSync ? format(new Date(lastSync.sync_started_at), "dd MMM HH:mm") : "Never"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Sync Status</p>
            <div className="mt-1">{lastSync ? statusBadge(lastSync.status) : <Badge variant="secondary">No syncs</Badge>}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Total Synced</p>
            <p className="text-lg font-semibold text-foreground">{totalSynced}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Unmatched</p>
            <p className={`text-lg font-semibold ${unmatched > 0 ? "text-amber-600" : "text-foreground"}`}>{unmatched}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Duplicates</p>
            <p className={`text-lg font-semibold ${duplicates > 0 ? "text-destructive" : "text-foreground"}`}>{duplicates}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="bookings">
        <TabsList>
          <TabsTrigger value="bookings">Synced Bookings</TabsTrigger>
          <TabsTrigger value="logs">Sync Logs</TabsTrigger>
          <TabsTrigger value="endpoint">Endpoint Info</TabsTrigger>
        </TabsList>

        {/* Synced Bookings Tab */}
        <TabsContent value="bookings" className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by child, camp, parent, venue…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
            <Badge variant="secondary">{filtered.length} records</Badge>
          </div>
          <div className="rounded-lg border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child</TableHead>
                  <TableHead>Camp</TableHead>
                  <TableHead className="hidden md:table-cell">Venue</TableHead>
                  <TableHead className="hidden lg:table-cell">Parent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Total</TableHead>
                  <TableHead className="hidden md:table-cell">Paid</TableHead>
                  <TableHead className="hidden lg:table-cell">Owed</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead className="hidden md:table-cell">Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    <CloudDownload className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No synced bookings yet
                  </TableCell></TableRow>
                ) : filtered.map(b => (
                  <React.Fragment key={b.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => setExpandedBookingId(expandedBookingId === b.id ? null : b.id)}
                    >
                      <TableCell className="font-medium">{b.child_first_name} {b.child_last_name}
                        {b.medical_notes && <span className="ml-1 text-destructive text-xs">♥</span>}
                      </TableCell>
                      <TableCell>{b.camp_name}<br /><span className="text-xs text-muted-foreground">{b.camp_date ? format(new Date(b.camp_date), "dd MMM yyyy") : ""}</span></TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{b.venue || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{b.parent_name || "—"}<br /><span className="text-xs text-muted-foreground">{b.parent_email || ""}</span></TableCell>
                      <TableCell>{payBadge(b.payment_status)}{b.payment_type && <span className="block text-[10px] text-muted-foreground">{b.payment_type}</span>}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm font-medium">€{b.total_amount ?? 0}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-emerald-600">€{b.amount_paid ?? 0}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        <span className={(b.amount_owed ?? 0) > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>€{b.amount_owed ?? 0}</span>
                      </TableCell>
                      <TableCell>{matchBadge(b.match_status, b.duplicate_warning)}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{format(new Date(b.imported_at), "dd MMM HH:mm")}</TableCell>
                    </TableRow>
                    {expandedBookingId === b.id && (
                      <TableRow>
                        <TableCell colSpan={10} className="bg-muted/30 p-0">
                          <div className="p-3 space-y-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">🔍 Raw Stored Finance Values</p>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                              <div><span className="text-muted-foreground">total_amount:</span><br/><span className="font-mono font-medium">€{b.total_amount ?? "null"}</span></div>
                              <div><span className="text-muted-foreground">sibling_discount:</span><br/><span className="font-mono font-medium">€{b.sibling_discount ?? "null"}</span></div>
                              <div><span className="text-muted-foreground">amount_paid:</span><br/><span className="font-mono font-medium">€{b.amount_paid ?? "null"}</span></div>
                              <div><span className="text-muted-foreground">refund_amount:</span><br/><span className="font-mono font-medium">€{b.refund_amount ?? "null"}</span></div>
                              <div><span className="text-muted-foreground">amount_owed:</span><br/><span className="font-mono font-medium">€{b.amount_owed ?? "null"}</span></div>
                              <div><span className="text-muted-foreground">payment_status:</span><br/><span className="font-mono font-medium">{b.payment_status ?? "null"}</span></div>
                              <div><span className="text-muted-foreground">payment_type:</span><br/><span className="font-mono font-medium">{b.payment_type ?? "null"}</span></div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Sync Logs Tab */}
        <TabsContent value="logs">
          <div className="rounded-lg border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead className="hidden md:table-cell">Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLogs.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No sync history yet
                  </TableCell></TableRow>
                ) : syncLogs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-sm">{format(new Date(l.sync_started_at), "dd MMM yyyy HH:mm")}</TableCell>
                    <TableCell>{statusBadge(l.status)}</TableCell>
                    <TableCell>{l.records_processed}</TableCell>
                    <TableCell className="text-emerald-600 font-medium">{l.records_created}</TableCell>
                    <TableCell className="text-blue-600 font-medium">{l.records_updated}</TableCell>
                    <TableCell className={l.records_failed > 0 ? "text-destructive font-medium" : ""}>{l.records_failed}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">{l.error_notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Endpoint Info Tab */}
        <TabsContent value="endpoint">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Intake Endpoint</CardTitle>
              <CardDescription>Use this endpoint from your browser automation script to push booking data into the system.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">POST URL</p>
                <code className="block bg-muted rounded-md px-3 py-2 text-sm break-all">
                  {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/booking-intake`}
                </code>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Headers</p>
                <code className="block bg-muted rounded-md px-3 py-2 text-sm">
                  Content-Type: application/json<br />
                  Authorization: Bearer {'<SUPABASE_ANON_KEY>'}
                </code>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Payload Example</p>
                <pre className="bg-muted rounded-md px-3 py-2 text-xs overflow-auto">{JSON.stringify({
                  bookings: [{
                    external_booking_id: "BK-001",
                    camp_name: "Clane United Summer Camp",
                    camp_date: "2026-07-06",
                    venue: "Clane GAA Grounds",
                    county: "Kildare",
                    child_first_name: "Liam",
                    child_last_name: "Murphy",
                    date_of_birth: "2016-03-15",
                    parent_name: "Sarah Murphy",
                    parent_phone: "087 123 4567",
                    parent_email: "sarah@example.com",
                    payment_status: "paid",
                    kit_size: "S",
                  }]
                }, null, 2)}</pre>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  The automation script that calls this endpoint is built separately. This page receives and stores data only.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BookingImportDialog open={importOpen} onOpenChange={setImportOpen} onImportComplete={loadData} />
    </div>
  );
}
