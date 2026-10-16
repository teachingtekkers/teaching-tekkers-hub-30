# Booking Sync — Provider Integration Handoff (private, developer only)

Status: **NOT CONNECTED — NOT PRODUCTION-READY.** No messages have been sent to the provider. No provider credentials exist anywhere in the project or secret store. This document contains no secrets. Known pre-launch validation gaps are listed at the end and must be closed before enabling.

## Goal
Automatic, recurring import of bookings from the source booking site into `synced_bookings`, replacing manual CSV uploads.

## The two endpoints (verified against actual code, 16 Oct 2026)

### 1. `booking-intake` — the push endpoint for the provider
File: `supabase/functions/booking-intake/index.ts`. This is the endpoint an external system would call.

**Authentication (either one):**
- `x-sync-token` header compared (timing-safe) against the `BOOKING_SYNC_TOKEN` secret — **this secret is NOT set**, so token auth is currently impossible; or
- an admin user session (Bearer JWT, `admin` role verified server-side).

**Push contract:** `{ source_camp_id, bookings[] }` is routed directly into the shared engine's `syncCamp` (`supabase/functions/_shared/booking-engine.ts`), which calls `planImport` in `_shared/booking-logic.ts`. Each element of `bookings[]` is treated as `Incoming = Record<string, string | undefined>` — a flat string-keyed object. **All values should be strings.**

**Supported identity keys (the essential ones the old doc omitted):**
- `source_participant_id` — stable per-participant ID from the source system. Trimmed string. This is the primary participant identity: rows matching an existing record's `source_participant_id` are matched with full confidence.
- `source_booking_id` — the source family-booking ID. Trimmed string. Establishes family booking identity (`family_verified`, `source_family_bookings`) and is never used as a participant ID.

If `source_participant_id` is absent, identity falls back to child name + date of birth + guardian contact, scoped to the explicit `source_camp_id`. Row position / "Sr. No" is never an identity.

**Other recognised per-booking keys** (consumed by `normaliseIncoming` in `booking-logic.ts`):
`child_first_name`, `child_last_name` (both required — a row missing either is rejected), `parent_name`, `parent_phone`, `parent_email`, `emergency_contact`, `alternate_phone`, `date_of_birth`, `age`, `medical_condition`, `medical_notes`, `photo_permission`, `booking_date`, `booking_status`, `kit_size`, `total_amount`, `sibling_discount`, `amount_paid`, `refund_amount`, `payment_status`, `payment_type`.

**Ignored / computed fields:**
- `amount_owed` is **computed** by `computeOwed` (total − paid; `null` → review for refund/cancelled rows). Any `amount_owed` sent in the payload is ignored.
- `camp_name`, `camp_date`, `venue`, `county`, `external_booking_id` appear in the legacy `IncomingBooking` interface in `booking-intake/index.ts`, but that interface is only used by the admin `rematch_ids` path. **The push path does not read or validate them** — `camp_name` is NOT required for a push; the camp is determined solely by `source_camp_id` via `source_camp_mappings`. Do not rely on them.
- The deterministic storage key is built by the engine: `external_booking_id = src:<source_camp_id>:<source_participant_id|participant_key>`, upserted with `onConflict: external_booking_id,source_system, ignoreDuplicates: true`. This is engine-computed, not a payload field.

**Fictional example payload (syntactically valid, exact supported keys, all strings):**
```json
{
  "source_system": "bookings.example.com",
  "source_camp_id": "124",
  "extracted_at": "2026-10-16T00:00:00Z",
  "bookings": [
    {
      "source_participant_id": "90001",
      "source_booking_id": "7001",
      "child_first_name": "Alex",
      "child_last_name": "Example",
      "date_of_birth": "15/03/2017",
      "parent_name": "Sam Example",
      "parent_email": "sam.example@example.com",
      "parent_phone": "0851234567",
      "medical_condition": "",
      "medical_notes": "",
      "photo_permission": "yes",
      "booking_date": "2026-05-03",
      "booking_status": "confirmed",
      "kit_size": "S",
      "total_amount": "85.00",
      "sibling_discount": "10.00",
      "amount_paid": "0.00",
      "refund_amount": "0.00",
      "payment_status": "unpaid",
      "payment_type": "card"
    }
  ]
}
```

