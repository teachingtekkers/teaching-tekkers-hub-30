
ALTER TABLE public.synced_bookings
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sibling_discount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_type text;
