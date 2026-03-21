
-- Campaign/season table
CREATE TABLE public.camp_planning_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_type text NOT NULL DEFAULT 'Easter Camps',
  year integer NOT NULL DEFAULT 2026,
  num_weeks integer NOT NULL DEFAULT 4,
  week1_start_date date NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.camp_planning_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to camp_planning_campaigns"
  ON public.camp_planning_campaigns FOR ALL TO public
  USING (true) WITH CHECK (true);

-- Add campaign_id to planning entries
ALTER TABLE public.camp_planning_entries
  ADD COLUMN campaign_id uuid REFERENCES public.camp_planning_campaigns(id) ON DELETE CASCADE,
  ADD COLUMN week_number integer NOT NULL DEFAULT 1;
