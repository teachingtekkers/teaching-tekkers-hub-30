CREATE TABLE public.data_repair_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch text NOT NULL,
  kind text NOT NULL,
  target_table text NOT NULL,
  target_id uuid,
  status text NOT NULL DEFAULT 'staged',
  before jsonb,
  after jsonb,
  evidence jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  reverted_at timestamptz
);
COMMENT ON TABLE public.data_repair_audit IS 'Before/after record of data repairs and staged (not yet applied) corrections. status: staged | applied | held | reverted.';
CREATE INDEX data_repair_audit_batch_idx ON public.data_repair_audit(batch, status);
GRANT SELECT, INSERT, UPDATE ON public.data_repair_audit TO authenticated;
GRANT ALL ON public.data_repair_audit TO service_role;
ALTER TABLE public.data_repair_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage repair audit" ON public.data_repair_audit FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.recalculate_payment_status()
 RETURNS TABLE(updated integer, paid integer, pending integer, partial integer, refunded integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_updated int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Admins only'; END IF;
  -- total_amount from the source is already net of sibling discount; never subtract it again.
  -- Refund and cancellation semantics are not established from source evidence:
  -- rows with a refund or a cancelled status are left untouched for manual review.
  WITH u AS (
    UPDATE public.synced_bookings sb SET
      amount_owed = GREATEST(0, COALESCE(total_amount,0) - COALESCE(amount_paid,0)),
      payment_status = CASE
        WHEN COALESCE(total_amount,0) > 0 AND COALESCE(amount_paid,0) >= COALESCE(total_amount,0) THEN 'paid'
        WHEN COALESCE(amount_paid,0) > 0 THEN 'partial'
        ELSE 'pending' END
    WHERE sb.source_system='bookings.teachingtekkers.com' AND NOT sb.manual_override
      AND COALESCE(sb.refund_amount,0) = 0
      AND COALESCE(sb.booking_status,'') NOT ILIKE '%cancel%'
      AND NOT (sb.payment_status = 'paid' AND COALESCE(sb.amount_paid,0) < COALESCE(sb.total_amount,0))
    RETURNING 1)
  SELECT count(*) INTO v_updated FROM u;
  RETURN QUERY SELECT v_updated::int,
    (SELECT count(*) FROM public.synced_bookings WHERE payment_status='paid')::int,
    (SELECT count(*) FROM public.synced_bookings WHERE payment_status='pending')::int,
    (SELECT count(*) FROM public.synced_bookings WHERE payment_status='partial')::int,
    (SELECT count(*) FROM public.synced_bookings WHERE payment_status='refunded')::int;
END;
$function$;