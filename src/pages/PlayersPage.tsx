import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Users, AlertCircle, Camera, CameraOff, Heart, RefreshCw, Eye, Search, Merge, AlertTriangle } from "lucide-react";
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
  matched_player_id: string | null;
  matched_camp_id: string | null;
  payment_status: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  camp_name: string;
}

interface CampRow {
  id: string;
  name: string;
}

const PlayersPage = () => {
  const { toast } = useToast();
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [bookings, setBookings] = useState<SyncedBookingRow[]>([]);
  const [camps, setCamps] = useState<CampRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [materializing, setMaterializing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [errorsOpen, setErrorsOpen] = useState(false);

  // Exact counts from DB
  const [counts, setCounts] = useState({
    totalPlayers: 0,
    totalBookings: 0,
    unmaterialized: 0,
    medical: 0,
    unpaid: 0,
  });
  const [dupCount, setDupCount] = useState(0);

  const loadCounts = useCallback(async () => {
    const [playersRes, bookingsRes, unmatRes, medRes, unpaidRes] = await Promise.all([
      supabase.from("players").select("id", { count: "exact", head: true }),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).not("matched_player_id", "is", null),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).is("matched_player_id", null),
      supabase.from("players").select("id", { count: "exact", head: true }).not("medical_notes", "is", null).neq("medical_notes", ""),
      supabase.from("synced_bookings").select("id", { count: "exact", head: true }).not("matched_player_id", "is", null).neq("payment_status", "paid"),
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

    const allPlayers = (playersData || []) as unknown as PlayerRow[];
    setPlayers(allPlayers);

    // Check for duplicates
    const keyCount = new Map<string, number>();
    for (const p of allPlayers) {
      if (p.identity_key) {
        keyCount.set(p.identity_key, (keyCount.get(p.identity_key) || 0) + 1);
      }
    }
    let dups = 0;
    for (const c of keyCount.values()) if (c > 1) dups++;
    setDupCount(dups);

    const playerIds = allPlayers.map(p => p.id);

    // Fetch synced bookings for loaded player IDs
    let allBookings: SyncedBookingRow[] = [];
    const BATCH = 100;
    for (let i = 0; i < playerIds.length; i += BATCH) {
      const batch = playerIds.slice(i, i + BATCH);
      const { data } = await supabase
        .from("synced_bookings")
        .select("id, matched_player_id, matched_camp_id, payment_status, parent_name, parent_phone, parent_email, camp_name")
        .in("matched_player_id", batch);
      if (data) allBookings = allBookings.concat(data);
    }
    setBookings(allBookings);

    const campIds = [...new Set(allBookings.filter(b => b.matched_camp_id).map(b => b.matched_camp_id!))];
    let allCamps: CampRow[] = [];
    for (let i = 0; i < campIds.length; i += BATCH) {
      const batch = campIds.slice(i, i + BATCH);
      const { data } = await supabase.from("camps").select("id, name").in("id", batch);
      if (data) allCamps = allCamps.concat(data);
    }
    setCamps(allCamps);

    setLoading(false);
    await loadCounts();
  }, [loadCounts]);

  useEffect(() => { load(); }, [load]);

  const campMap = new Map(camps.map(c => [c.id, c.name]));

  const getPlayerBookings = (playerId: string) =>
    bookings.filter(b => b.matched_player_id === playerId);

  const filteredPlayers = useMemo(() => {
    if (!search) return players;
    const q = search.toLowerCase();
    return players.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      p.guardian_email?.toLowerCase().includes(q) ||
      p.medical_notes?.toLowerCase().includes(q)
    );
  }, [players, search]);

  const handleMaterialize = async () => {
    setMaterializing(true);
    const { data, error } = await supabase.functions.invoke("materialize-players");
    setMaterializing(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const failed = data?.failed || 0;
    toast({
      title: "Players materialised",
      description: `Processed: ${data?.processed || 0}, Linked: ${data?.linked || 0}, Skipped: ${data?.skipped || 0}${failed > 0 ? `, Failed: ${failed}` : ""}`,
    });
    if (failed > 0) setErrorsOpen(true);
    load();
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
    load();
  };

  const payBadgeVariant = (status: string | null) => {
    const s = status?.toLowerCase();
    if (s === "paid") return "secondary" as const;
    if (s === "refunded") return "outline" as const;
    return "destructive" as const;
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading players…</div>;
  }

  return (
    <div className="space-y-8">
      <div className="page-header flex items-start justify-between">
        <div>
          <h1>Players & Bookings</h1>
          <p>All registered players and their camp bookings</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleMaterialize} disabled={materializing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${materializing ? "animate-spin" : ""}`} />
            {materializing ? "Running…" : "Create/Update Players"}
          </Button>
          {dupCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
              <Merge className="h-4 w-4 mr-1.5" /> Merge Duplicates ({dupCount})
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setErrorsOpen(true)}>
            <Eye className="h-4 w-4 mr-1.5" /> View Errors
          </Button>
        </div>
      </div>

      {dupCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            <strong>{dupCount} duplicate player group{dupCount > 1 ? "s" : ""}</strong> detected. Click "Merge Duplicates" to consolidate.
          </p>
        </div>
      )}

      <div className="stat-grid">
        <StatCard title="Total Players" value={counts.totalPlayers} icon={Users} />
        <StatCard title="Total Bookings" value={counts.totalBookings} icon={Users} description="Matched synced bookings" />
        <StatCard title="Unmaterialized" value={counts.unmaterialized} icon={AlertCircle} variant={counts.unmaterialized > 0 ? "warning" : "default"} description="Bookings without a player" />
        <StatCard title="Medical Notes" value={counts.medical} icon={Heart} variant={counts.medical > 0 ? "warning" : "default"} />
        <StatCard title="Unpaid" value={counts.unpaid} icon={AlertCircle} variant={counts.unpaid > 0 ? "destructive" : "success"} />
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, email, medical…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <Badge variant="secondary">{filteredPlayers.length} of {counts.totalPlayers} players</Badge>
      </div>

      {/* Mobile */}
      <div className="grid gap-3 sm:hidden">
        {filteredPlayers.map(player => {
          const pBookings = getPlayerBookings(player.id);
          return (
            <Card key={player.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm">{player.first_name} {player.last_name}</p>
                    <p className="text-xs text-muted-foreground">DOB: {player.date_of_birth || "N/A"} • Kit: {player.kit_size}</p>
                  </div>
                  <div className="flex gap-1">
                    {player.medical_notes && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Medical</Badge>
                    )}
                    {player.photo_permission ? (
                      <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <CameraOff className="h-3.5 w-3.5 text-destructive" />
                    )}
                  </div>
                </div>
                {player.medical_notes && (
                  <p className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1">{player.medical_notes}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {pBookings.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  {pBookings.map(b => {
                    const cName = b.matched_camp_id ? campMap.get(b.matched_camp_id) : b.camp_name;
                    return (
                      <Badge key={b.id} variant={payBadgeVariant(b.payment_status)} className="text-[10px]">
                        {cName || "Unknown"} • {b.payment_status || "pending"}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop */}
      <Card className="hidden sm:block">
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
              {filteredPlayers.map(player => {
                const pBookings = getPlayerBookings(player.id);
                // Deduplicate camps: group bookings by camp, show one badge per camp
                const campGroups = new Map<string, { campName: string; statuses: string[] }>();
                for (const b of pBookings) {
                  const campId = b.matched_camp_id || b.camp_name;
                  const campName = b.matched_camp_id ? (campMap.get(b.matched_camp_id) || b.camp_name) : b.camp_name;
                  const existing = campGroups.get(campId) || { campName, statuses: [] };
                  existing.statuses.push(b.payment_status || "pending");
                  campGroups.set(campId, existing);
                }

                return (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium text-sm">{player.first_name} {player.last_name}</TableCell>
                    <TableCell className="text-sm">{player.date_of_birth || "N/A"}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{player.kit_size}</Badge></TableCell>
                    <TableCell className="max-w-48">
                      {player.medical_notes ? (
                        <span className="text-xs text-destructive flex items-center gap-1">
                          <Heart className="h-3 w-3 shrink-0" />{player.medical_notes}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {player.photo_permission ? (
                        <Camera className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <CameraOff className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {pBookings[0] ? (
                        <div>
                          <p className="font-medium text-foreground text-sm">{pBookings[0].parent_name}</p>
                          <p>{pBookings[0].parent_phone}</p>
                          {pBookings[0].parent_email && <p>{pBookings[0].parent_email}</p>}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {campGroups.size === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        {[...campGroups.entries()].map(([key, group]) => {
                          const allPaid = group.statuses.every(s => s.toLowerCase() === "paid");
                          const hasRefund = group.statuses.some(s => s.toLowerCase() === "refunded");
                          const variant = allPaid ? "secondary" : hasRefund ? "outline" : "destructive";
                          const statusLabel = allPaid ? "Paid" : hasRefund ? "Refunded" : "Unpaid";
                          return (
                            <Badge key={key} variant={variant as any} className="text-[10px]">
                              {group.campName} • {statusLabel}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredPlayers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {players.length === 0
                      ? 'No players yet. Click "Create/Update Players" to materialise players.'
                      : "No players match your search."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Merge confirmation dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5" /> Merge Duplicate Players
            </DialogTitle>
            <DialogDescription>
              This will find players with the same identity key, keep the earliest record, relink all bookings and attendance to it, and delete the duplicates. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setMergeOpen(false)}>Cancel</Button>
            <Button onClick={handleMerge} disabled={merging}>
              {merging ? "Merging…" : `Merge ${dupCount} duplicate group${dupCount > 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportErrorsDrawer
        open={errorsOpen}
        onOpenChange={setErrorsOpen}
        errorCode="materialize_players"
        onRefresh={load}
      />
    </div>
  );
};

export default PlayersPage;
