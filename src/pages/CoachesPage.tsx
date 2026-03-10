import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/StatCard";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Car, UserCog, Fuel, Shield, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CoachRow {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  county: string;
  can_drive: boolean;
  is_head_coach: boolean;
  role_type: string;
  daily_rate: number;
  head_coach_daily_rate: number;
  fuel_allowance_eligible: boolean;
  status: string;
  date_of_birth: string | null;
}

function getAge(dob: string | null): number | null {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const CoachesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchCoaches = async () => {
    const { data, error } = await supabase
      .from("coaches")
      .select("id, full_name, phone, email, county, can_drive, is_head_coach, role_type, daily_rate, head_coach_daily_rate, fuel_allowance_eligible, status, date_of_birth")
      .order("full_name");
    if (error) {
      toast({ title: "Error loading coaches", description: error.message, variant: "destructive" });
    } else {
      setCoaches((data as CoachRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCoaches(); }, []);

  const filtered = coaches.filter(c => {
    const q = search.toLowerCase();
    return c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.county || "").toLowerCase().includes(q) ||
      (c.role_type || "").toLowerCase().includes(q);
  });

  const activeCoaches = coaches.filter(c => c.status === "active");
  const headCoachCount = coaches.filter(c => c.is_head_coach || c.role_type === "head_coach").length;
  const driverCount = coaches.filter(c => c.can_drive).length;

  const roleBadge = (coach: CoachRow) => {
    const rt = coach.role_type || (coach.is_head_coach ? "head_coach" : "assistant");
    if (rt === "head_coach") return <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Head Coach</Badge>;
    if (rt === "helper") return <Badge variant="secondary" className="text-xs">Helper</Badge>;
    return <Badge variant="outline" className="text-xs">Assistant</Badge>;
  };

  const statusBadge = (status: string) => {
    if (status === "active") return <Badge className="text-[10px] bg-success/10 text-success border-success/20">Active</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Inactive</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="page-header !mb-0">
          <h1>Coach Profiles</h1>
          <p>Manage your coaching team</p>
        </div>
        <Button size="sm" onClick={() => navigate("/coaches/new")}>
          <Plus className="mr-2 h-4 w-4" /> Add Coach
        </Button>
      </div>

      <div className="stat-grid">
        <StatCard title="Active Coaches" value={activeCoaches.length} icon={UserCog} />
        <StatCard title="Head Coaches" value={headCoachCount} icon={Shield} />
        <StatCard title="Drivers" value={driverCount} icon={Car} />
        <StatCard title="Fuel Eligible" value={coaches.filter(c => c.fuel_allowance_eligible).length} icon={Fuel} />
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search coaches…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Mobile */}
      <div className="grid gap-3 sm:hidden">
        {filtered.map(coach => {
          const age = getAge(coach.date_of_birth);
          return (
            <Card key={coach.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate(`/coaches/${coach.id}`)}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-xs font-semibold text-accent-foreground">
                      {coach.full_name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{coach.full_name}</p>
                      <p className="text-xs text-muted-foreground">{coach.county || "No county"}{age !== null ? ` • ${age}y` : ""}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 items-center">
                    {statusBadge(coach.status)}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {roleBadge(coach)}
                  {coach.can_drive && <Badge variant="secondary" className="text-[10px]"><Car className="h-3 w-3 mr-1" />Driver</Badge>}
                  {coach.fuel_allowance_eligible && <Badge variant="secondary" className="text-[10px]"><Fuel className="h-3 w-3 mr-1" />Fuel</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-2">€{coach.daily_rate}/day</p>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">No coaches found.</p>
        )}
      </div>

      {/* Desktop */}
      <Card className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Coach</TableHead>
              <TableHead>County</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-center">Driver</TableHead>
              <TableHead className="text-center">HC Eligible</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(coach => {
              const age = getAge(coach.date_of_birth);
              return (
                <TableRow key={coach.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/coaches/${coach.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-[10px] font-semibold text-accent-foreground shrink-0">
                        {coach.full_name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <span className="font-medium text-sm">{coach.full_name}</span>
                        {age !== null && <span className="text-xs text-muted-foreground ml-1.5">({age}y)</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{coach.county || "—"}</TableCell>
                  <TableCell>{roleBadge(coach)}</TableCell>
                  <TableCell className="text-center">
                    {coach.can_drive ? (
                      <Badge variant="secondary" className="text-[10px]"><Car className="h-3 w-3" /></Badge>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {(coach.is_head_coach || coach.role_type === "head_coach") ? (
                      <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">Yes</Badge>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    €{coach.daily_rate}
                    {coach.head_coach_daily_rate > 0 && <span className="text-muted-foreground"> / €{coach.head_coach_daily_rate}</span>}
                  </TableCell>
                  <TableCell className="text-center">{statusBadge(coach.status)}</TableCell>
                  <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {search ? "No coaches match your search." : "No coaches yet. Add your first coach to get started."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default CoachesPage;
