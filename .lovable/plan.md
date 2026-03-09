

# Version 2 Plan: Roster, Payroll, Club Invoices & Control Centre

## Current State
The app uses **mock data only** — no database tables exist yet. All pages render from `src/data/mock.ts`. Version 1 has 7 screens: Login, Dashboard, Camps, Players, Coaches, Attendance, My Camps.

## Database Schema

First, create all the core V1 tables **plus** V2 extensions in one migration. This is necessary because mock data needs to move to real tables before V2 modules can reference them.

### V1 Tables (to persist existing mock data)
- `camps` — all camp fields from types
- `players` — player info
- `bookings` — links players to camps with parent info
- `coaches` — extended with new payroll fields
- `camp_coaches` — coach-to-camp assignments (extended with role + notes)
- `attendance` — daily attendance records

### V2 New/Extended Tables

**Coach profile extensions** (on `coaches` table):
- `daily_rate` (numeric, default 0)
- `head_coach_daily_rate` (numeric, default 0)
- `fuel_allowance_eligible` (boolean, default false)

**`camp_coach_assignments`** (replaces simple `camp_coaches`):
- `id`, `camp_id`, `coach_id`, `role` (enum: head_coach, assistant), `notes`, `created_at`

**`payroll_records`**:
- `id`, `coach_id`, `camp_id`, `week_start` (date), `days_worked`, `daily_rate_used`, `fuel_allowance`, `manual_adjustment`, `total_amount`, `notes`, `created_at`

**`club_invoices`**:
- `id`, `camp_id`, `club_name`, `attendance_count`, `rate_per_child` (default 15), `total_amount`, `manual_amount` (nullable override), `status` (enum: draft, sent, paid), `notes`, `created_at`

## New Pages & Routes

### 1. Roster Generator (`/roster`)
- Week selector (date picker for Monday of week)
- Table showing all camps that week with columns: camp name, club, player count, coaches required (ceil(players/15)), coaches assigned, staffing status
- Click a camp row to open assignment panel: list available coaches, drag/select to assign, set role (head coach / assistant), add notes
- Validation warnings: no head coach assigned, all drivers paired together, understaffed
- Saves to `camp_coach_assignments` table

### 2. Payroll (`/payroll`)
- Week selector
- Table of coaches with columns: name, camps worked, days, daily rate, fuel, adjustment, total
- "Generate Payroll" button creates records from assignments for that week
- Inline editing for fuel, adjustment, and override values
- Summary card showing total payroll for the week
- Camp breakdown view (payroll per camp)

### 3. Club Invoices (`/invoices`)
- List of camps with invoice generation
- "Generate Invoice" calculates: attendance count × €15 rate
- Editable amount override
- Status tracking: Draft → Sent → Paid
- Invoice detail shows: club, camp, attendance count, rate, total, status

### 4. Weekly Control Centre (`/control-centre`)
- Week selector
- Master table with columns: camp name, club, player count, coaches required, coaches assigned, staffing status (colour-coded badge), estimated payroll, estimated club payment
- Status logic:
  - Green (Ready): fully staffed + head coach assigned
  - Amber (Review): staffed but missing head coach or driver pairing issue
  - Red (Action): understaffed
- Quick action buttons per row: View Roster, Open Attendance, Generate Payroll, Generate Invoice

## Sidebar Updates
Add new section "Operations" to `AppSidebar.tsx` with 4 items:
- Control Centre, Roster, Payroll, Invoices

## Types Updates
Extend `src/types/index.ts` with:
- `CampCoachAssignment` (with role enum)
- `PayrollRecord`
- `ClubInvoice`
- Updated `Coach` type with rate fields

## Mock Data Updates
Extend `src/data/mock.ts` with sample assignments, payroll records, and invoices for development.

## Implementation Order

1. **Database migration** — create all tables (V1 + V2) with RLS policies
2. **Types & mock data** — extend types and mock data for new entities
3. **Coach profile extension** — add rate fields to the Coaches page form
4. **Roster Generator page** — week picker, camp table, coach assignment UI
5. **Payroll page** — generation, inline editing, summaries
6. **Club Invoices page** — generation from attendance, status management
7. **Weekly Control Centre page** — unified overview with status colours and quick actions
8. **Sidebar + routing** — add new routes and nav items

## Technical Notes
- All pages will initially work with mock data (consistent with V1 approach), with database integration ready
- The staffing formula `Math.ceil(playerCount / 15)` will be a shared utility
- Week selection will use `date-fns` `startOfWeek`/`endOfWeek` with `{ weekStartsOn: 1 }` for Monday-based weeks
- Status colour badges use existing Badge component with custom variant styling
- No changes to existing V1 page logic — only sidebar and types are touched

