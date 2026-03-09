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
  created_at: string;
}

export interface CampCoach {
  id: string;
  camp_id: string;
  coach_id: string;
}

export interface AttendanceRecord {
  id: string;
  camp_id: string;
  player_id: string;
  date: string;
  status: 'present' | 'absent';
}

export type UserRole = 'admin' | 'head_coach';
