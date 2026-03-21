
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'Other',
  supplier text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  season text NULL DEFAULT '',
  linked_camp_id uuid NULL REFERENCES public.camps(id) ON DELETE SET NULL,
  linked_venue text NULL DEFAULT '',
  notes text NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to expenses" ON public.expenses FOR ALL TO public USING (true) WITH CHECK (true);
