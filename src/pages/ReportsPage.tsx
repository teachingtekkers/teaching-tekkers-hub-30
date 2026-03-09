import { useState, useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/StatCard";
import { mockCamps, mockBookings, mockPayrollRecords, mockClubInvoices, mockHistoricalCamps } from "@/data/mock";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const SEASONS = ["2024", "2025", "2026"];
const COUNTIES = ["All", ...new Set(mockCamps.map(c => c.county))];
const CLUBS = ["All", ...new Set(mockCamps.map(c => c.club_name))];

const ReportsPage = () => {
  const [seasonFilter, setSeasonFilter] = useState("2026");
  const [countyFilter, setCountyFilter] = useState("All");
  const [clubFilter, setClubFilter] = useState("All");

  // Filtered camps
  const filteredCamps = useMemo(() => {
    return mockCamps.filter(c => {
      const year = c.start_date.substring(0, 4);
      if (year !== seasonFilter) return false;
      if (countyFilter !== "All" && c.county !== countyFilter) return false;
      if (clubFilter !== "All" && c.club_name !== clubFilter) return false;
      return true;
    });
  }, [seasonFilter, countyFilter, clubFilter]);

  const filteredBookings = useMemo(() => {
    const campIds = filteredCamps.map(c => c.id);
    return mockBookings.filter(b => campIds.includes(b.camp_id));
  }, [filteredCamps]);

  const totalCamps = filteredCamps.length;
  const totalPlayers = filteredBookings.length;
  const avgCampSize = totalCamps > 0 ? Math.round(totalPlayers / totalCamps) : 0;
  const totalRevenue = filteredBookings.reduce((sum, b) => {
    const camp = filteredCamps.find(c => c.id === b.camp_id);
    return sum + (camp?.price_per_child || 0);
  }, 0);

  const totalPayroll = mockPayrollRecords
    .filter(p => filteredCamps.some(c => c.id === p.camp_id))
    .reduce((s, p) => s + p.total_amount, 0);

  const totalClubPayments = mockClubInvoices
    .filter(i => filteredCamps.some(c => c.id === i.camp_id))
    .reduce((s, i) => s + (i.manual_amount ?? i.total_amount), 0);

  // Growth data
  const clubs = [...new Set(mockHistoricalCamps.map(h => h.club_name))];
  const growthData = clubs.map(club => {
    const years = mockHistoricalCamps.filter(h => h.club_name === club).sort((a, b) => a.year - b.year);
    const latest = years[years.length - 1];
    const prev = years.length >= 2 ? years[years.length - 2] : null;
    const growth = prev ? ((latest.players - prev.players) / prev.players) * 100 : 0;
    return { club, years, growth };
  });

  // Chart data
  const chartData = SEASONS.map(year => {
    const entry: Record<string, string | number> = { year };
    clubs.forEach(club => {
      const record = mockHistoricalCamps.find(h => h.club_name === club && h.year === Number(year));
      entry[club] = record?.players || 0;
    });
    return entry;
  });

  const CHART_COLORS = ["hsl(213, 94%, 45%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Operational insights and camp growth</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={seasonFilter} onValueChange={setSeasonFilter}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>{SEASONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={countyFilter} onValueChange={setCountyFilter}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>{COUNTIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={clubFilter} onValueChange={setClubFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>{CLUBS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Camps</p><p className="text-2xl font-bold">{totalCamps}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Players</p><p className="text-2xl font-bold">{totalPlayers}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Avg Size</p><p className="text-2xl font-bold">{avgCampSize}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Revenue</p><p className="text-2xl font-bold">€{totalRevenue.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Payroll</p><p className="text-2xl font-bold">€{totalPayroll.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Club Payments</p><p className="text-2xl font-bold">€{totalClubPayments.toLocaleString()}</p></CardContent></Card>
      </div>

      {/* Growth Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Player Growth by Club</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="year" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                {clubs.map((club, i) => (
                  <Bar key={club} dataKey={club} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Growth Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Camp Growth Overview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Club</TableHead>
                {SEASONS.map(y => <TableHead key={y}>{y} Players</TableHead>)}
                <TableHead>Growth</TableHead>
                <TableHead>Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {growthData.map(({ club, years, growth }) => (
                <TableRow key={club}>
                  <TableCell className="font-medium">{club}</TableCell>
                  {SEASONS.map(y => {
                    const record = years.find(yr => yr.year === Number(y));
                    return <TableCell key={y}>{record?.players || "—"}</TableCell>;
                  })}
                  <TableCell>
                    <span className={growth > 0 ? "text-[hsl(var(--success))]" : growth < 0 ? "text-destructive" : ""}>
                      {growth > 0 ? "+" : ""}{growth.toFixed(0)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    {growth > 0 ? <TrendingUp className="h-4 w-4 text-[hsl(var(--success))]" /> :
                     growth < 0 ? <TrendingDown className="h-4 w-4 text-destructive" /> :
                     <Minus className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
