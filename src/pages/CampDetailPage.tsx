import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Users, MapPin, Calendar, Heart, Phone, Mail, AlertCircle } from "lucide-react";

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
}

interface Participant {
  id: string;
  child_first_name: string;
  child_last_name: string;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  emergency_contact: string | null;
  medical_notes: string | null;
  kit_size: string | null;
  payment_status: string | null;
  age: number | null;
  date_of_birth: string | null;
  camp_date: string | null;
  imported_at: string | null;
}

export default function CampDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [camp, setCamp] = useState<CampData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [cRes, pRes] = await Promise.all([
      supabase.from("camps").select("*").eq("id", id).single(),
      supabase
        .from("synced_bookings")
        .select("id, child_first_name, child_last_name, parent_name, parent_phone, parent_email, medical_notes, kit_size, payment_status, age")
        .eq("matched_camp_id", id)
        .order("child_last_name"),
    ]);
    if (cRes.data) setCamp(cRes.data as unknown as CampData);
    if (pRes.data) setParticipants(pRes.data as unknown as Participant[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!camp) return <div className="p-8 text-muted-foreground">Camp not found</div>;

  const payBadge = (s: string | null) => {
    if (s === "paid") return <Badge className="bg-emerald-100 text-emerald-800 border-0">Paid</Badge>;
    if (s === "pending") return <Badge className="bg-amber-100 text-amber-800 border-0">Pending</Badge>;
    return <Badge variant="secondary">{s || "—"}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{camp.name}</h1>
          <p className="text-sm text-muted-foreground">{camp.club_name}</p>
        </div>
      </div>

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
                  <TableHead>Parent</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Medical</TableHead>
                  <TableHead>Kit</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.child_first_name} {p.child_last_name}
                      {p.age && <span className="ml-1 text-xs text-muted-foreground">({p.age})</span>}
                    </TableCell>
                    <TableCell className="text-sm">{p.parent_name || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{p.parent_phone || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {p.medical_notes ? (
                        <span className="flex items-center gap-1 text-destructive">
                          <Heart className="h-3 w-3" /> {p.medical_notes}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{p.kit_size || "M"}</Badge></TableCell>
                    <TableCell>{payBadge(p.payment_status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
