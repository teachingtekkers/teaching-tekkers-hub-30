
ALTER TABLE public.synced_bookings
  ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_owed numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS photo_permission boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS staff_notes text;
