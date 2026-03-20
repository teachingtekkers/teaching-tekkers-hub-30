-- Itineraries table
CREATE TABLE public.itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  camp_type text DEFAULT '',
  linked_camp_id uuid REFERENCES public.camps(id) ON DELETE SET NULL,
  venue text DEFAULT '',
  start_date date,
  num_days integer NOT NULL DEFAULT 4,
  team_format text DEFAULT '',
  notes text DEFAULT '',
  cover_title text DEFAULT '',
  is_template boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to itineraries" ON public.itineraries FOR ALL TO public USING (true) WITH CHECK (true);

-- Itinerary days table
CREATE TABLE public.itinerary_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id uuid NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  day_number integer NOT NULL DEFAULT 1,
  title text NOT NULL DEFAULT '',
  theme text DEFAULT '',
  next_day_reminder text DEFAULT '',
  setup_notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.itinerary_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to itinerary_days" ON public.itinerary_days FOR ALL TO public USING (true) WITH CHECK (true);

-- Itinerary blocks table
CREATE TABLE public.itinerary_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.itinerary_days(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  start_time text NOT NULL DEFAULT '10:00',
  end_time text DEFAULT '',
  block_title text NOT NULL DEFAULT '',
  description text DEFAULT '',
  linked_session_plan_id uuid REFERENCES public.session_plans(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.itinerary_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to itinerary_blocks" ON public.itinerary_blocks FOR ALL TO public USING (true) WITH CHECK (true);