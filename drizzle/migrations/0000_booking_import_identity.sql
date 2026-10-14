
CREATE TABLE public.source_camp_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL DEFAULT 'bookings.teachingtekkers.com',
  source_camp_id text NOT NULL,
  camp_id uuid NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  source_camp_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_camp_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_camp_mappings TO authenticated;
GRANT ALL ON public.source_camp_mappings TO service_role;
ALTER TABLE public.source_camp_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage source camp mappings" ON public.source_camp_mappings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.source_family_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  source_camp_id text NOT NULL,
  family_key text NOT NULL,
  source_booking_id text,
  guardian_name text,
  guardian_email text,
  guardian_phone text,
  first_import_run_id uuid,
  last_import_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_camp_id, family_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_family_bookings TO authenticated;
GRANT ALL ON public.source_family_bookings TO service_role;
ALTER TABLE public.source_family_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage family bookings" ON public.source_family_bookings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.booking_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  source_camp_id text NOT NULL,
  camp_id uuid REFERENCES public.camps(id) ON DELETE SET NULL,
  file_name text,
  status text NOT NULL DEFAULT 'preview',
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_import_runs TO authenticated;
GRANT ALL ON public.booking_import_runs TO service_role;
ALTER TABLE public.booking_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage import runs" ON public.booking_import_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.booking_import_run_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.booking_import_runs(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  classification text NOT NULL,
  reason text,
  participant_key text,
  family_key text,
  synced_booking_id uuid,
  candidate_ids uuid[],
  raw_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff jsonb,
  protected_fields text[],
  resolution text,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_import_run_rows_run ON public.booking_import_run_rows(run_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_import_run_rows TO authenticated;
GRANT ALL ON public.booking_import_run_rows TO service_role;
ALTER TABLE public.booking_import_run_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage import run rows" ON public.booking_import_run_rows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.synced_bookings
  ADD COLUMN source_camp_id text,
  ADD COLUMN source_participant_id text,
  ADD COLUMN source_booking_id text,
  ADD COLUMN participant_key text,
  ADD COLUMN family_booking_id uuid REFERENCES public.source_family_bookings(id) ON DELETE SET NULL,
  ADD COLUMN source_values jsonb,
  ADD COLUMN last_import_run_id uuid;
CREATE INDEX idx_synced_bookings_source_camp ON public.synced_bookings(source_system, source_camp_id);
CREATE UNIQUE INDEX synced_bookings_source_participant_uniq ON public.synced_bookings(source_system, source_camp_id, source_participant_id) WHERE source_participant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_head_coach_import_field_update()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'head_coach'::app_role) AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    IF ROW(NEW.source_camp_id, NEW.source_participant_id, NEW.source_booking_id, NEW.participant_key, NEW.family_booking_id, NEW.source_values, NEW.last_import_run_id)
       IS DISTINCT FROM ROW(OLD.source_camp_id, OLD.source_participant_id, OLD.source_booking_id, OLD.participant_key, OLD.family_booking_id, OLD.source_values, OLD.last_import_run_id) THEN
      RAISE EXCEPTION 'Head coaches cannot change import identity fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER prevent_head_coach_import_field_update BEFORE UPDATE ON public.synced_bookings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_head_coach_import_field_update();
