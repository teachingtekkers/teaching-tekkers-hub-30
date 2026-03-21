import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Users, ClipboardCheck, Heart, CameraOff, Shirt, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

interface CampRow {
  id: string;
  name: string;
  club_name: string;
  venue: string;
  county: string;
  start_date: string;
  end_date: string;
  daily_start_time: string;
  daily_end_time: string;
  age_group: string;
}

interface BookingRow {
  id: string;
  child_first_name: string;
  child_last_name: string;
  age: number | null;
  kit_size: string | null;
  medical_condition: string | null;
  medical_notes: string | null;
  photo_permission: boolean | null;
  payment_status: string | null;
}

export default function MyCampsPage() {
  const { user } = useAuth();
  const [camps, setCamps] = useState<CampRow[]>([]);
  const [bookingsMap, setBookingsMap] = useState<Record<string, BookingRow[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Get coach_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("coach_id")
        .eq("id", user.id)
        .single();

      if (!profile?.coach_id) { setLoading(false); return; }

      // Get assigned camp ids
      const { data: assignments } = await supabase
        .from("camp_coach_assignments")
        .select("camp_id")
        .eq("coach_id", profile.coach_id);

      const campIds = (assignments || []).map(a => a.camp_id);
      if (campIds.length === 0) { setLoading(false); return; }

      // Get camps
      const { data: campData } = await supabase
        .from("camps")
        .select("id, name, club_name, venue, county, start_date, end_date, daily_start_time, daily_end_time, age_group")
        .in("id", campIds)
        .order("start_date", { ascending: false });

      const myCamps = (campData || []) as CampRow[];
      setCamps(myCamps);

      // Get bookings for all camps
      const { data: bookings } = await supabase
        .from("synced_bookings")
        .select("id, child_first_name, child_last_name, age, kit_size, medical_condition, medical_notes, photo_permission, payment_status, matched_camp_id")
        .in("matched_camp_id", campIds)
        .order("child_last_name");

      const map: Record<string, BookingRow[]> = {};
      for (const b of (bookings || []) as any[]) {
        const cid = b.matched_camp_id;
        if (!map[cid]) map[cid] = [];
        map[cid].push(b);
      }
      setBookingsMap(map);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-xl font-bold text-foreground">My Camps</h1>
        <p className="text-sm text-muted-foreground">Your assigned camps and player lists</p>
      </div>

      {camps.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">No camps assigned to you yet</p>
            <p className="text-sm text-muted-foreground mt-1">Check back later for your assignments.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {camps.map(camp => {
            const players = bookingsMap[camp.id] || [];
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
                    <p className="flex items-center gap-1.5"><Users className="h-3 w-3 shrink-0" />{players.length} players</p>
                    <p>{camp.daily_start_time} — {camp.daily_end_time}</p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Player List</p>
                    {players.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No players booked yet.</p>
                    ) : (
                      <div className="divide-y rounded-lg border max-h-64 overflow-y-auto">
                        {players.map(player => {
                          const hasMedical = !!(player.medical_condition || player.medical_notes);
                          const noPhoto = player.photo_permission === false;
                          return (
                            <div key={player.id} className="px-3 py-2 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{player.child_first_name} {player.child_last_name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {player.age != null && <span className="text-[10px] text-muted-foreground">Age {player.age}</span>}
                                  {hasMedical && (
                                    <span className="text-[10px] text-destructive flex items-center gap-0.5">
                                      <Heart className="h-2.5 w-2.5" /> Medical
                                    </span>
                                  )}
                                  {noPhoto && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                      <CameraOff className="h-2.5 w-2.5" /> No photo
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Badge variant="secondary" className="text-[10px]">
                                  <Shirt className="h-2.5 w-2.5 mr-0.5" />{player.kit_size || "M"}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <Link
                    to="/coach/attendance"
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
}
