import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, AlertCircle, Camera, CameraOff, Heart, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlayerRow {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  medical_notes: string | null;
  kit_size: string;
  photo_permission: boolean;
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

  const load = useCallback(async () => {
    setLoading(true);

    const { data: playersData } = await supabase
      .from("players")
      .select("id, first_name, last_name, date_of_birth, medical_notes, kit_size, photo_permission")
      .order("last_name");

    const playerIds = (playersData || []).map(p => p.id);
    setPlayers(playersData || []);

    // Fetch synced bookings only for loaded player IDs
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

    // Fetch camps for matched_camp_id
    const campIds = [...new Set(allBookings.filter(b => b.matched_camp_id).map(b => b.matched_camp_id!))];
    let allCamps: CampRow[] = [];
    for (let i = 0; i < campIds.length; i += BATCH) {
      const batch = campIds.slice(i, i + BATCH);
      const { data } = await supabase
        .from("camps")
        .select("id, name")
        .in("id", batch);
      if (data) allCamps = allCamps.concat(data);
    }
    setCamps(allCamps);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const campMap = new Map(camps.map(c => [c.id, c.name]));

  const getPlayerBookings = (playerId: string) =>
    bookings.filter(b => b.matched_player_id === playerId);

  const unpaidCount = bookings.filter(b => b.payment_status !== "paid" && b.payment_status !== "Paid").length;
  const medicalCount = players.filter(p => p.medical_notes).length;

  const handleMaterialize = async () => {
    setMaterializing(true);
    const { data, error } = await supabase.functions.invoke("materialize-players");
    setMaterializing(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Players materialised",
      description: `Created: ${data.created}, Linked: ${data.linked}, Skipped: ${data.skipped}`,
    });
    load();
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
        <Button onClick={handleMaterialize} disabled={materializing} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${materializing ? "animate-spin" : ""}`} />
          {materializing ? "Running…" : "Create/Update Players from Synced Bookings"}
        </Button>
      </div>

      <div className="stat-grid">
        <StatCard title="Total Players" value={players.length} icon={Users} />
        <StatCard title="Total Bookings" value={bookings.length} icon={Users} description="Matched synced bookings" />
        <StatCard title="Medical Notes" value={medicalCount} icon={Heart} variant={medicalCount > 0 ? "warning" : "default"} />
        <StatCard title="Unpaid" value={unpaidCount} icon={AlertCircle} variant={unpaidCount > 0 ? "destructive" : "success"} />
      </div>

      {/* Mobile */}
      <div className="grid gap-3 sm:hidden">
        {players.map(player => {
          const pBookings = getPlayerBookings(player.id);
          return (
            <Card key={player.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-sm">{player.first_name} {player.last_name}</p>
                    <p className="text-xs text-muted-foreground">DOB: {player.date_of_birth} • Kit: {player.kit_size}</p>
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
                  {pBookings.map(b => {
                    const cName = b.matched_camp_id ? campMap.get(b.matched_camp_id) : b.camp_name;
                    const isPaid = b.payment_status?.toLowerCase() === "paid";
                    return (
                      <Badge key={b.id} variant={isPaid ? "secondary" : "destructive"} className="text-[10px]">
                        {cName || "Unknown"} {!isPaid && "• Unpaid"}
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
              {players.map(player => {
                const pBookings = getPlayerBookings(player.id);
                return (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium text-sm">{player.first_name} {player.last_name}</TableCell>
                    <TableCell className="text-sm">{player.date_of_birth}</TableCell>
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
                        <Camera className="h-4 w-4 text-[hsl(var(--success))]" />
                      ) : (
                        <CameraOff className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {pBookings[0] ? (
                        <div>
                          <p className="font-medium text-foreground text-sm">{pBookings[0].parent_name}</p>
                          <p>{pBookings[0].parent_phone}</p>
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {pBookings.map(b => {
                          const cName = b.matched_camp_id ? campMap.get(b.matched_camp_id) : b.camp_name;
                          const isPaid = b.payment_status?.toLowerCase() === "paid";
                          return (
                            <Badge key={b.id} variant={isPaid ? "secondary" : "destructive"} className="text-[10px]">
                              {cName || "Unknown"} {!isPaid && "• Unpaid"}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {players.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No players yet. Click "Create/Update Players from Synced Bookings" to materialise players.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlayersPage;
