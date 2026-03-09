export interface Camp {
  id: string;
  name: string;
  club_name: string;
  venue: string;
  county: string;
  start_date: string;
  end_date: string;
  daily_start_time: string;
  daily_end_time: string;
  age_group: string;
  capacity: number;
  price_per_child: number;
  created_at: string;
}

export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  medical_notes: string | null;
  kit_size: string;
  photo_permission: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  camp_id: string;
  player_id: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  payment_status: 'paid' | 'pending' | 'refunded';
  created_at: string;
}

export interface Coach {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  can_drive: boolean;
  is_head_coach: boolean;
  notes: string | null;
  daily_rate: number;
  head_coach_daily_rate: number;
  fuel_allowance_eligible: boolean;
  created_at: string;
}

export interface CampCoachAssignment {
  id: string;
  camp_id: string;
  coach_id: string;
  role: 'head_coach' | 'assistant';
  notes: string | null;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  camp_id: string;
  player_id: string;
  date: string;
  status: 'present' | 'absent';
}

export interface PayrollRecord {
  id: string;
  coach_id: string;
  camp_id: string;
  week_start: string;
  days_worked: number;
  daily_rate_used: number;
  fuel_allowance: number;
  manual_adjustment: number;
  total_amount: number;
  notes: string | null;
  created_at: string;
}

export interface ClubInvoice {
  id: string;
  camp_id: string;
  club_name: string;
  attendance_count: number;
  rate_per_child: number;
  total_amount: number;
  manual_amount: number | null;
  status: 'draft' | 'sent' | 'paid';
  notes: string | null;
  created_at: string;
}

export type UserRole = 'admin' | 'head_coach';
