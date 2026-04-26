
-- Add metadata columns to synced_bookings for sign-in sheet workflow
ALTER TABLE public.synced_bookings
  ADD COLUMN IF NOT EXISTS attendance_source text,
  ADD COLUMN IF NOT EXISTS evidence_type text,
  ADD COLUMN IF NOT EXISTS sign_in_confidence numeric,
  ADD COLUMN IF NOT EXISTS needs_admin_review boolean NOT NULL DEFAULT false;

-- Audit log for every sheet upload application
CREATE TABLE IF NOT EXISTS public.sheet_upload_audits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  camp_id uuid,
  camp_date date,
  uploaded_by_user_id uuid,
  uploaded_by_email text,
  participant_id uuid,
  participant_name text,
  is_walk_in boolean NOT NULL DEFAULT false,
  original_attendance_status text,
  new_attendance_status text,
  original_payment_status text,
  new_payment_status text,
  original_amount_owed numeric,
  new_amount_owed numeric,
  evidence_type text,
  confidence_score numeric,
  admin_overrode boolean NOT NULL DEFAULT false,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_sheet_upload_audits_camp_date
  ON public.sheet_upload_audits (camp_id, camp_date);

ALTER TABLE public.sheet_upload_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to sheet_upload_audits" ON public.sheet_upload_audits;
CREATE POLICY "Allow all access to sheet_upload_audits"
  ON public.sheet_upload_audits
  FOR ALL
  USING (true)
  WITH CHECK (true);
