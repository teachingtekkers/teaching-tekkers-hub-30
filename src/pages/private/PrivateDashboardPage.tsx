import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, Briefcase, CreditCard, UserCog, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { format, startOfWeek, endOfWeek } from "date-fns";

const DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function PrivateDashboardPage() {
  const today = new Date();
  const todayDay = DAYS_ORDER[today.getDay() === 0 ? 6 : today.getDay() - 1];
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const { data: venues = [] } = useQuery({
    queryKey: ["private-venues"],
    queryFn: async () => { const { data } = await supabase.from("private_venues").select("id, name, status"); return data || []; },
  });

  const { data: children = [] } = useQuery({
    queryKey: ["private-children"],
    queryFn: async () => { const { data } = await supabase.from("private_children").select("id, status"); return data || []; },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["private-sessions"],
    queryFn: async () => { const { data } = await supabase.from("private_session_groups").select("id, status, day_of_week, group_name, start_time, end_time, private_venues(name)").eq("status", "active"); return data || []; },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["private-payments"],
    queryFn: async () => { const { data } = await supabase.from("private_payments").select("id, amount_due, amount_paid, balance, payment_status"); return data || []; },
  });

  const { data: coachAssignments = [] } = useQuery({
    queryKey: ["private-coach-assignments"],
    queryFn: async () => { const { data } = await supabase.from("private_coach_assignments").select("*, coaches(full_name)"); return data || []; },
  });

  const { data: childAssignments = [] } = useQuery({
    queryKey: ["private-child-assignments-dash"],
    queryFn: async () => { const { data } = await supabase.from("private_child_assignments").select("session_group_id"); return data || []; },
  });

  const activeVenues = venues.filter((v: any) => v.status === "active").length;
  const activeChildren = children.filter((c: any) => c.status === "active").length;
  const totalSessions = sessions.length;
  const outstanding = payments.reduce((s: number, p: any) => s + (p.balance || 0), 0);
  const totalPaid = payments.reduce((s: number, p: any) => s + (p.amount_paid || 0), 0);
  const totalDue = payments.reduce((s: number, p: any) => s + (p.amount_due || 0), 0);
  const pendingCount = payments.filter((p: any) => p.payment_status === "pending" || p.payment_status === "partial").length;

  // This week's sessions
  const todaySessions = sessions.filter((s: any) => s.day_of_week === todayDay);
  const uniqueCoaches = new Set(coachAssignments.map((a: any) => a.coach_id));

  const stats = [
    { label: "Active Venues", value: activeVenues, icon: MapPin, href: "/private/venues", color: "text-blue-600" },
    { label: "Active Children", value: activeChildren, icon: Users, href: "/private/children", color: "text-green-600" },
    { label: "Session Groups", value: totalSessions, icon: Briefcase, href: "/private/sessions", color: "text-purple-600" },
    { label: "Coaches Assigned", value: uniqueCoaches.size, icon: UserCog, href: "/private/sessions", color: "text-amber-600" },
    { label: "Outstanding", value: `€${outstanding.toFixed(0)}`, icon: CreditCard, href: "/private/payments", color: "text-red-600" },
    { label: "Pending Payments", value: pendingCount, icon: Calendar, href: "/private/payments", color: "text-orange-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Private Coaching</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of private coaching operations</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(s => (
          <Link key={s.label} to={s.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-2xl font-bold mt-1">{s.value}</p>
                  </div>
                  <s.icon className={`h-8 w-8 ${s.color} opacity-60`} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's sessions */}
        <Card>
          <CardHeader><CardTitle className="text-base">Today's Sessions ({todayDay})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {todaySessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions scheduled today.</p>
            ) : todaySessions.map((s: any) => {
              const assignedChildren = childAssignments.filter((a: any) => a.session_group_id === s.id).length;
              const assignedCoaches = coachAssignments.filter((a: any) => a.session_group_id === s.id);
              return (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{s.group_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">{(s.private_venues as any)?.name} · {s.start_time}–{s.end_time}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{assignedChildren} children</p>
                    <p>{assignedCoaches.length} coach{assignedCoaches.length !== 1 ? "es" : ""}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Financial Summary & Quick Links */}
        <Card>
          <CardHeader><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Due</span><span className="font-medium">€{totalDue.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total Paid</span><span className="font-medium text-green-600">€{totalPaid.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Outstanding</span><span className="font-medium text-red-600">€{outstanding.toFixed(2)}</span></div>
            <hr className="my-2" />
            <div className="space-y-1.5">
              <Link to="/private/venues" className="block text-sm text-primary hover:underline">→ Manage Venues</Link>
              <Link to="/private/children" className="block text-sm text-primary hover:underline">→ Manage Children</Link>
              <Link to="/private/sessions" className="block text-sm text-primary hover:underline">→ Session Groups</Link>
              <Link to="/private/attendance" className="block text-sm text-primary hover:underline">→ Take Attendance</Link>
              <Link to="/private/payments" className="block text-sm text-primary hover:underline">→ View Payments</Link>
              <Link to="/private/session-plans" className="block text-sm text-primary hover:underline">→ Weekly Session Planner</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
