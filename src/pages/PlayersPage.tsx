import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, AlertCircle, Camera, CameraOff, Heart, RefreshCw, Eye, Search, TriangleAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ImportErrorsDrawer from "@/components/booking-sync/ImportErrorsDrawer";

interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  medical_notes: string | null;
  kit_size: string;
  photo_permission: boolean;
  identity_key: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
}

interface SyncedBookingRow {
  id: string;
  external_booking_id: string | null;
  matched_player_id: string | null;
  matched_camp_id: string | null;
  payment_status: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  camp_name: string;
  total_amount: number | null;
  sibling_discount: number | null;
  amount_paid: number | null;
  refund_amount: number | null;
}

function derivePaymentStatus(b: SyncedBookingRow) {
  const totalCost = Math.max(0, (b.total_amount ?? 0) - (b.sibling_discount ?? 0));
  const owed = Math.max(0, totalCost - (b.amount_paid ?? 0) - (b.refund_amount ?? 0));
  let status: string;
  if ((b.refund_amount ?? 0) > 0) status = "Refunded";
  else if (owed <= 0 && totalCost > 0) status = "Paid";
  else if ((b.amount_paid ?? 0) > 0 && owed > 0) status = "Partial";
  else status = "Pending";
  return { status, paid: b.amount_paid ?? 0, owed, totalCost };
}

interface CampRow {
  id: string;
  name: string;
}

