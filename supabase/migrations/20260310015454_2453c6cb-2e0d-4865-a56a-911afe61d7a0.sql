
-- Sync logs table
CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_started_at timestamptz NOT NULL DEFAULT now(),
  sync_completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  records_processed integer NOT NULL DEFAULT 0,
  records_created integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  error_notes text,
  source_system text NOT NULL DEFAULT 'bookings.teachingtekkers.com',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to sync_logs" ON public.sync_logs FOR ALL TO public USING (true) WITH CHECK (true);

-- Synced bookings table
CREATE TABLE public.synced_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_booking_id text,
  camp_name text NOT NULL,
  camp_date date,
  venue text,
  county text,
  child_first_name text NOT NULL,
  child_last_name text NOT NULL,
  date_of_birth date,
  age integer,
  parent_name text,
  parent_phone text,
  parent_email text,
  emergency_contact text,
  medical_notes text,
  kit_size text DEFAULT 'M',
  payment_status text DEFAULT 'pending',
  booking_status text DEFAULT 'confirmed',
  source_system text NOT NULL DEFAULT 'bookings.teachingtekkers.com',
  imported_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  sync_log_id uuid REFERENCES public.sync_logs(id),
  matched_camp_id uuid REFERENCES public.camps(id),
  matched_player_id uuid REFERENCES public.players(id),
  matched_booking_id uuid REFERENCES public.bookings(id),
  match_status text NOT NULL DEFAULT 'unmatched',
  duplicate_warning boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(external_booking_id, source_system)
);

ALTER TABLE public.synced_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to synced_bookings" ON public.synced_bookings FOR ALL TO public USING (true) WITH CHECK (true);
