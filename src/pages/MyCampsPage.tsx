import { mockCamps, mockCampCoaches, mockBookings, mockPlayers } from "@/data/mock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Users, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";

const MyCampsPage = () => {
  // For V1 demo, show camps assigned to coach ID '1' (Darren Byrne)
  const myCoachId = '1';
  const myAssignments = mockCampCoaches.filter(cc => cc.coach_id === myCoachId);
  const myCamps = myAssignments
    .map(a => mockCamps.find(c => c.id === a.camp_id)!)
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Camps</h1>
        <p className="text-muted-foreground">Your assigned camps and player lists</p>
      </div>

      {myCamps.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No camps assigned to you yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {myCamps.map(camp => {
            const campBookings = mockBookings.filter(b => b.camp_id === camp.id);
            const campPlayerList = campBookings
              .map(b => mockPlayers.find(p => p.id === b.player_id)!)
              .filter(Boolean);

            return (
              <Card key={camp.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{camp.name}</CardTitle>
                    <Badge variant="secondary">{camp.age_group}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{camp.club_name}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {camp.venue}, {camp.county}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {camp.start_date} — {camp.end_date}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-3 w-3" /> {campPlayerList.length} players
                    </div>
                    <div className="text-muted-foreground">
                      {camp.daily_start_time} — {camp.daily_end_time}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Player List</p>
                    <div className="divide-y rounded-lg border">
                      {campPlayerList.map(player => (
                        <div key={player.id} className="px-3 py-2">
                          <div className="flex justify-between items-start">
                            <p className="text-sm font-medium">{player.first_name} {player.last_name}</p>
                            <Badge variant="secondary" className="text-xs">{player.kit_size}</Badge>
                          </div>
                          {player.medical_notes && (
                            <p className="text-xs text-destructive mt-0.5">⚕ {player.medical_notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Link
                    to="/attendance"
                    className="flex items-center justify-center gap-2 rounded-lg border p-2.5 text-sm font-medium hover:bg-accent transition-colors"
                  >
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    Mark Attendance
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyCampsPage;
