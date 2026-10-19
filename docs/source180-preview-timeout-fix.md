# Source 180 preview timeout — diagnosis, fix and verification (19 Oct 2026)

## Failure
- 18:32:11 UTC, booking-import revision 23: POST 500 after 30.8 s. Postgres log (authenticator,
  `statement_timeout=8s`): `57014 canceling statement due to statement timeout` in
  `stage_csv_safety_run`, which compared the multi-MB round-tripped snapshot payload with a fresh
  `csv_safety_snapshot()`. The catch block stringified the PostgREST error object →
  UI showed `[object Object]`; Confirm import stayed disabled (fail closed). Nothing staged.

## Fix
- Migration 0009: `csv_safety_evidence()` returns snapshot + md5 digest of that same snapshot;
  `csv_safety_snapshot_digest()`; staging requires a valid digest and stores only `{digest}`;
  `commit_csv_safety_run` rechecks the digest under its table lock; previews without a digest
  (all older full-snapshot runs) are stale. New functions: service_role only.
- `_shared/booking-errors.ts` readable errors (57014 → 503 "nothing saved"); client
  `src/lib/importPreviewContract.ts` rejects error bodies and incomplete previews.
- booking-import redeployed, source SHA-256 19dcc8a35160e8a8cec1879ec3f21b2fe108b16176d28f4b2c564bb2014f36ee.

## Verification
- Real signed-in normal browser preview, verified by Codex (owner side) 19 Oct 2026:
  24 rows, 17 new / 7 review / 0 rejected, no commit.
- Read-only DB: latest source 180 run `9c23fc5e-ad7d-4db4-9100-24a6b1479e13`, status `preview`,
  created 18:38:43 UTC, digest stored, counts 24/17 new/7 ambiguous/0 rejected, 0 applied rows,
  0 change-audit entries. 0 change-audit entries in the last 24 h; 425 corrections staged, 81 held.
- Isolated disposable PostgreSQL 17 (schema from repo migrations, stub auth, Unix sockets
  only, run as user `lovable` via Python setuid; never live DB, no sessions):
  `csvSafeguardsDatabase` 13/13 passed (10 existing incl. concurrency/lock, stale evidence,
  rollback, retry idempotency, authorization + 3 new digest tests: missing/malformed/tampered/
  legacy-snapshot staging rejected, old/tampered stored digest stale at commit, privileges);
  `csvInvalidPreviewGuard` 1/1 passed on an empty separate cluster.
- Pure suite: 94 passed, 14 skipped (the isolated DB files when not opted in).
