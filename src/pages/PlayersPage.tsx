import { mockPlayers, mockBookings, mockCamps } from "@/data/mock";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const PlayersPage = () => {
  const getPlayerCamps = (playerId: string) => {
    const bookings = mockBookings.filter(b => b.player_id === playerId);
    return bookings.map(b => {
      const camp = mockCamps.find(c => c.id === b.camp_id);
      return { camp, booking: b };
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Players & Bookings</h1>
        <p className="text-muted-foreground">All registered players and their camp bookings</p>
      </div>

      {/* Mobile */}
      <div className="grid gap-4 sm:hidden">
        {mockPlayers.map(player => {
          const campData = getPlayerCamps(player.id);
          return (
            <Card key={player.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{player.first_name} {player.last_name}</p>
                    <p className="text-sm text-muted-foreground">DOB: {player.date_of_birth}</p>
                  </div>
                  <Badge variant="secondary">{player.kit_size}</Badge>
                </div>
                {player.medical_notes && (
                  <p className="text-sm text-destructive">⚕ {player.medical_notes}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {campData.map(({ camp, booking }) => (
                    <Badge key={booking.id} variant={booking.payment_status === 'paid' ? 'default' : 'destructive'}>
                      {camp?.name}
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
                <TableHead>Name</TableHead>
                <TableHead>DOB</TableHead>
                <TableHead>Kit</TableHead>
                <TableHead>Medical Notes</TableHead>
                <TableHead>Photo</TableHead>
                <TableHead>Camps</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPlayers.map(player => {
                const campData = getPlayerCamps(player.id);
                return (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium">{player.first_name} {player.last_name}</TableCell>
                    <TableCell>{player.date_of_birth}</TableCell>
                    <TableCell>{player.kit_size}</TableCell>
                    <TableCell className="max-w-48">
                      {player.medical_notes ? (
                        <span className="text-destructive text-sm">{player.medical_notes}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell>{player.photo_permission ? '✓' : '✗'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {campData.map(({ camp, booking }) => (
                          <Badge key={booking.id} variant={booking.payment_status === 'paid' ? 'default' : 'destructive'}>
                            {camp?.name}
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
