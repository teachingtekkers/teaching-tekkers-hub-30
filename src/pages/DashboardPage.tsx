import { Tent, Users, UserCog, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockCamps, mockBookings, mockCoaches } from "@/data/mock";

const DashboardPage = () => {
  // Camps this week (mock: current date = 2026-03-09)
  const thisWeekCamps = mockCamps.filter(c => c.start_date <= '2026-03-13' && c.end_date >= '2026-03-09');
  const thisWeekPlayerCount = mockBookings.filter(b => thisWeekCamps.some(c => c.id === b.camp_id)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back. Here's what's happening this week.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Camps This Week" value={thisWeekCamps.length} icon={Tent} description="Active camps running" />
        <StatCard title="Players This Week" value={thisWeekPlayerCount} icon={Users} description="Registered players" />
        <StatCard title="Total Coaches" value={mockCoaches.length} icon={UserCog} description="On the roster" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">This Week's Camps</CardTitle>
            <Link to="/camps" className="text-sm text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {thisWeekCamps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No camps this week.</p>
            ) : (
              <div className="space-y-3">
                {thisWeekCamps.map(camp => (
                  <div key={camp.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{camp.name}</p>
                      <p className="text-sm text-muted-foreground">{camp.club_name} • {camp.venue}</p>
                    </div>
                    <Badge variant="secondary">{camp.age_group}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Manage Camps", to: "/camps", icon: Tent },
              { label: "View Players", to: "/players", icon: Users },
              { label: "Manage Coaches", to: "/coaches", icon: UserCog },
            ].map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent transition-colors"
              >
                <link.icon className="h-5 w-5 text-primary" />
                <span className="font-medium">{link.label}</span>
                <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
