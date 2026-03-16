
-- 1) Create clubs table
CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  county text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to clubs"
  ON public.clubs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 2) Add club_id to camps
ALTER TABLE public.camps ADD COLUMN club_id uuid NULL REFERENCES public.clubs(id);

-- 3) Backfill: insert distinct club names, then set club_id
INSERT INTO public.clubs (name)
SELECT DISTINCT trim(club_name) FROM public.camps
WHERE trim(club_name) != ''
ON CONFLICT (name) DO NOTHING;

UPDATE public.camps c
SET club_id = cl.id
FROM public.clubs cl
WHERE trim(c.club_name) = cl.name;
