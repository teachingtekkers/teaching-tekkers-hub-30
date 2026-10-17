# Normal CSV importer: read-only audit, 17 October 2026

No matching behavior, authentication, bookings, mappings, settings or financial values changed during this audit.

## Identity coverage — not global

`booking-engine.ts:18–31` fetches only registrations in the exact source system/source camp, plus legacy destination-camp registrations with null source camp ID. `prepareRun` passes that set to `planImport` (`:59–60`). The planner does not query `players`, all registrations, or native `bookings`. Registrations in other camps, and destination registrations carrying another non-null source camp ID, are outside that search. A new classification is therefore **not clearance of all person-profile identity conflicts**. Cross-week attendance is allowed by source-camp scoping, but a conflicting existing person elsewhere is not automatically flagged or linked. New registrations do not automatically create/link player profiles.

## Commit revalidation — limited, not atomic

`applyRun` (`booking-engine.ts:140–274`) reloads the staged run and rows. Its check for another committing source-camp run and conditional update of this run (`:155–162`) are separate requests: two different runs can pass the check concurrently. This is not a transaction-level source lock.

The same scoped existing-registration list is refreshed once (`:185–187`). Rows originally classified new are re-planned (`:220–228`), excluding already claimed IDs; that list is not a global lookup and is not updated after each insert. Ambiguous rows explicitly resolved as new bypass that revalidation condition.

Matched rows are re-read and `computePatch` reapplied (`:108–119`), protecting detected staff edits against stored source baselines. However, the subsequent update filters only by ID: an edit between read and update can race. Identity metadata/source baseline is assigned separately, without full optimistic before-state comparison. Commit checks that the camp exists, but does not revalidate that the current mapping still agrees with the preview before its final mapping upsert.

Deterministic external registration IDs and the existing `(external_booking_id, source_system)` uniqueness constraint protect same-key retries. They do not establish global person uniqueness. Upsert ignore-duplicates does not verify that a collision's stored content equals the proposed row, and created counters can count an ignored insert attempt. Applied-row flags support resumption, but multiple sequential writes are not an all-or-nothing transaction; failures may leave partial work.

## Before-state — not rollback-ready

Preview stores raw source rows, normalization, classifications and planned field diffs (`:70–88`). Commit stores actual diff/protected fields for linked rows (`:240–250`) and the resulting registration ID. There is no complete immutable before/after registration snapshot, family/mapping snapshot, or dependency inventory in this normal-import path. `source_values` stores the latest imported baseline, not a full historical staff-state snapshot. Manual repair audit batches are a separate mechanism and should not be assumed to cover normal imports.

## Connection display verification

Latest committed manual CSV history is queried independently of legacy sync logs. Only `trigger=manual`, `status=committed`, non-null `committed_at`, non-synthetic runs qualify. Pending-review/failed/preview runs are not advertised as completed imports.

Read-only database check found latest committed CSV run `0734c9c5-df1a-49b1-ab70-edc7670542df`, source 176, committed **16 October 2026 19:21:48.814 UTC**. Provider/live sync remains disconnected regardless of CSV activity. Codex browser collection is configured externally; its scheduler health is unverified by the app. The unchanged pause setting gates `syncCamp` only; it does not enable a connection, control Codex or block manual import.

Verification scope: source audit, read-only import-history query, component-state/query tests and preview compilation. No authenticated browser check: available authentication status was signed_out; no session was created or restored. No live commit/concurrency experiment was performed.