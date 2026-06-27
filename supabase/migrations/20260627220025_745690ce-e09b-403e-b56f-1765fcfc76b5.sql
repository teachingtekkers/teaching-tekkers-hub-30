
-- Restrict public tables to admins only
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bookings','camp_financial_overrides','club_invoices','coaches','expenses','import_errors','payroll_records','players','private_children','private_payments','private_venues','proposals','sheet_upload_audits','synced_bookings','tasks']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %I" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Admins manage %I" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::app_role))', t, t);
  END LOOP;
END $$;

-- weekly_rosters: existing admin policy is fine. Add explicit SELECT for clarity (covered by ALL).
-- No change needed beyond confirming RLS enabled.
ALTER TABLE public.weekly_rosters ENABLE ROW LEVEL SECURITY;

-- Storage: restrict coach-documents to admins
DROP POLICY IF EXISTS "Authenticated users can view coach docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload coach docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete coach docs" ON storage.objects;

CREATE POLICY "Admins view coach docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='coach-documents' AND public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins upload coach docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='coach-documents' AND public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins update coach docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='coach-documents' AND public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins delete coach docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id='coach-documents' AND public.has_role(auth.uid(),'admin'::app_role));

-- SECURITY DEFINER function exposure
-- recalculate_payment_status: admin-only utility - revoke from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.recalculate_payment_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_payment_status() TO service_role;

-- handle_new_user: trigger function, not callable directly
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- get_user_role: revoke from anon
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;

-- has_role: needed inside RLS so authenticated must keep it, revoke from anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
