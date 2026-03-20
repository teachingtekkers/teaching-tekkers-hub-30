
-- Weekly session planner: programme-level weekly plans
CREATE TABLE public.private_weekly_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number integer NOT NULL DEFAULT 1,
  programme_type text NOT NULL DEFAULT 'academy',
  week_date date,
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(week_number, programme_type)
);

-- Drills within a weekly plan (overview table rows)
CREATE TABLE public.private_weekly_plan_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_plan_id uuid NOT NULL REFERENCES public.private_weekly_plans(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  practice_type text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL DEFAULT 15,
  session_plan_id uuid REFERENCES public.session_plans(id) ON DELETE SET NULL,
  custom_drill_name text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.private_weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_weekly_plan_drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to private_weekly_plans" ON public.private_weekly_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to private_weekly_plan_drills" ON public.private_weekly_plan_drills FOR ALL USING (true) WITH CHECK (true);
