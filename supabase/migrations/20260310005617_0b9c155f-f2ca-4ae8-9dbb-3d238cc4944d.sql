ALTER TABLE public.coaches 
  ADD COLUMN IF NOT EXISTS experience_level text DEFAULT 'standard' CHECK (experience_level IN ('lead', 'senior', 'standard', 'junior')),
  ADD COLUMN IF NOT EXISTS home_town text DEFAULT '',
  ADD COLUMN IF NOT EXISTS preferred_driver_id uuid REFERENCES public.coaches(id) ON DELETE SET NULL;