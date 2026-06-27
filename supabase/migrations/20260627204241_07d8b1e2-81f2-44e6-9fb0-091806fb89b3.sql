ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
  CHECK (status IN ('draft', 'approved'));

CREATE INDEX IF NOT EXISTS payroll_records_status_idx ON public.payroll_records(status);