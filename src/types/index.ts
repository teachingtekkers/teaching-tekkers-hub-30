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

// V3 Types

export interface FixtureSet {
  id: string;
  camp_id: string;
  name: string;
  format: 'group_stage' | 'knockout' | 'group_knockout';
  teams: FixtureTeam[];
  matches: FixtureMatch[];
  created_at: string;
}

export interface FixtureTeam {
  id: string;
  fixture_set_id: string;
  name: string;
  colour: string;
  created_at: string;
}

export interface FixtureMatch {
  id: string;
  fixture_set_id: string;
  round_name: string;
  kickoff_order: number;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  created_at: string;
}

export interface SessionPlanCategory {
  id: string;
  name: string;
  created_at: string;
}

export interface SessionPlan {
  id: string;
  title: string;
  category_id: string | null;
  age_group: string;
  description: string | null;
  content: string | null;
  created_at: string;
}

export interface SessionPlanAssignment {
  id: string;
  session_plan_id: string;
  camp_id: string;
  camp_day: string | null;
  created_at: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  total_quantity: number;
  notes: string | null;
  created_at: string;
}

export interface EquipmentAssignment {
  id: string;
  equipment_item_id: string;
  camp_id: string | null;
  coach_id: string | null;
  quantity_out: number;
  quantity_returned: number;
  notes: string | null;
  created_at: string;
}

// V4 Types

export interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  message_text: string;
  created_at: string;
}

export interface CampMessage {
  id: string;
  camp_id: string;
  template_id: string | null;
  generated_text: string;
  created_at: string;
}

export interface Proposal {
  id: string;
  club_name: string;
  proposal_title: string;
  proposed_dates: string;
  camp_description: string | null;
  price_details: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  notes: string | null;
  created_at: string;
}

export type UserRole = 'admin' | 'head_coach';
