import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Search, Car, UserCog, Fuel, Shield, ChevronRight, ArrowUpDown, X, LayoutList } from "lucide-react";
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
  experience_level: string | null;
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

type SortKey = "name" | "county" | "rate_high" | "rate_low" | "drivers" | "head_coaches" | "active";
type GroupKey = "none" | "county" | "role" | "driver";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name A–Z" },
  { value: "county", label: "County" },
  { value: "rate_high", label: "Highest Rate" },
  { value: "rate_low", label: "Lowest Rate" },
  { value: "drivers", label: "Drivers First" },
  { value: "head_coaches", label: "Head Coaches First" },
  { value: "active", label: "Active First" },
];

const GROUP_OPTIONS: { value: GroupKey; label: string }[] = [
  { value: "none", label: "No Grouping" },
  { value: "county", label: "By County" },
  { value: "role", label: "By Role" },
  { value: "driver", label: "By Driver Status" },
];

const CoachesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCounty, setFilterCounty] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterDriver, setFilterDriver] = useState<string>("all");
  const [filterHC, setFilterHC] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterExperience, setFilterExperience] = useState<string>("all");

  // Sort & Group
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [groupBy, setGroupBy] = useState<GroupKey>("none");

  const fetchCoaches = async () => {
    const { data, error } = await supabase
      .from("coaches")
      .select("id, full_name, phone, email, county, can_drive, is_head_coach, role_type, experience_level, daily_rate, head_coach_daily_rate, fuel_allowance_eligible, status, date_of_birth")
      .order("full_name");
    if (error) {
      toast({ title: "Error loading coaches", description: error.message, variant: "destructive" });
    } else {
      setCoaches((data as CoachRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCoaches(); }, []);

  // Derived filter options
  const counties = useMemo(() => [...new Set(coaches.map(c => c.county).filter(Boolean))].sort(), [coaches]);
  const experienceLevels = useMemo(() => [...new Set(coaches.map(c => c.experience_level).filter(Boolean))].sort(), [coaches]);

  const getRole = (c: CoachRow) => c.role_type || (c.is_head_coach ? "head_coach" : "assistant");
  const isHC = (c: CoachRow) => c.is_head_coach || c.role_type === "head_coach";

  // Filter
  const filtered = useMemo(() => {
    return coaches.filter(c => {
      const q = search.toLowerCase();
      const matchesSearch = !q || c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.county || "").toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (filterCounty !== "all" && c.county !== filterCounty) return false;
      if (filterRole !== "all" && getRole(c) !== filterRole) return false;
      if (filterDriver !== "all" && String(c.can_drive) !== filterDriver) return false;
      if (filterHC !== "all" && String(isHC(c)) !== filterHC) return false;
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (filterExperience !== "all" && c.experience_level !== filterExperience) return false;
      return true;
    });
  }, [coaches, search, filterCounty, filterRole, filterDriver, filterHC, filterStatus, filterExperience]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "name": arr.sort((a, b) => a.full_name.localeCompare(b.full_name)); break;
      case "county": arr.sort((a, b) => (a.county || "zzz").localeCompare(b.county || "zzz")); break;
      case "rate_high": arr.sort((a, b) => b.daily_rate - a.daily_rate); break;
      case "rate_low": arr.sort((a, b) => a.daily_rate - b.daily_rate); break;
      case "drivers": arr.sort((a, b) => (b.can_drive ? 1 : 0) - (a.can_drive ? 1 : 0) || a.full_name.localeCompare(b.full_name)); break;
      case "head_coaches": arr.sort((a, b) => (isHC(b) ? 1 : 0) - (isHC(a) ? 1 : 0) || a.full_name.localeCompare(b.full_name)); break;
      case "active": arr.sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || a.full_name.localeCompare(b.full_name)); break;
    }
    return arr;
  }, [filtered, sortBy]);

  // Group
  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ label: null, coaches: sorted }];
    const map = new Map<string, CoachRow[]>();
    for (const c of sorted) {
      let key: string;
      switch (groupBy) {
        case "county": key = c.county || "No County"; break;
        case "role": key = getRole(c) === "head_coach" ? "Head Coach" : getRole(c) === "helper" ? "Helper" : "Assistant"; break;
        case "driver": key = c.can_drive ? "Drivers" : "Non-Drivers"; break;
        default: key = "Other";
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).map(([label, coaches]) => ({ label, coaches }));
  }, [sorted, groupBy]);

  const hasActiveFilters = filterCounty !== "all" || filterRole !== "all" || filterDriver !== "all" || filterHC !== "all" || filterStatus !== "all" || filterExperience !== "all";

  const clearFilters = () => {
    setFilterCounty("all"); setFilterRole("all"); setFilterDriver("all");
    setFilterHC("all"); setFilterStatus("all"); setFilterExperience("all");
    setSearch("");
  };

  const activeCoaches = coaches.filter(c => c.status === "active");
  const headCoachCount = coaches.filter(c => isHC(c)).length;
  const driverCount = coaches.filter(c => c.can_drive).length;

  const roleBadge = (coach: CoachRow) => {
    const rt = getRole(coach);
    if (rt === "head_coach") return <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Head Coach</Badge>;
    if (rt === "helper") return <Badge variant="secondary" className="text-xs">Helper</Badge>;
    return <Badge variant="outline" className="text-xs">Assistant</Badge>;
  };

  const statusBadge = (status: string) => {
    if (status === "active") return <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Inactive</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const renderTable = (rows: CoachRow[]) => (
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
        {rows.map(coach => {
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
                {coach.can_drive ? <Badge variant="secondary" className="text-[10px]"><Car className="h-3 w-3" /></Badge> : <span className="text-muted-foreground text-xs">—</span>}
              </TableCell>
              <TableCell className="text-center">
                {isHC(coach) ? <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">Yes</Badge> : <span className="text-muted-foreground text-xs">—</span>}
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
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No coaches match your filters.</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
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

      {/* Search + Sort + Group controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search coaches…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[160px] h-9">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupKey)}>
          <SelectTrigger className="w-[150px] h-9">
            <LayoutList className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterCounty} onValueChange={setFilterCounty}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="County" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Counties</SelectItem>
            {counties.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="head_coach">Head Coach</SelectItem>
            <SelectItem value="assistant">Assistant</SelectItem>
            <SelectItem value="helper">Helper</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDriver} onValueChange={setFilterDriver}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Driver" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">Drivers</SelectItem>
            <SelectItem value="false">Non-Drivers</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterHC} onValueChange={setFilterHC}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="HC Eligible" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="true">HC Eligible</SelectItem>
            <SelectItem value="false">Not HC</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {experienceLevels.length > 0 && (
          <Select value={filterExperience} onValueChange={setFilterExperience}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Experience" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {experienceLevels.map(e => <SelectItem key={e!} value={e!}>{e!.charAt(0).toUpperCase() + e!.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-xs gap-1">
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} of {coaches.length} coaches</span>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 sm:hidden">
        {sorted.map(coach => {
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
        {sorted.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No coaches found.</p>}
      </div>

      {/* Desktop table with grouping */}
      <div className="hidden sm:block space-y-4">
        {grouped.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold">{group.label}</h3>
                <Badge variant="outline" className="text-xs">{group.coaches.length}</Badge>
              </div>
            )}
            <Card className="mb-4">
              {renderTable(group.coaches)}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CoachesPage;
