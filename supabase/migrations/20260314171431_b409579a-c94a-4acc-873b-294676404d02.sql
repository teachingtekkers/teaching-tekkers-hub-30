
ALTER TABLE public.camps
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_auto_created boolean NOT NULL DEFAULT false;
