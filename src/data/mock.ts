import { Camp, Player, Booking, Coach, CampCoachAssignment, AttendanceRecord, PayrollRecord, ClubInvoice } from '@/types';

export const mockCamps: Camp[] = [
  {
    id: '1',
    name: 'Easter Camp 2026',
    club_name: 'Kilmacud Crokes',
    venue: 'Silverpark',
    county: 'Dublin',
    start_date: '2026-03-09',
    end_date: '2026-03-13',
    daily_start_time: '10:00',
    daily_end_time: '15:00',
    age_group: 'U8-U12',
    capacity: 40,
    price_per_child: 120,
    created_at: '2026-01-15',
  },
  {
    id: '2',
    name: 'Spring Camp',
    club_name: 'Foxrock Cabinteely',
    venue: 'Kilbogget Park',
    county: 'Dublin',
    start_date: '2026-03-09',
    end_date: '2026-03-11',
    daily_start_time: '10:00',
    daily_end_time: '14:00',
    age_group: 'U6-U10',
    capacity: 30,
    price_per_child: 90,
    created_at: '2026-02-01',
  },
  {
    id: '3',
    name: 'Summer Camp Week 1',
    club_name: 'Bray Wanderers',
    venue: 'Carlisle Grounds',
    county: 'Wicklow',
    start_date: '2026-06-29',
    end_date: '2026-07-03',
    daily_start_time: '10:00',
    daily_end_time: '15:00',
    age_group: 'U7-U14',
    capacity: 60,
    price_per_child: 140,
    created_at: '2026-03-01',
  },
];

export const mockPlayers: Player[] = [
  { id: '1', first_name: 'Liam', last_name: 'Murphy', date_of_birth: '2016-03-15', medical_notes: 'Asthma - carries inhaler', kit_size: 'S', photo_permission: true, created_at: '2026-01-20' },
  { id: '2', first_name: 'Emma', last_name: 'O\'Brien', date_of_birth: '2015-07-22', medical_notes: null, kit_size: 'M', photo_permission: true, created_at: '2026-01-20' },
  { id: '3', first_name: 'Sean', last_name: 'Kelly', date_of_birth: '2017-01-10', medical_notes: 'Nut allergy', kit_size: 'XS', photo_permission: false, created_at: '2026-01-25' },
  { id: '4', first_name: 'Aoife', last_name: 'Walsh', date_of_birth: '2016-09-05', medical_notes: null, kit_size: 'S', photo_permission: true, created_at: '2026-02-01' },
  { id: '5', first_name: 'Cian', last_name: 'Doyle', date_of_birth: '2014-11-28', medical_notes: 'Epilepsy - medication in bag', kit_size: 'M', photo_permission: true, created_at: '2026-02-05' },
];

export const mockBookings: Booking[] = [
  { id: '1', camp_id: '1', player_id: '1', parent_name: 'John Murphy', parent_phone: '087 123 4567', parent_email: 'john@email.com', payment_status: 'paid', created_at: '2026-02-10' },
  { id: '2', camp_id: '1', player_id: '2', parent_name: 'Mary O\'Brien', parent_phone: '086 234 5678', parent_email: 'mary@email.com', payment_status: 'paid', created_at: '2026-02-12' },
  { id: '3', camp_id: '1', player_id: '3', parent_name: 'Pat Kelly', parent_phone: '085 345 6789', parent_email: 'pat@email.com', payment_status: 'pending', created_at: '2026-02-15' },
  { id: '4', camp_id: '2', player_id: '4', parent_name: 'Deirdre Walsh', parent_phone: '083 456 7890', parent_email: 'deirdre@email.com', payment_status: 'paid', created_at: '2026-02-20' },
  { id: '5', camp_id: '2', player_id: '5', parent_name: 'Tom Doyle', parent_phone: '089 567 8901', parent_email: 'tom@email.com', payment_status: 'paid', created_at: '2026-02-22' },
];

export const mockCoaches: Coach[] = [
  { id: '1', full_name: 'Darren Byrne', phone: '087 111 2222', email: 'darren@teachingtekkers.com', can_drive: true, is_head_coach: true, notes: 'UEFA B Licence', daily_rate: 120, head_coach_daily_rate: 150, fuel_allowance_eligible: true, created_at: '2025-09-01' },
  { id: '2', full_name: 'Sarah Fitzgerald', phone: '086 333 4444', email: 'sarah@teachingtekkers.com', can_drive: true, is_head_coach: true, notes: 'FAI Youth Cert', daily_rate: 120, head_coach_daily_rate: 150, fuel_allowance_eligible: true, created_at: '2025-09-15' },
  { id: '3', full_name: 'Mark Nolan', phone: '085 555 6666', email: 'mark@teachingtekkers.com', can_drive: false, is_head_coach: false, notes: null, daily_rate: 100, head_coach_daily_rate: 0, fuel_allowance_eligible: false, created_at: '2025-10-01' },
];

export const mockCampCoaches: CampCoachAssignment[] = [
  { id: '1', camp_id: '1', coach_id: '1', role: 'head_coach', notes: null, created_at: '2026-02-15' },
  { id: '2', camp_id: '1', coach_id: '3', role: 'assistant', notes: null, created_at: '2026-02-15' },
  { id: '3', camp_id: '2', coach_id: '2', role: 'head_coach', notes: null, created_at: '2026-02-20' },
];

export const mockAttendance: AttendanceRecord[] = [
  { id: '1', camp_id: '1', player_id: '1', date: '2026-03-09', status: 'present' },
  { id: '2', camp_id: '1', player_id: '2', date: '2026-03-09', status: 'present' },
  { id: '3', camp_id: '1', player_id: '3', date: '2026-03-09', status: 'absent' },
  { id: '4', camp_id: '2', player_id: '4', date: '2026-03-09', status: 'present' },
  { id: '5', camp_id: '2', player_id: '5', date: '2026-03-09', status: 'present' },
];

export const mockPayrollRecords: PayrollRecord[] = [
  { id: '1', coach_id: '1', camp_id: '1', week_start: '2026-03-09', days_worked: 5, daily_rate_used: 150, fuel_allowance: 30, manual_adjustment: 0, total_amount: 780, notes: null, created_at: '2026-03-13' },
  { id: '2', coach_id: '3', camp_id: '1', week_start: '2026-03-09', days_worked: 5, daily_rate_used: 100, fuel_allowance: 0, manual_adjustment: 0, total_amount: 500, notes: null, created_at: '2026-03-13' },
  { id: '3', coach_id: '2', camp_id: '2', week_start: '2026-03-09', days_worked: 3, daily_rate_used: 150, fuel_allowance: 20, manual_adjustment: 0, total_amount: 470, notes: null, created_at: '2026-03-11' },
];

export const mockClubInvoices: ClubInvoice[] = [
  { id: '1', camp_id: '1', club_name: 'Kilmacud Crokes', attendance_count: 2, rate_per_child: 15, total_amount: 30, manual_amount: null, status: 'draft', notes: null, created_at: '2026-03-13' },
  { id: '2', camp_id: '2', club_name: 'Foxrock Cabinteely', attendance_count: 2, rate_per_child: 15, total_amount: 30, manual_amount: null, status: 'sent', notes: null, created_at: '2026-03-11' },
];

// Utility functions
export const getCoachesRequired = (playerCount: number): number => Math.ceil(playerCount / 15);

export const getCampDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
};
