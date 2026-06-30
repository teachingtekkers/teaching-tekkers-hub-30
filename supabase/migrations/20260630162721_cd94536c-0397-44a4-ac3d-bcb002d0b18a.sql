
-- 1) Grant authenticated read on user_roles (needed because has_role becomes SECURITY INVOKER)
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- 2) Switch has_role to SECURITY INVOKER (removes definer-executable-by-authenticated finding)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon, service_role;

-- 3) Scope head_coach attendance policies to assigned camps
DROP POLICY IF EXISTS "Head coaches delete attendance" ON public.attendance;
DROP POLICY IF EXISTS "Head coaches update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Head coaches write attendance" ON public.attendance;

CREATE POLICY "Head coaches delete attendance"
ON public.attendance FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'head_coach'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.camp_coach_assignments cca
    JOIN public.profiles p ON p.coach_id = cca.coach_id
    WHERE cca.camp_id = attendance.camp_id AND p.id = auth.uid()
  )
);

CREATE POLICY "Head coaches update attendance"
ON public.attendance FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'head_coach'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.camp_coach_assignments cca
    JOIN public.profiles p ON p.coach_id = cca.coach_id
    WHERE cca.camp_id = attendance.camp_id AND p.id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'head_coach'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.camp_coach_assignments cca
    JOIN public.profiles p ON p.coach_id = cca.coach_id
    WHERE cca.camp_id = attendance.camp_id AND p.id = auth.uid()
  )
);

CREATE POLICY "Head coaches write attendance"
ON public.attendance FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'head_coach'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.camp_coach_assignments cca
    JOIN public.profiles p ON p.coach_id = cca.coach_id
    WHERE cca.camp_id = attendance.camp_id AND p.id = auth.uid()
  )
);

-- 4) Restrict user_roles policies to authenticated role and prevent self-insert
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);
