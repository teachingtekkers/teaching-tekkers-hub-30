
ALTER TABLE public.synced_bookings 
  ADD COLUMN IF NOT EXISTS match_score numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS match_reason text DEFAULT NULL;

ALTER TABLE public.synced_bookings 
  ALTER COLUMN photo_permission SET DEFAULT NULL;
