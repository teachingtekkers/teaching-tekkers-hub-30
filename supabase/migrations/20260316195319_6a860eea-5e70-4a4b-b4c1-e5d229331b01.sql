
CREATE OR REPLACE FUNCTION public.recalculate_payment_statuses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Update payment_status and amount_owed for all rows
  WITH calc AS (
    SELECT
      id,
      GREATEST(0, COALESCE(total_amount, 0) - COALESCE(sibling_discount, 0)) AS total_cost,
      GREATEST(0, 
        GREATEST(0, COALESCE(total_amount, 0) - COALESCE(sibling_discount, 0))
        - COALESCE(amount_paid, 0) 
        - COALESCE(refund_amount, 0)
      ) AS owed,
      payment_status AS old_status
    FROM synced_bookings
  ),
  updated AS (
    UPDATE synced_bookings sb
    SET 
      payment_status = CASE
        WHEN COALESCE(sb.refund_amount, 0) > 0 AND COALESCE(sb.amount_paid, 0) <= 0 THEN 'refunded'
        WHEN c.owed <= 0 AND c.total_cost > 0 THEN 'paid'
        WHEN COALESCE(sb.amount_paid, 0) > 0 AND c.owed > 0 THEN 'partial'
        ELSE 'pending'
      END,
      amount_owed = c.owed
    FROM calc c
    WHERE sb.id = c.id
    RETURNING sb.payment_status AS new_status, c.old_status
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM updated),
    'changed', (SELECT count(*) FROM updated WHERE new_status != COALESCE(old_status, '')),
    'paid', (SELECT count(*) FROM updated WHERE new_status = 'paid'),
    'pending', (SELECT count(*) FROM updated WHERE new_status = 'pending'),
    'partial', (SELECT count(*) FROM updated WHERE new_status = 'partial'),
    'refunded', (SELECT count(*) FROM updated WHERE new_status = 'refunded')
  ) INTO result;
  
  RETURN result;
END;
$$;
