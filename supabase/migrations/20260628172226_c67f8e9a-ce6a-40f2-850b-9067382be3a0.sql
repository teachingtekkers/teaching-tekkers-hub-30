CREATE OR REPLACE FUNCTION public.update_assigned_booking_kit(
  _booking_id uuid,
  _kit_size text DEFAULT NULL,
  _kit_given boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _kit_size IS NOT NULL AND _kit_size NOT IN ('XS', 'S', 'M', 'L', 'XL') THEN
    RAISE EXCEPTION 'Invalid kit size';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      public.has_role(auth.uid(), 'head_coach'::app_role)
      AND EXISTS (
        SELECT 1
        FROM public.synced_bookings sb
        JOIN public.camp_coach_assignments cca ON cca.camp_id = sb.matched_camp_id
        JOIN public.profiles p ON p.coach_id = cca.coach_id
        WHERE sb.id = _booking_id
          AND p.id = auth.uid()
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed to update kit details for this booking';
  END IF;

  UPDATE public.synced_bookings
  SET
    kit_size = COALESCE(_kit_size, kit_size),
    kit_given = COALESCE(_kit_given, kit_given)
  WHERE id = _booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_assigned_booking_kit(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_assigned_booking_kit(uuid, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_assigned_booking_kit(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_assigned_booking_kit(uuid, text, boolean) TO service_role;