
ALTER TABLE public.synced_bookings
  ADD COLUMN IF NOT EXISTS manual_override boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_synced_bookings_match_status ON public.synced_bookings (match_status);
CREATE INDEX IF NOT EXISTS idx_synced_bookings_camp_name ON public.synced_bookings (camp_name);
CREATE INDEX IF NOT EXISTS idx_synced_bookings_camp_date ON public.synced_bookings (camp_date);
