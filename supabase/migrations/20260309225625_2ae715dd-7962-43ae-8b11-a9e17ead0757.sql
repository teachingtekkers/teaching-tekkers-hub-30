
-- Create enums
CREATE TYPE public.payment_status AS ENUM ('paid', 'pending', 'refunded');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent');
CREATE TYPE public.coach_role AS ENUM ('head_coach', 'assistant');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid');

-- Camps table
CREATE TABLE public.camps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  club_name TEXT NOT NULL,
  venue TEXT NOT NULL,
  county TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily_start_time TIME NOT NULL DEFAULT '10:00',
  daily_end_time TIME NOT NULL DEFAULT '15:00',
  age_group TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 40,
  price_per_child NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Players table
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  medical_notes TEXT,
  kit_size TEXT NOT NULL DEFAULT 'M',
  photo_permission BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  parent_name TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Coaches table (with V2 payroll fields)
CREATE TABLE public.coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  can_drive BOOLEAN NOT NULL DEFAULT false,
  is_head_coach BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  head_coach_daily_rate NUMERIC NOT NULL DEFAULT 0,
  fuel_allowance_eligible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Camp coach assignments (V2 roster)
CREATE TABLE public.camp_coach_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  role coach_role NOT NULL DEFAULT 'assistant',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(camp_id, coach_id)
);

-- Attendance records
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'present',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(camp_id, player_id, date)
);

-- Payroll records (V2)
CREATE TABLE public.payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  days_worked INTEGER NOT NULL DEFAULT 0,
  daily_rate_used NUMERIC NOT NULL DEFAULT 0,
  fuel_allowance NUMERIC NOT NULL DEFAULT 0,
  manual_adjustment NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Club invoices (V2)
CREATE TABLE public.club_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  club_name TEXT NOT NULL,
  attendance_count INTEGER NOT NULL DEFAULT 0,
  rate_per_child NUMERIC NOT NULL DEFAULT 15,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  manual_amount NUMERIC,
  status invoice_status NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables (public read for now since auth isn't implemented yet)
ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_coach_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invoices ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (will be tightened when auth is added)
CREATE POLICY "Allow all access to camps" ON public.camps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to players" ON public.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to bookings" ON public.bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to coaches" ON public.coaches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to camp_coach_assignments" ON public.camp_coach_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to payroll_records" ON public.payroll_records FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to club_invoices" ON public.club_invoices FOR ALL USING (true) WITH CHECK (true);
