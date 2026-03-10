
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS synced_booking_id uuid REFERENCES public.synced_bookings(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE public.attendance 
  ALTER COLUMN player_id DROP NOT NULL;
