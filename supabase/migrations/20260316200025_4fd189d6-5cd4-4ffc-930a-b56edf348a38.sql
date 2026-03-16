
DROP FUNCTION IF EXISTS public.recalculate_payment_status();
DROP FUNCTION IF EXISTS public.recalculate_payment_statuses();

CREATE OR REPLACE FUNCTION public.recalculate_payment_status()
RETURNS TABLE(updated int, paid int, pending int, partial int, refunded int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_updated int;
BEGIN
  WITH u AS (
    UPDATE public.synced_bookings sb
    SET
      amount_owed = GREATEST(
        0,
        GREATEST(0, COALESCE(total_amount,0) - COALESCE(sibling_discount,0))
        - COALESCE(amount_paid,0)
        - COALESCE(refund_amount,0)
      ),
      payment_status = CASE
        WHEN COALESCE(refund_amount,0) > 0 AND COALESCE(amount_paid,0) <= 0 THEN 'refunded'
        WHEN (
          GREATEST(
            0,
            GREATEST(0, COALESCE(total_amount,0) - COALESCE(sibling_discount,0))
            - COALESCE(amount_paid,0)
            - COALESCE(refund_amount,0)
          )
        ) <= 0 AND (GREATEST(0, COALESCE(total_amount,0) - COALESCE(sibling_discount,0))) > 0 THEN 'paid'
        WHEN COALESCE(amount_paid,0) > 0 AND (
          GREATEST(
            0,
            GREATEST(0, COALESCE(total_amount,0) - COALESCE(sibling_discount,0))
            - COALESCE(amount_paid,0)
            - COALESCE(refund_amount,0)
          )
        ) > 0 THEN 'partial'
        ELSE 'pending'
      END
    WHERE sb.source_system='bookings.teachingtekkers.com'
    RETURNING 1
  )
  SELECT count(*) INTO v_updated FROM u;

  RETURN QUERY
  SELECT
    v_updated::int,
    (SELECT count(*) FROM public.synced_bookings WHERE payment_status='paid')::int,
    (SELECT count(*) FROM public.synced_bookings WHERE payment_status='pending')::int,
    (SELECT count(*) FROM public.synced_bookings WHERE payment_status='partial')::int,
    (SELECT count(*) FROM public.synced_bookings WHERE payment_status='refunded')::int;
END;
$$;
