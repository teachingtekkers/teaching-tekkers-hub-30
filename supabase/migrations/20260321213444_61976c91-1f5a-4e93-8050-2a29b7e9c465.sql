
CREATE TABLE public.camp_planning_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_name text NOT NULL,
  club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  county text NOT NULL DEFAULT '',
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'to_contact',
  venue text DEFAULT '',
  age_group text DEFAULT '',
  notes text DEFAULT '',
  linked_camp_id uuid REFERENCES public.camps(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.camp_planning_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to camp_planning_entries"
  ON public.camp_planning_entries FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
