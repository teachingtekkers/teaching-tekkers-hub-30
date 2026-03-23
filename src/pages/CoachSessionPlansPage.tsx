import { useState, useEffect, useCallback } from "react";
import { BookOpen, Search, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import SessionPlanCard from "@/components/session-plans/SessionPlanCard";
import SessionPlanDetail, { type SessionPlanData } from "@/components/session-plans/SessionPlanDetail";

interface Category { id: string; name: string; }

export default function CoachSessionPlansPage() {
  const [plans, setPlans] = useState<SessionPlanData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [viewPlan, setViewPlan] = useState<SessionPlanData | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [catsRes, plansRes] = await Promise.all([
      supabase.from("session_plan_categories").select("*").order("name"),
      supabase.from("session_plans").select("*, session_plan_categories(name)").order("title"),
    ]);
    if (catsRes.data) setCategories(catsRes.data);
    if (plansRes.data) {
      setPlans(plansRes.data.map((p: any) => ({
        id: p.id,
        title: p.title,
        category_id: p.category_id,
        category_name: p.session_plan_categories?.name || "Uncategorised",
        age_group: p.age_group,
        description: p.description,
        organisation: p.organisation,
        other_comments: p.other_comments,
        coaching_points: p.coaching_points,
        player_numbers: p.player_numbers,
        equipment: p.equipment,
        content: p.content,
        diagram_image_url: p.diagram_image_url,
        video_url: p.video_url,
        created_at: p.created_at,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = plans.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.category_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === "all" || p.category_id === filterCategory;
    return matchSearch && matchCategory;
  });

  const categoryCounts = categories.map(c => ({
    ...c,
    count: plans.filter(p => p.category_id === c.id).length,
  }));

  // No-op handlers for read-only mode
  const noop = () => {};

  return (
    <div className="space-y-6">
      <div className="page-header flex-row items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Session Plans</h1>
          <p className="text-muted-foreground text-sm">Teaching Tekkers coaching session library</p>
        </div>
      </div>

      <div className="stat-grid">
        <StatCard label="Total Sessions" value={plans.length} icon={BookOpen} />
        <StatCard label="Categories" value={categories.length} icon={Tag} />
      </div>

      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search sessions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={filterCategory === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilterCategory("all")}
          >
            All ({plans.length})
          </Badge>
          {categoryCounts.map(cat => (
            <Badge
              key={cat.id}
              variant={filterCategory === cat.id ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilterCategory(cat.id)}
            >
              {cat.name} ({cat.count})
            </Badge>
          ))}
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Loading...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              {search || filterCategory !== "all" ? "No sessions match your filters" : "No session plans yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map(plan => (
            <SessionPlanCard
              key={plan.id}
              title={plan.title}
              category={plan.category_name}
              ageGroup={plan.age_group}
              description={plan.description}
              diagramUrl={plan.diagram_image_url}
              onClick={() => setViewPlan(plan)}
            />
          ))}
        </div>
      )}

      <SessionPlanDetail
        plan={viewPlan}
        open={!!viewPlan}
        onClose={() => setViewPlan(null)}
        onEdit={noop}
        onDuplicate={noop}
        readOnly
      />
    </div>
  );
}
