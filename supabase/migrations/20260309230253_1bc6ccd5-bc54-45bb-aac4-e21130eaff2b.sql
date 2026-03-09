
-- Fixture format enum
CREATE TYPE public.fixture_format AS ENUM ('group_stage', 'knockout', 'group_knockout');

-- Fixture sets
CREATE TABLE public.fixture_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  format fixture_format NOT NULL DEFAULT 'group_stage',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixture teams
CREATE TABLE public.fixture_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_set_id UUID NOT NULL REFERENCES public.fixture_sets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  colour TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixture matches
CREATE TABLE public.fixture_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_set_id UUID NOT NULL REFERENCES public.fixture_sets(id) ON DELETE CASCADE,
  round_name TEXT NOT NULL DEFAULT 'Round 1',
  kickoff_order INTEGER NOT NULL DEFAULT 1,
  home_team_id UUID REFERENCES public.fixture_teams(id) ON DELETE SET NULL,
  away_team_id UUID REFERENCES public.fixture_teams(id) ON DELETE SET NULL,
  home_score INTEGER,
  away_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session plan categories
CREATE TABLE public.session_plan_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session plans
CREATE TABLE public.session_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category_id UUID REFERENCES public.session_plan_categories(id) ON DELETE SET NULL,
  age_group TEXT NOT NULL DEFAULT 'U8-U12',
  description TEXT,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session plan assignments to camps/days
CREATE TABLE public.session_plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_plan_id UUID NOT NULL REFERENCES public.session_plans(id) ON DELETE CASCADE,
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  camp_day DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Equipment items
CREATE TABLE public.equipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  total_quantity INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Equipment assignments
CREATE TABLE public.equipment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_item_id UUID NOT NULL REFERENCES public.equipment_items(id) ON DELETE CASCADE,
  camp_id UUID REFERENCES public.camps(id) ON DELETE SET NULL,
  coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
  quantity_out INTEGER NOT NULL DEFAULT 0,
  quantity_returned INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.fixture_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixture_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixture_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_plan_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_plan_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to fixture_sets" ON public.fixture_sets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to fixture_teams" ON public.fixture_teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to fixture_matches" ON public.fixture_matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to session_plan_categories" ON public.session_plan_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to session_plans" ON public.session_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to session_plan_assignments" ON public.session_plan_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to equipment_items" ON public.equipment_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to equipment_assignments" ON public.equipment_assignments FOR ALL USING (true) WITH CHECK (true);
