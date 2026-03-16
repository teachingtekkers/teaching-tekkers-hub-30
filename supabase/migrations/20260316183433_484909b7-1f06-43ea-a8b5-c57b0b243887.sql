
CREATE TABLE public.import_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_log_id uuid REFERENCES public.sync_logs(id) ON DELETE CASCADE,
  external_booking_id text,
  camp_name text,
  child_first_name text,
  child_last_name text,
  error_code text,
  error_message text NOT NULL,
  raw_row_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.import_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to import_errors"
  ON public.import_errors
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
