CREATE OR REPLACE FUNCTION public.recalculate_payment_status()
 RETURNS TABLE(updated integer, paid integer, pending integer, partial integer, refunded integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_updated int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  -- total_amount from the source is already net of sibling discount; never subtract it again.
  -- Refunds never create debt; cancelled bookings owe nothing; manual overrides are left alone.
  WITH u AS (
    UPDATE public.synced_bookings sb SET
      amount_owed = CASE WHEN COALESCE(booking_status,'') ILIKE '%cancel%' THEN 0
        ELSE GREATEST(0, COALESCE(total_amount,0) - COALESCE(amount_paid,0) - COALESCE(refund_amount,0)) END,
      payment_status = CASE
        WHEN COALESCE(refund_amount,0) > 0 AND COALESCE(amount_paid,0) <= 0 THEN 'refunded'
        WHEN COALESCE(booking_status,'') ILIKE '%cancel%' THEN COALESCE(payment_status,'pending')
        WHEN COALESCE(total_amount,0) > 0 AND GREATEST(0, COALESCE(total_amount,0) - COALESCE(amount_paid,0) - COALESCE(refund_amount,0)) <= 0 THEN 'paid'
        WHEN COALESCE(amount_paid,0) > 0 THEN 'partial'
        ELSE 'pending' END
    WHERE sb.source_system='bookings.teachingtekkers.com' AND NOT sb.manual_override
    RETURNING 1)
  SELECT count(*) INTO v_updated FROM u;
  RETURN QUERY SELECT v_updated::int,
    (SELECT count(*) FROM public.synced_bookings WHERE payment_status='paid')::int,
    (SELECT count(*) FROM public.synced_bookings WHERE payment_status='pending')::int,
    (SELECT count(*) FROM public.synced_bookings WHERE payment_status='partial')::int,
    (SELECT count(*) FROM public.synced_bookings WHERE payment_status='refunded')::int;
END;
$function$;