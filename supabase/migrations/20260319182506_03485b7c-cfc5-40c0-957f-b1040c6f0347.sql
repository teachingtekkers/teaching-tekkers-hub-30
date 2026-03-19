CREATE TABLE public.fixture_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  teams jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fixture_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to fixture_templates"
  ON public.fixture_templates
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);