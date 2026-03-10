
-- Create roster status enum
CREATE TYPE public.roster_status AS ENUM ('draft', 'finalised');

-- Create weekly_rosters table
CREATE TABLE public.weekly_rosters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  assignments JSONB NOT NULL DEFAULT '[]'::jsonb,
  available_coach_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status roster_status NOT NULL DEFAULT 'draft',
  camps_count INTEGER NOT NULL DEFAULT 0,
  coaches_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (week_start)
);

-- Enable RLS
ALTER TABLE public.weekly_rosters ENABLE ROW LEVEL SECURITY;

-- Only admins can access rosters
CREATE POLICY "Admins can manage rosters"
  ON public.weekly_rosters FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
