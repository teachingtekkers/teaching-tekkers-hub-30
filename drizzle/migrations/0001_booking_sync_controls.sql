
ALTER TABLE public.booking_import_runs
  ADD COLUMN trigger text NOT NULL DEFAULT 'manual',
  ADD COLUMN error text,
  ADD COLUMN extracted_at timestamptz,
  ADD COLUMN locked_at timestamptz;
ALTER TABLE public.booking_import_run_rows
  ADD COLUMN conflict boolean NOT NULL DEFAULT false,
  ADD COLUMN review_status text;
CREATE INDEX idx_import_run_rows_review ON public.booking_import_run_rows(review_status) WHERE review_status = 'pending';

CREATE TABLE public.booking_sync_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  paused boolean NOT NULL DEFAULT false,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.booking_sync_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT, UPDATE ON public.booking_sync_settings TO authenticated;
GRANT ALL ON public.booking_sync_settings TO service_role;
ALTER TABLE public.booking_sync_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sync settings" ON public.booking_sync_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
