
-- Private Coaching: Venues
CREATE TABLE public.private_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text DEFAULT '',
  county text DEFAULT '',
  venue_cost_per_session numeric DEFAULT 0,
  notes text DEFAULT '',
  contact_name text DEFAULT '',
  contact_phone text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.private_venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to private_venues" ON public.private_venues FOR ALL TO public USING (true) WITH CHECK (true);

-- Private Coaching: Session Groups (a recurring session at a venue)
CREATE TABLE public.private_session_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.private_venues(id) ON DELETE CASCADE,
  group_name text NOT NULL DEFAULT '',
  day_of_week text NOT NULL DEFAULT 'Monday',
  start_time text NOT NULL DEFAULT '18:00',
  end_time text NOT NULL DEFAULT '19:00',
  age_group text DEFAULT '',
  max_capacity integer DEFAULT 20,
  payment_model text NOT NULL DEFAULT 'individual',
  block_price_4_week numeric DEFAULT 0,
  block_price_6_week numeric DEFAULT 0,
  single_session_price numeric DEFAULT 0,
  club_pays boolean NOT NULL DEFAULT false,
  club_pays_amount numeric DEFAULT 0,
  coach_cost_per_session numeric DEFAULT 0,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.private_session_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to private_session_groups" ON public.private_session_groups FOR ALL TO public USING (true) WITH CHECK (true);

-- Private Coaching: Children
CREATE TABLE public.private_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  date_of_birth date,
  parent_name text DEFAULT '',
  parent_phone text DEFAULT '',
  parent_email text DEFAULT '',
  medical_notes text DEFAULT '',
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.private_children ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to private_children" ON public.private_children FOR ALL TO public USING (true) WITH CHECK (true);

-- Private Coaching: Child → Session Group assignments
CREATE TABLE public.private_child_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.private_children(id) ON DELETE CASCADE,
  session_group_id uuid NOT NULL REFERENCES public.private_session_groups(id) ON DELETE CASCADE,
  payment_type text NOT NULL DEFAULT 'single',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(child_id, session_group_id)
);
ALTER TABLE public.private_child_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to private_child_assignments" ON public.private_child_assignments FOR ALL TO public USING (true) WITH CHECK (true);

-- Private Coaching: Coach → Session Group assignments
CREATE TABLE public.private_coach_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  session_group_id uuid NOT NULL REFERENCES public.private_session_groups(id) ON DELETE CASCADE,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coach_id, session_group_id)
);
ALTER TABLE public.private_coach_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to private_coach_assignments" ON public.private_coach_assignments FOR ALL TO public USING (true) WITH CHECK (true);

-- Private Coaching: Attendance
CREATE TABLE public.private_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.private_children(id) ON DELETE CASCADE,
  session_group_id uuid NOT NULL REFERENCES public.private_session_groups(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  status text NOT NULL DEFAULT 'present',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(child_id, session_group_id, session_date)
);
ALTER TABLE public.private_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to private_attendance" ON public.private_attendance FOR ALL TO public USING (true) WITH CHECK (true);

-- Private Coaching: Payments
CREATE TABLE public.private_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid REFERENCES public.private_children(id) ON DELETE SET NULL,
  session_group_id uuid REFERENCES public.private_session_groups(id) ON DELETE SET NULL,
  payer_type text NOT NULL DEFAULT 'child',
  payment_type text NOT NULL DEFAULT 'single',
  amount_due numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending',
  block_start_date date,
  block_end_date date,
  payment_date date,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.private_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to private_payments" ON public.private_payments FOR ALL TO public USING (true) WITH CHECK (true);

-- Private Coaching: Weekly Session Plan links (reuse existing session_plans)
CREATE TABLE public.private_session_plan_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_group_id uuid NOT NULL REFERENCES public.private_session_groups(id) ON DELETE CASCADE,
  session_plan_id uuid NOT NULL REFERENCES public.session_plans(id) ON DELETE CASCADE,
  week_date date NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_group_id, week_date)
);
ALTER TABLE public.private_session_plan_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to private_session_plan_links" ON public.private_session_plan_links FOR ALL TO public USING (true) WITH CHECK (true);
