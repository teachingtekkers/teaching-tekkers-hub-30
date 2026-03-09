import { mockCamps, mockCampCoaches, mockBookings, mockPlayers } from "@/data/mock";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Users, ClipboardCheck, Heart } from "lucide-react";
import { Link } from "react-router-dom";

const MyCampsPage = () => {
  const myCoachId = '1';
  const myAssignments = mockCampCoaches.filter(cc => cc.coach_id === myCoachId);
  const myCamps = myAssignments.map(a => mockCamps.find(c => c.id === a.camp_id)!).filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1>My Camps</h1>
        <p>Your assigned camps and player lists</p>
      </div>

      {myCamps.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">No camps assigned to you yet</p>
            <p className="text-sm text-muted-foreground mt-1">Check back later for your assignments.</p>
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
                <CardContent className="p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{camp.name}</h3>
                      <Badge variant="secondary" className="text-xs">{camp.age_group}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{camp.club_name}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0" />{camp.venue}</p>
                    <p className="flex items-center gap-1.5"><Calendar className="h-3 w-3 shrink-0" />{camp.start_date} — {camp.end_date}</p>
                    <p className="flex items-center gap-1.5"><Users className="h-3 w-3 shrink-0" />{campPlayerList.length} players</p>
                    <p>{camp.daily_start_time} — {camp.daily_end_time}</p>
                  </div>

                  <div>
                    <p className="section-label">Player List</p>
                    <div className="divide-y rounded-lg border">
                      {campPlayerList.map(player => (
                        <div key={player.id} className="px-3 py-2.5 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{player.first_name} {player.last_name}</p>
                            {player.medical_notes && (
                              <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                                <Heart className="h-2.5 w-2.5" />{player.medical_notes}
                              </p>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-[10px]">{player.kit_size}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Link
                    to="/attendance"
                    className="flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground p-3 text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <ClipboardCheck className="h-4 w-4" />
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
