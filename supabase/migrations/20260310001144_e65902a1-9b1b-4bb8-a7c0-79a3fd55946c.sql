
-- Add new columns to coaches table
ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS county text DEFAULT '',
  ADD COLUMN IF NOT EXISTS emergency_contact_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS pickup_locations text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_counties text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS local_counties text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS role_type text DEFAULT 'assistant',
  ADD COLUMN IF NOT EXISTS qualification_level text DEFAULT '',
  ADD COLUMN IF NOT EXISTS safeguarding_cert_expiry date,
  ADD COLUMN IF NOT EXISTS first_aid_cert_expiry date,
  ADD COLUMN IF NOT EXISTS pay_band_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Create storage bucket for coach documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-documents', 'coach-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for coach-documents bucket: authenticated users can read/write
CREATE POLICY "Authenticated users can upload coach docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'coach-documents');

CREATE POLICY "Authenticated users can view coach docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'coach-documents');

CREATE POLICY "Authenticated users can delete coach docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'coach-documents');
