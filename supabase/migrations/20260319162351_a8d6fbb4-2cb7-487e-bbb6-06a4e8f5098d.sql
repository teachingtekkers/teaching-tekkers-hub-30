
-- Drop old bonus system
DROP TABLE IF EXISTS public.bonus_records;
DROP TYPE IF EXISTS public.bonus_status;

-- Camp-level weekly scores (one per camp per week)
CREATE TABLE public.camp_week_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  week_label TEXT NOT NULL DEFAULT 'Week 1',
  club_score NUMERIC(3,1) NOT NULL DEFAULT 0,
  parent_score_avg NUMERIC(3,1) NOT NULL DEFAULT 0,
  club_would_return BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(camp_id, week_label)
);

ALTER TABLE public.camp_week_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to camp_week_scores" ON public.camp_week_scores FOR ALL TO public USING (true) WITH CHECK (true);

-- Staff-level weekly points (one per staff per camp per week)
CREATE TABLE public.staff_week_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  week_label TEXT NOT NULL DEFAULT 'Week 1',
  role_that_week TEXT NOT NULL DEFAULT 'assistant',
  attendance_complete BOOLEAN NOT NULL DEFAULT false,
  hc_rating_score NUMERIC(3,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, camp_id, week_label)
);

ALTER TABLE public.staff_week_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to staff_week_points" ON public.staff_week_points FOR ALL TO public USING (true) WITH CHECK (true);