export default function PlayersPage() {
  const { toast } = useToast();
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [bookings, setBookings] = useState<SyncedBookingRow[]>([]);
  const [camps, setCamps] = useState<CampRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [materializing, setMaterializing] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [merging, setMerging] = useState(false);
  const [search, setSearch] = useState("");
  const [showOnlyUnmaterialized, setShowOnlyUnmaterialized] = useState(false);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [counts, setCounts] = useState({ totalPlayers: 0, totalBookings: 0, unmaterialized: 0, medical: 0, unpaid: 0 });
  const [duplicateGroups, setDuplicateGroups] = useState(0);

  const loadCounts = useCallback(async () => {
    const [playersRes, bookingsRes, unmatRes, medRes, unpaidRes] = await Promise.all([
      supabase.from("players").select("id", { count: "exact", head: true }),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).not("matched_player_id", "is", null),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).is("matched_player_id", null),
      supabase.from("players").select("id", { count: "exact", head: true }).not("medical_notes", "is", null).neq("medical_notes", ""),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).not("matched_player_id", "is", null).or("payment_status.in.(pending,partial),amount_owed.gt.0"),
    ]);
    setCounts({
      totalPlayers: playersRes.count || 0,
      totalBookings: bookingsRes.count || 0,
      unmaterialized: unmatRes.count || 0,
      medical: medRes.count || 0,
      unpaid: unpaidRes.count || 0,
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: playersData } = await supabase
      .from("players")
      .select("id, first_name, last_name, date_of_birth, medical_notes, kit_size, photo_permission, identity_key, guardian_email, guardian_phone")
      .order("last_name");

    const playerRows = (playersData || []) as PlayerRow[];
    setPlayers(playerRows);

    const duplicates = new Map<string, number>();
    for (const player of playerRows) {
      if (!player.identity_key) continue;
      duplicates.set(player.identity_key, (duplicates.get(player.identity_key) || 0) + 1);
    }
    setDuplicateGroups(Array.from(duplicates.values()).filter((count) => count > 1).length);

    const playerIds = playerRows.map((player) => player.id);
    let bookingRows: SyncedBookingRow[] = [];
    const batchSize = 100;
    for (let i = 0; i < playerIds.length; i += batchSize) {
      const batch = playerIds.slice(i, i + batchSize);
      if (!batch.length) continue;
      const { data } = await supabase
        .from("synced_bookings")
        .select("id, external_booking_id, matched_player_id, matched_camp_id, payment_status, parent_name, parent_phone, parent_email, camp_name, total_amount, sibling_discount, amount_paid, refund_amount")
        .in("matched_player_id", batch);
      if (data) bookingRows = bookingRows.concat(data as SyncedBookingRow[]);
    }
    setBookings(bookingRows);

    const campIds = [...new Set(bookingRows.map((booking) => booking.matched_camp_id).filter(Boolean))] as string[];
    let campRows: CampRow[] = [];
    for (let i = 0; i < campIds.length; i += batchSize) {
      const batch = campIds.slice(i, i + batchSize);
      const { data } = await supabase.from("camps").select("id, name").in("id", batch);
      if (data) campRows = campRows.concat(data as CampRow[]);
    }
    setCamps(campRows);
    await loadCounts();
    setLoading(false);
  }, [loadCounts]);

  useEffect(() => {
    load();
  }, [load]);

  const campMap = useMemo(() => new Map(camps.map((camp) => [camp.id, camp.name])), [camps]);
  const getPlayerBookings = useCallback((playerId: string) => bookings.filter((booking) => booking.matched_player_id === playerId), [bookings]);

  const visiblePlayers = useMemo(() => {
    let list = players;
    if (showOnlyUnmaterialized) return [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((player) =>
        `${player.first_name} ${player.last_name}`.toLowerCase().includes(q) ||
        player.guardian_email?.toLowerCase().includes(q) ||
        player.medical_notes?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [players, search, showOnlyUnmaterialized]);

  const runMaterialize = async (failedOnly = false) => {
    setMaterializing(true);
    const body = failedOnly ? { externalBookingIds: bookings.map((b) => b.external_booking_id).filter(Boolean) } : undefined;
    const { data, error } = await supabase.functions.invoke("materialize-players", body ? { body } : undefined);
    setMaterializing(false);

    if (error) {
      toast({ title: "Materialization failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: failedOnly ? "Retried failed materialization" : "Players materialised",
      description: `Processed: ${data?.processed || 0}, Created: ${data?.created_players || 0}, Linked: ${data?.linked_players || 0}, Failed: ${data?.failed || 0}`,
    });

    if ((data?.failed || 0) > 0) setErrorsOpen(true);
    await load();
  };

  const handleMerge = async () => {
    setMerging(true);
    const { data, error } = await supabase.functions.invoke("merge-duplicate-players");
    setMerging(false);
    setMergeOpen(false);
    if (error) {
      toast({ title: "Merge failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Merge complete",
      description: `Groups merged: ${data?.groups_merged || 0}, Players deleted: ${data?.players_deleted || 0}, Bookings relinked: ${data?.bookings_relinked || 0}`,
    });
    await load();
  };

  const handleRecalculatePayments = async () => {
    setRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("recalculate-payment-status");
      if (error) throw error;
      const c = data?.counts;
      toast({
        title: "Payment status recalculated",
        description: `${c?.updated || 0} rows updated — Paid: ${c?.paid || 0}, Pending: ${c?.pending || 0}, Partial: ${c?.partial || 0}, Refunded: ${c?.refunded || 0}`,
      });
      await load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Recalculation failed";
      toast({ title: "Recalculation failed", description: message, variant: "destructive" });
    } finally {
      setRecalculating(false);
    }
  };

  const paymentVariant = (status: string | null) => {
    const value = status?.toLowerCase();
    if (value === "paid") return "secondary" as const;
    if (value === "refunded") return "outline" as const;
    return "destructive" as const;
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading players…</div>;

  return (
    <div className="space-y-8">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1>Players & Bookings</h1>
          <p>All registered players and their camp bookings</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => runMaterialize(false)} disabled={materializing} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${materializing ? "animate-spin" : ""}`} />
            {materializing ? "Running…" : "Create/Update Players"}
          </Button>
          <Button onClick={() => runMaterialize(true)} disabled={materializing} variant="outline" size="sm">
            Retry materialization for failed rows
          </Button>
          {duplicateGroups > 0 && (
            <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
              Merge Duplicate Players ({duplicateGroups})
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setErrorsOpen(true)}>
            <Eye className="mr-1.5 h-4 w-4" /> View Errors
          </Button>
          <Button variant="outline" size="sm" onClick={handleRecalculatePayments} disabled={recalculating}>
            <RefreshCw className={`mr-2 h-4 w-4 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculating…" : "Recalculate Payments"}
          </Button>
        </div>
      </div>

      {duplicateGroups > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <TriangleAlert className="h-4 w-4 text-foreground shrink-0" />
          <p className="text-sm text-foreground">
            <strong>{duplicateGroups} duplicate group{duplicateGroups > 1 ? "s" : ""}</strong> detected. Merge them to consolidate bookings under one player record.
          </p>
        </div>
      )}

      <div className="stat-grid">
        <StatCard title="Total Players" value={counts.totalPlayers} icon={Users} />
        <StatCard title="Total Bookings" value={counts.totalBookings} icon={Users} description="Matched synced bookings" />
        <StatCard title="Unmaterialized" value={counts.unmaterialized} icon={AlertCircle} variant={counts.unmaterialized > 0 ? "warning" : "default"} />
        <StatCard title="Medical Notes" value={counts.medical} icon={Heart} variant={counts.medical > 0 ? "warning" : "default"} />
        <StatCard title="Unpaid" value={counts.unpaid} icon={AlertCircle} variant={counts.unpaid > 0 ? "destructive" : "success"} />
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, email, medical…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Button variant={showOnlyUnmaterialized ? "default" : "outline"} size="sm" onClick={() => setShowOnlyUnmaterialized((prev) => !prev)}>
          Show only unmaterialized
        </Button>
        <Badge variant="secondary">{showOnlyUnmaterialized ? counts.unmaterialized : visiblePlayers.length} {showOnlyUnmaterialized ? "unmaterialized" : `of ${counts.totalPlayers} players`}</Badge>
      </div>

      {showOnlyUnmaterialized ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            There are <strong className="text-foreground">{counts.unmaterialized}</strong> unmaterialized bookings. Use <strong className="text-foreground">Create/Update Players</strong> or <strong className="text-foreground">Retry materialization for failed rows</strong> to link them.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>DOB</TableHead>
                  <TableHead>Kit</TableHead>
                  <TableHead>Medical</TableHead>
                  <TableHead>Photo</TableHead>
                  <TableHead>Guardian</TableHead>
                  <TableHead>Camps & Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePlayers.map((player) => {
                  const playerBookings = getPlayerBookings(player.id);
                  return (
                    <TableRow key={player.id}>
                      <TableCell className="font-medium text-sm">{player.first_name} {player.last_name}</TableCell>
                      <TableCell className="text-sm">{player.date_of_birth || "N/A"}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-xs">{player.kit_size}</Badge></TableCell>
                      <TableCell className="max-w-56">
                        {player.medical_notes ? (
                          <span className="flex items-center gap-1 text-xs text-destructive"><Heart className="h-3 w-3 shrink-0" />{player.medical_notes}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {player.photo_permission ? <Camera className="h-4 w-4 text-muted-foreground" /> : <CameraOff className="h-4 w-4 text-destructive" />}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {playerBookings[0] ? (
                          <div>
                            <p className="text-sm font-medium text-foreground">{playerBookings[0].parent_name || "—"}</p>
                            <p>{playerBookings[0].parent_phone || "—"}</p>
                            {playerBookings[0].parent_email && <p>{playerBookings[0].parent_email}</p>}
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {playerBookings.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            playerBookings.map((booking) => {
                              const fin = derivePaymentStatus(booking);
                              return (
                                <div key={booking.id} className="inline-flex flex-col items-start">
                                  <Badge variant={paymentVariant(fin.status.toLowerCase())} className="text-[10px]" title={`Paid: €${fin.paid} · Owed: €${fin.owed}`}>
                                    {(booking.matched_camp_id && campMap.get(booking.matched_camp_id)) || booking.camp_name || "Unknown"} • {fin.status}
                                  </Badge>
                                  {fin.totalCost > 0 && (
                                    <span className="text-[9px] text-muted-foreground ml-1">€{fin.paid} paid · €{fin.owed} owed</span>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {visiblePlayers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No players match your filters.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Merge Duplicate Players</DialogTitle>
            <DialogDescription>
              This keeps the earliest player in each duplicate group, relinks bookings, and removes duplicate player rows.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button onClick={handleMerge} disabled={merging}>{merging ? "Merging…" : "Merge Duplicate Players"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportErrorsDrawer open={errorsOpen} onOpenChange={setErrorsOpen} errorCode="materialize_players" onRefresh={load} />
    </div>
  );
}