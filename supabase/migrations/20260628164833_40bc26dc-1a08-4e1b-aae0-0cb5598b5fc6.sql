
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
