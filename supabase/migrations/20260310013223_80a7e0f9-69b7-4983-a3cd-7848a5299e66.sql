
-- Add 'ready' to invoice_status enum
ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'ready' AFTER 'draft';

-- Add notes column if not exists (already exists based on schema, but ensure)
-- Add rate_per_child default
ALTER TABLE public.club_invoices ALTER COLUMN rate_per_child SET DEFAULT 15;
