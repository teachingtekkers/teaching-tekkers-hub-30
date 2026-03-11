CREATE TABLE public.camp_financial_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id uuid NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE UNIQUE,
  override_revenue numeric DEFAULT NULL,
  override_club_payment numeric DEFAULT NULL,
  override_payroll numeric DEFAULT NULL,
  override_club_rate numeric DEFAULT NULL,
  notes text DEFAULT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.camp_financial_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to camp_financial_overrides"
  ON public.camp_financial_overrides
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
