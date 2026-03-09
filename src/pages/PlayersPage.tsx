import { mockPlayers, mockBookings, mockCamps } from "@/data/mock";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, AlertCircle, Camera, CameraOff, Heart } from "lucide-react";

const PlayersPage = () => {
  const getPlayerCamps = (playerId: string) => {
    const bookings = mockBookings.filter(b => b.player_id === playerId);
    return bookings.map(b => {
      const camp = mockCamps.find(c => c.id === b.camp_id);
      return { camp, booking: b };
    });
  };

  const unpaidCount = mockBookings.filter(b => b.payment_status !== 'paid').length;
  const medicalCount = mockPlayers.filter(p => p.medical_notes).length;

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1>Players & Bookings</h1>
        <p>All registered players and their camp bookings</p>
      </div>

      <div className="stat-grid">
        <StatCard title="Total Players" value={mockPlayers.length} icon={Users} />
        <StatCard title="Total Bookings" value={mockBookings.length} icon={Users} description="Across all camps" />
        <StatCard title="Medical Notes" value={medicalCount} icon={Heart} variant={medicalCount > 0 ? "warning" : "default"} />
        <StatCard title="Unpaid" value={unpaidCount} icon={AlertCircle} variant={unpaidCount > 0 ? "destructive" : "success"} />
      </div>

      {/* Mobile */}
      <div className="grid gap-3 sm:hidden">
        {mockPlayers.map(player => {
          const campData = getPlayerCamps(player.id);
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
                  {campData.map(({ camp, booking }) => (
                    <Badge key={booking.id} variant={booking.payment_status === 'paid' ? 'secondary' : 'destructive'} className="text-[10px]">
                      {camp?.name} {booking.payment_status !== 'paid' && '• Unpaid'}
                    </Badge>
                  ))}
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
              {mockPlayers.map(player => {
                const campData = getPlayerCamps(player.id);
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
                      {campData[0] ? (
                        <div>
                          <p className="font-medium text-foreground text-sm">{campData[0].booking.parent_name}</p>
                          <p>{campData[0].booking.parent_phone}</p>
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {campData.map(({ camp, booking }) => (
                          <Badge key={booking.id} variant={booking.payment_status === 'paid' ? 'secondary' : 'destructive'} className="text-[10px]">
                            {camp?.name} {booking.payment_status !== 'paid' && '• Unpaid'}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlayersPage;
