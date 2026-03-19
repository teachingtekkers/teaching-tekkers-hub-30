import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ListChecks, ArrowRight, Flag, AlertTriangle, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isThisWeek, isBefore, startOfDay } from "date-fns";

interface TaskRow {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
  status: string;
  linked_area: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  urgent: "bg-destructive/10 text-destructive",
};

export function DashboardTasksPanel() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, due_date, priority, status, linked_area")
        .neq("status", "done")
        .order("due_date", { ascending: true });
      setTasks((data || []) as unknown as TaskRow[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;

  const today = startOfDay(new Date());

  const overdue = tasks.filter(t => t.status === "overdue" || (t.due_date && isBefore(new Date(t.due_date + "T00:00:00"), today) && t.status !== "done"));
  const dueToday = tasks.filter(t => t.due_date && isToday(new Date(t.due_date + "T00:00:00")) && !overdue.includes(t));
  const dueThisWeek = tasks.filter(t => t.due_date && isThisWeek(new Date(t.due_date + "T00:00:00"), { weekStartsOn: 1 }) && !isToday(new Date(t.due_date + "T00:00:00")) && !overdue.includes(t));
  const urgent = tasks.filter(t => t.priority === "urgent" && !overdue.includes(t) && !dueToday.includes(t));

  const sections = [
    { label: "Overdue", items: overdue, variant: "destructive" as const, icon: AlertTriangle },
    { label: "Due Today", items: dueToday, variant: "warning" as const, icon: Calendar },
    { label: "Due This Week", items: dueThisWeek, variant: "default" as const, icon: Calendar },
    { label: "Urgent Open", items: urgent, variant: "destructive" as const, icon: Flag },
  ].filter(s => s.items.length > 0);

  if (sections.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="section-label !mb-0 flex items-center gap-2">
          <ListChecks className="h-4 w-4" /> Tasks & Reminders
        </p>
        <Link to="/tasks" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
          All Tasks <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {sections.map(section => (
          section.items.slice(0, 3).map(task => (
            <Link key={task.id} to="/tasks" className="group">
              <Card className={`border-l-4 ${section.variant === "destructive" ? "border-l-destructive" : section.variant === "warning" ? "border-l-amber-500" : "border-l-primary"} hover:bg-accent/50 transition-colors`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${section.variant === "destructive" ? "bg-destructive/10" : section.variant === "warning" ? "bg-amber-500/10" : "bg-primary/10"}`}>
                    <section.icon className={`h-4 w-4 ${section.variant === "destructive" ? "text-destructive" : section.variant === "warning" ? "text-amber-600" : "text-primary"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">{section.label}</span>
                      {task.due_date && (
                        <span className="text-[10px] text-muted-foreground">· {format(new Date(task.due_date + "T00:00:00"), "dd MMM")}</span>
                      )}
                      <Badge className={`${PRIORITY_COLORS[task.priority]} text-[9px] capitalize border-0 px-1.5 py-0`}>{task.priority}</Badge>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))
        ))}
      </div>
      {sections.reduce((s, sec) => s + sec.items.length, 0) > 6 && (
        <Link to="/tasks" className="block text-center text-xs text-primary hover:underline mt-2">
          View all tasks →
        </Link>
      )}
    </div>
  );
}
