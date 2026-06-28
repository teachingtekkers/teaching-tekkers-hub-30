
-- Helper: drop the old permissive policy and apply role-scoped policies
DO $$
DECLARE
  admin_only_tables text[] := ARRAY[
    'camp_planning_campaigns','camp_planning_entries','camp_week_scores',
    'staff_week_points','sync_logs','message_templates','camp_messages',
    'private_attendance','private_child_assignments','private_coach_assignments',
    'private_session_groups','private_session_plan_links','private_weekly_plans',
    'private_weekly_plan_drills'
  ];
  read_auth_write_admin_tables text[] := ARRAY[
    'attendance','camp_coach_assignments','camps','clubs',
    'equipment_items','equipment_assignments',
    'fixture_matches','fixture_sets','fixture_teams','fixture_templates',
    'itineraries','itinerary_blocks','itinerary_days',
    'session_plans','session_plan_assignments','session_plan_categories'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY admin_only_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %s" ON public.%I', t, t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY "Admins manage %s" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::app_role))', t, t);
  END LOOP;

  FOREACH t IN ARRAY read_auth_write_admin_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow all access to %s" ON public.%I', t, t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY "Authenticated read %s" ON public.%I FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "Admins write %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), ''admin''::app_role))', t, t);
    EXECUTE format('CREATE POLICY "Admins update %s" ON public.%I FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::app_role))', t, t);
    EXECUTE format('CREATE POLICY "Admins delete %s" ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(), ''admin''::app_role))', t, t);
  END LOOP;
END $$;

-- Head coaches need to write attendance during pitch-side check-in
CREATE POLICY "Head coaches write attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'head_coach'::app_role));
CREATE POLICY "Head coaches update attendance"
  ON public.attendance FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'head_coach'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'head_coach'::app_role));
CREATE POLICY "Head coaches delete attendance"
  ON public.attendance FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'head_coach'::app_role));

-- Revoke SECURITY DEFINER function EXECUTE from authenticated (still callable by RLS evaluator)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_payment_status() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon, PUBLIC;
