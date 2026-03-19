
CREATE TYPE public.bonus_status AS ENUM ('draft', 'reviewed', 'approved');

CREATE TABLE public.bonus_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  week_label TEXT NOT NULL DEFAULT 'Week 1',
  club_feedback_points INTEGER NOT NULL DEFAULT 0,
  parent_feedback_points INTEGER NOT NULL DEFAULT 0,
  admin_adjustment INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL GENERATED ALWAYS AS (club_feedback_points + parent_feedback_points + admin_adjustment) STORED,
  notes TEXT,
  status bonus_status NOT NULL DEFAULT 'draft',
  approved_bonus_amount NUMERIC NOT NULL DEFAULT 0,
  payroll_linked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, camp_id, week_label)
);

ALTER TABLE public.bonus_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to bonus_records" ON public.bonus_records
  FOR ALL TO public USING (true) WITH CHECK (true);
