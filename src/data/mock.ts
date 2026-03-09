import { Camp, Player, Booking, Coach, CampCoachAssignment, AttendanceRecord, PayrollRecord, ClubInvoice, FixtureSet, FixtureTeam, FixtureMatch, SessionPlanCategory, SessionPlan, SessionPlanAssignment, EquipmentItem, EquipmentAssignment, MessageTemplate, Proposal } from '@/types';

export const mockCamps: Camp[] = [
  { id: '1', name: 'Easter Camp 2026', club_name: 'Kilmacud Crokes', venue: 'Silverpark', county: 'Dublin', start_date: '2026-03-09', end_date: '2026-03-13', daily_start_time: '10:00', daily_end_time: '15:00', age_group: 'U8-U12', capacity: 40, price_per_child: 120, created_at: '2026-01-15' },
  { id: '2', name: 'Spring Camp', club_name: 'Foxrock Cabinteely', venue: 'Kilbogget Park', county: 'Dublin', start_date: '2026-03-09', end_date: '2026-03-11', daily_start_time: '10:00', daily_end_time: '14:00', age_group: 'U6-U10', capacity: 30, price_per_child: 90, created_at: '2026-02-01' },
  { id: '3', name: 'Summer Camp Week 1', club_name: 'Bray Wanderers', venue: 'Carlisle Grounds', county: 'Wicklow', start_date: '2026-06-29', end_date: '2026-07-03', daily_start_time: '10:00', daily_end_time: '15:00', age_group: 'U7-U14', capacity: 60, price_per_child: 140, created_at: '2026-03-01' },
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

// V3 Mock Data

export const mockSessionCategories: SessionPlanCategory[] = [
  { id: '1', name: 'Warm Up', created_at: '2026-01-01' },
  { id: '2', name: 'Passing & Receiving', created_at: '2026-01-01' },
  { id: '3', name: 'Shooting', created_at: '2026-01-01' },
  { id: '4', name: 'Small Sided Games', created_at: '2026-01-01' },
  { id: '5', name: 'Cool Down', created_at: '2026-01-01' },
];

export const mockSessionPlans: SessionPlan[] = [
  { id: '1', title: 'Dynamic Warm Up Drills', category_id: '1', age_group: 'U8-U12', description: 'A set of dynamic stretches and movement drills to get players warmed up.', content: '1. Jog around the pitch (2 mins)\n2. High knees (30 secs)\n3. Butt kicks (30 secs)\n4. Side shuffles (30 secs each way)\n5. Dynamic stretches — leg swings, arm circles\n6. Short sprints with change of direction', created_at: '2026-01-10' },
  { id: '2', title: 'Passing Triangles', category_id: '2', age_group: 'U8-U12', description: 'Triangle passing drill to improve short passing and movement.', content: '1. Set up triangles with cones (5m apart)\n2. Groups of 3 players per triangle\n3. Pass and move — follow your pass\n4. Progress: one-touch passing\n5. Progress: add a defender\n6. 10 minutes total', created_at: '2026-01-10' },
  { id: '3', title: 'Shooting Stations', category_id: '3', age_group: 'U10-U14', description: 'Multiple shooting stations to practise finishing from different angles.', content: '1. Station A: Shooting from edge of box\n2. Station B: 1v1 with keeper\n3. Station C: Cross and finish\n4. Rotate every 3 minutes\n5. Emphasise technique over power\n6. 15 minutes total', created_at: '2026-01-12' },
  { id: '4', title: 'World Cup Tournament', category_id: '4', age_group: 'U6-U10', description: 'Fun small-sided tournament with country team names.', content: '1. Divide into teams of 4-5\n2. Each team picks a country name\n3. Round robin format — 4 minute games\n4. Winner stays on pitch\n5. Semi-finals and final\n6. 25 minutes total', created_at: '2026-01-12' },
];

export const mockSessionAssignments: SessionPlanAssignment[] = [
  { id: '1', session_plan_id: '1', camp_id: '1', camp_day: '2026-03-09', created_at: '2026-03-01' },
  { id: '2', session_plan_id: '2', camp_id: '1', camp_day: '2026-03-09', created_at: '2026-03-01' },
  { id: '3', session_plan_id: '4', camp_id: '1', camp_day: '2026-03-10', created_at: '2026-03-01' },
  { id: '4', session_plan_id: '3', camp_id: '2', camp_day: '2026-03-09', created_at: '2026-03-01' },
];

export const mockFixtureSets: FixtureSet[] = [];
export const mockFixtureTeams: FixtureTeam[] = [];
export const mockFixtureMatches: FixtureMatch[] = [];

export const mockEquipmentItems: EquipmentItem[] = [
  { id: '1', name: 'Size 4 Footballs', category: 'Footballs', total_quantity: 30, notes: null, created_at: '2026-01-01' },
  { id: '2', name: 'Size 3 Footballs', category: 'Footballs', total_quantity: 20, notes: null, created_at: '2026-01-01' },
  { id: '3', name: 'Training Bibs (Blue)', category: 'Bibs', total_quantity: 40, notes: null, created_at: '2026-01-01' },
  { id: '4', name: 'Training Bibs (Red)', category: 'Bibs', total_quantity: 40, notes: null, created_at: '2026-01-01' },
  { id: '5', name: 'Cones (Flat)', category: 'Cones', total_quantity: 60, notes: null, created_at: '2026-01-01' },
  { id: '6', name: 'Medals (Gold)', category: 'Medals', total_quantity: 100, notes: 'For camp winners', created_at: '2026-01-01' },
  { id: '7', name: 'Camp Kit Bags', category: 'Kits', total_quantity: 10, notes: 'Main equipment bags', created_at: '2026-01-01' },
];

export const mockEquipmentAssignments: EquipmentAssignment[] = [
  { id: '1', equipment_item_id: '1', camp_id: '1', coach_id: '1', quantity_out: 10, quantity_returned: 0, notes: null, created_at: '2026-03-08' },
  { id: '2', equipment_item_id: '3', camp_id: '1', coach_id: '1', quantity_out: 20, quantity_returned: 0, notes: null, created_at: '2026-03-08' },
  { id: '3', equipment_item_id: '5', camp_id: '1', coach_id: '1', quantity_out: 20, quantity_returned: 0, notes: null, created_at: '2026-03-08' },
  { id: '4', equipment_item_id: '2', camp_id: '2', coach_id: '2', quantity_out: 8, quantity_returned: 8, notes: 'All returned', created_at: '2026-03-08' },
];

// Utility functions
export const getCoachesRequired = (playerCount: number): number => Math.ceil(playerCount / 15);

export const getCampDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
};
