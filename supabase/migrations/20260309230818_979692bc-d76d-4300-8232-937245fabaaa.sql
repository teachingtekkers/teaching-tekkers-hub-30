
-- Proposal status enum
CREATE TYPE public.proposal_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');

-- Message templates
CREATE TABLE public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generated camp messages
CREATE TABLE public.camp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  generated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Club proposals
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_name TEXT NOT NULL,
  proposal_title TEXT NOT NULL,
  proposed_dates TEXT NOT NULL,
  camp_description TEXT,
  price_details TEXT,
  status proposal_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to message_templates" ON public.message_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to camp_messages" ON public.camp_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to proposals" ON public.proposals FOR ALL USING (true) WITH CHECK (true);
