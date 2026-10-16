# Booking Sync — Provider Integration Handoff (private, developer only)

Status: **NOT CONNECTED**. No messages have been sent to the provider. No provider credentials exist anywhere in the project or secret store. This document contains no secrets.

## Goal
Automatic, recurring import of bookings from the source booking site into `synced_bookings`, replacing manual CSV uploads.

## The two endpoints (verified against actual code, 16 Oct 2026)

### 1. `booking-intake` — the push endpoint for the provider
File: `supabase/functions/booking-intake/index.ts`. This is the endpoint an external system would call.

**Authentication (either one):**
- `x-sync-token` header compared (timing-safe) against the `BOOKING_SYNC_TOKEN` secret — **this secret is NOT set**, so token auth is currently impossible; or
- an admin user session (Bearer JWT, `admin` role verified server-side).

**Push contract:**
```json
{
  "source_system": "bookings.teachingtekkers.com",
  "source_camp_id": "124",
  "extracted_at": "2026-10-16T00:00:00Z",
  "bookings": [ { "child_first_name": "...", "child_last_name": "...", "...": "one object per participant registration" } ]
}
```
- Recognised booking fields: `external_booking_id`, `camp_name` (required), `camp_date`, `venue`, `county`, `child_first_name`/`child_last_name` (required), `date_of_birth`, `age`, `parent_name`, `parent_phone`, `parent_email`, `emergency_contact`, `alternate_phone`, `medical_condition`, `medical_notes`, `kit_size`, `payment_status`, `booking_status`, `booking_date`, `total_amount`, `amount_paid`, `sibling_discount`, `refund_amount`, `payment_type`, `amount_owed`, `photo_permission`.
- Money fields accept numbers or "€85.00" strings; dates accept `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`; photo permission accepts yes/no/true/false/1/0.
- Behavior: routes into the shared engine's `syncCamp` — **automatic apply**, not preview. The source camp must already be linked in `source_camp_mappings` (else 422). Safe rows are applied immediately; ambiguous rows and staff-edit conflicts are queued for review (`booking_import_run_rows.review_status='pending'`). Refund/cancelled rows are never auto-updated financially.
- Also supports an admin-only `{ "rematch_ids": [...] }` action that only recalculates camp links of unmatched rows.
- Anything else returns 410 with instructions.

### 2. `booking-import` — the admin UI endpoint (manual CSV + review)
File: `supabase/functions/booking-import/index.ts`. Admin session required (no sync token).

Actions:
- `preview` — stage a manual import: `{ action:"preview", source_camp_id, camp_id, rows[], file_name }`. Creates the source-camp mapping on first use. Nothing is written to bookings.
- `commit` — apply a staged preview: `{ action:"commit", run_id, resolutions }`.
- `resolve` — resolve one review row: `{ action:"resolve", row_id, decision }`.
- `sync` — same automatic-apply path as booking-intake (`syncCamp`), for completeness.

## Identity and matching semantics (shared engine, `supabase/functions/_shared/booking-engine.ts` + `booking-logic.ts`)
- Participant identity: source participant ID if present, else child name + DOB + guardian contact, scoped to the explicit `source_camp_id`. Row position / "Sr. No" is never an identity.
- Family booking identity is separate (`source_family_bookings`); a family booking ID is never used as a participant ID.
- **Provider event/webhook IDs are NOT currently supported**: there is no event-ID deduplication, no webhook signature verification, and no per-event log. Retries are safe only because participant identity is deterministic (`external_booking_id = src:<source_camp_id>:<participant_id|participant_key>`, upsert with ignore-duplicates).
- Staff edits (payments, kit, notes, attendance) are protected: imports only overwrite a field when it still equals the previous import's stored `source_values`.
- Applying is resumable: per-row `applied` flags, per-source-camp lock (10 min), failed runs marked failed.

## What the provider must supply before sync can be enabled
1. A push webhook or pollable feed with one record per participant registration per camp, including: source camp ID, stable participant ID, family booking ID, child name, DOB, guardian name/email/phone, total amount, amount paid, kit size, medical notes, photo permission, booking date, booking status.
2. Stable IDs across runs (no renumbering).
3. A shared secret for `x-sync-token` (to be stored as `BOOKING_SYNC_TOKEN` in Project Settings → Secrets — never in code).
4. Documented refund/cancellation semantics (is `amount_paid` gross or net of refunds? does `total_amount` change on cancellation?) — currently unproven, blocking automatic financial updates for those rows.

## Setup steps once the provider confirms
1. Store the token as `BOOKING_SYNC_TOKEN` in Secrets.
2. Ensure every source camp is mapped (manual import once, or the mapping rows created during the July 2026 reconciliation: 124→WK1, 125→WK2, 176→Halloween).
3. Point the provider webhook at the `booking-intake` function URL with the `x-sync-token` header.
4. Monitor `booking_sync_settings` (pause flag, last success/failure) and the review queue.

## Current state
- `BOOKING_SYNC_TOKEN`: not set. Sync: not connected. No scheduled job exists.
- Known mappings: 124 (WK1, 6 Jul), 125 (WK2, 20 Jul), 176 (Halloween, 27 Oct) — all Portmarnock AFC.