**Behavior:** automatic apply, **not** preview. The source camp must already be linked in `source_camp_mappings` (else 422). Safe rows are applied immediately; ambiguous rows and staff-edit conflicts are queued for review (`booking_import_run_rows.review_status='pending'`). Refund/cancelled rows are never auto-updated financially. Applying is resumable: per-row `applied` flags, per-source-camp lock (10 min), failed runs marked failed.

Also supports an admin-only `{ "rematch_ids": [...] }` action that only recalculates camp links of unmatched rows (this is the only consumer of the legacy `IncomingBooking` interface). Anything else returns 410 with instructions.

### 2. `booking-import` — the admin UI endpoint (manual CSV + review)
File: `supabase/functions/booking-import/index.ts`. Admin session required (no sync token).

Actions:
- `preview` — stage a manual import: `{ action:"preview", source_camp_id, camp_id, rows[], file_name }`. Creates the source-camp mapping on first use. Nothing is written to bookings.
- `commit` — apply a staged preview: `{ action:"commit", run_id, resolutions }`.
- `resolve` — resolve one review row: `{ action:"resolve", row_id, decision }`.
- `sync` — same automatic-apply path as booking-intake (`syncCamp`), for completeness.

## Identity and matching semantics (shared engine, `_shared/booking-engine.ts` + `_shared/booking-logic.ts`)
- Participant identity: `source_participant_id` if present, else child name + DOB + guardian contact, scoped to the explicit `source_camp_id`.
- Family booking identity is separate (`source_family_bookings` via `source_booking_id`); a family booking ID is never used as a participant ID.
- **Provider event/webhook IDs are NOT currently supported**: there is no event-ID deduplication, no webhook signature verification, and no per-event log. Retries are safe only because participant identity is deterministic (engine-computed `external_booking_id`, upsert ignore-duplicates).
- Staff edits (payments, kit, notes, attendance) are protected: imports only overwrite a field when it still equals the previous import's stored `source_values`.

## Pre-launch validation gaps (must be closed before enabling sync)
1. **Money parsing defaults to zero.** `parseMoney` returns `0` for missing, empty, or unparseable values. A malformed `total_amount` silently becomes €0 rather than an error. No payload validation rejects non-numeric money.
2. **Date parsing is permissive.** `safeParseDate` checks only numeric ranges (month 1–12, day 1–31, year 1900–2100); impossible dates like 31/02/2026 pass. Unparseable dates become `null` silently (except DOB, which rejects the row only when a value was supplied but unreadable).
3. No schema validation on the push body beyond `source_camp_id` + `bookings[]` being present; unknown keys are silently ignored.
4. No event-ID deduplication or webhook signature verification (see above).
5. Refund/cancellation semantics unproven — those rows are held for review, never auto-applied financially.

## What the provider must supply before sync can be enabled
1. A push webhook or pollable feed with one record per participant registration per camp, using the keys above — critically `source_participant_id` and `source_booking_id`.
2. Stable IDs across runs (no renumbering).
3. A shared secret for `x-sync-token` (to be stored as `BOOKING_SYNC_TOKEN` in Project Settings → Secrets — never in code).
4. Documented refund/cancellation semantics (is `amount_paid` gross or net of refunds? does `total_amount` change on cancellation?) — currently unproven, blocking automatic financial updates for those rows.

## Setup steps once the provider confirms (and the gaps above are closed)
1. Store the token as `BOOKING_SYNC_TOKEN` in Secrets.
2. Ensure every source camp is mapped (manual import once, or the mapping rows created during the July 2026 reconciliation: 124→WK1, 125→WK2, 176→Halloween).
3. Point the provider webhook at the `booking-intake` function URL with the `x-sync-token` header.
4. Monitor `booking_sync_settings` (pause flag, last success/failure) and the review queue.

## Current state
- `BOOKING_SYNC_TOKEN`: not set. Sync: not connected. No scheduled job exists.
- Known mappings: 124 (WK1, 6 Jul), 125 (WK2, 20 Jul), 176 (Halloween, 27 Oct) — all Portmarnock AFC.
