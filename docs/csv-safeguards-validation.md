# CSV safeguards implementation — 17 October 2026

## Scope and live-data preservation
Schema/functions and importer code only. No real previews, commits, historical repairs,
balance corrections, auth/session generation or provider activation were performed.
Automatic intake is disabled; manual confirmation remains required.

## Contract
- `preview` accepts one mapped source camp, raw string-valued mapped rows, file name.
  Requires authenticated admin, existing verified mapping and 1–3000 rows.
- Server reads a single SQL snapshot of **all** profiles, registrations, native bookings,
  camps, mappings, families, attendance, staged/held repair evidence and pending reviews.
  JSON aggregate has no 1,000-row Data API cap. This replaces limited client pagination.
- Name + DOB + normalized email **or** phone establishes person evidence. A unique
  compatible profile is reused for another camp without modifying that profile.
  DOB/contact contradictions, multiple profiles, duplicate destination registrations,
  pending/historical identities, medical/consent changes, protected fields and uncertain
  refund/cancellation ledgers are held. Existing Noah/Conall/Caden holds are explicit.
  Source 178 rows 34/35 and 181 rows 24/25 are hold evidence, not permanent identities.
- `decisions` accepts persisted run ID and zero-based row-to-`skip` decisions only.
  An authenticated admin RPC stores the decisions; no force-link/create/source-overwrite
  review decisions are accepted in this milestone.
- `commit` accepts **only run ID**. It uses the user's existing JWT, not service identity.
  Under global table write locks, complete snapshot equality revalidates matching,
  mapping, staff before-state, dependencies and previously absent candidates.
  Any evidence change aborts the entire transaction. Registration/profile/family inserts,
  updates, complete before/after audit and terminal status commit together.
- `booking_import_changes` stores inserted IDs and complete snapshots for every affected
  registration/profile/family. Preview retains complete original relevant-table state.
  Authenticated clients cannot mutate staged plans or audit records.
- Retry of a committed run returns its original result, `replayed=true`, with no writes.
  Different runs serialize; the second fails stale evidence rather than creating duplicates.
- Malformed/nonfinite/negative money is rejected. Required total/paid must be present.
  Optional absent discount/refund means zero. Currency/grouping must be syntactically valid,
  at most two decimals and at most 1,000,000. Dates must be full valid Gregorian dates,
  years 1900–2100. Total already includes sibling discount; owed is total minus paid only
  for established unrefunded/noncancelled cases.

## Rollback procedure (no real rollback executed)
1. Select one run and its `booking_import_changes`; do not operate by child names.
2. Begin one transaction and acquire the same global locks as commit. Include any newly
   introduced dependency tables when extending this procedure.
3. Re-read every target. A current row must equal its complete `after_state`; otherwise
   abort/hold, never overwrite later staff changes. Audit missing targets as already absent.
4. For inserted registrations check attendance, native booking links, all OTHER run rows,
   other import audit references, and any new foreign-key dependencies. The creating run's
   own row references are provenance, not proof that subsequent dependencies are safe.
   Check both synced_booking_id and player-based attendance links. Hold dependent rows.
5. Restore updated registrations from `before_state` only after these checks. Retire the
   creating run's own links in the same transaction before any approved insert reversal.
6. Remove inserted registrations only with explicit rollback approval and zero subsequent
   dependencies; then check profiles against synced/native bookings, attendance and all
   other references before removing profiles. Check families for registrations first.
7. Retain original immutable audit; mark the run rolled back and record reversal evidence.
   Never replay a rolled-back run. No automatic delete/rollback RPC is exposed.

## Validation and deliberate limits
Synthetic unit tests and an **isolated local PostgreSQL copy of schema only** exercise
identity, stale evidence, atomic failure/outer rollback, retry, audit, profile reuse,
authorization and lock contention. Auth is a stub UUID in the isolated database only;
no real auth calls/users/sessions are created. Every synthetic transaction rolls back.
Results: **73/73 regressions** (26 existing importer, 37 safeguard, 6 balance,
4 connection-display) and **10/10 isolated database tests** passed. Preview harness
build/typecheck: **build OK, 17 October 2026 15:34:02 UTC**.
Commands: `bunx vitest run src/test/bookingImportLogic.test.ts src/test/csvSafeguards.test.ts src/test/bookingBalance.test.ts src/test/bookingConnectionStatus.test.tsx`
and `CSV_ISOLATED_DB_TEST=1 bunx vitest run --config vitest.csv-db.config.ts`.
The latter requires the isolated schema-only PostgreSQL instance at the fixed local
Unix socket; it cannot fall back to live database credentials.

Parallel validation is lock-contention testing in two isolated connections (same/different
run attempts and ordinary writer), plus sequential second-run stale rejection; **not**
a completed two-admin browser race or live concurrent commit experiment.
Rollback coverage includes whole-transaction disappearance, mid-row-failure rollback,
and later staff-state/dependency rejection checks; the documented post-commit reversal
procedure is not an executable/tested automatic rollback feature.

Live verification: zero safety-version runs and zero new import change-audit entries;
425 staged payment corrections remain staged. Earlier camp counts from the previous
conversation were not assumed current; no attempt was made to restore them.

The full snapshot is deliberately conservative: an unrelated staff write in a relevant
table invalidates a preview. Global locks briefly block staff writes during commit;
large installations need measured load/performance work, not reduced safety. One CSV
per confirmation is enforced; multi-file batch atomicity is not implemented. Reviews
can only stay held/skipped, not force-resolve disputes. Existing pre-safety previews
must be recreated. Authenticated browser flow and live concurrency/commit are NOT
tested because the user forbids auth calls/session generation and real imports.

## Initial test failures corrected
- Candidate IDs needed explicit uuid[] casting in staging; corrected by migration 0006.
- Cross-camp tests caught undefined destination comparisons; corrected.
- Browser-only default test setup could not run PostgreSQL tests; dedicated config added.
- Type errors in synthetic fixture/combined evidence types corrected; preview build checked.