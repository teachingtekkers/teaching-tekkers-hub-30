
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS base_pay numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS camp_bonus numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS payroll_records_coach_camp_week_uniq
  ON public.payroll_records (coach_id, camp_id, week_start);
