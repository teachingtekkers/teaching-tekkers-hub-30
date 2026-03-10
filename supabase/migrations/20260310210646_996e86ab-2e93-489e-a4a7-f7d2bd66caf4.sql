ALTER TABLE public.synced_bookings
  ADD COLUMN IF NOT EXISTS medical_condition text,
  ADD COLUMN IF NOT EXISTS alternate_phone text,
  ADD COLUMN IF NOT EXISTS booking_date date;