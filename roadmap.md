# CSV safety implementation
- [x] Verify source180 runtime revision and nine exact durable audit targets; redeploy only corrected booking-import, document saved-preview visibility gap and preserve all booking/financial holds. Post-deployment authenticated preview awaits normal UI verification; no auth/session created.
- [x] Fix quoted CSV parsing, enforce one-file upload, and test 20 logical records without lost/misaligned fields.
- [x] Inspect source 179 preview read-only and block its invalid commit; preserve all holds and financial records.
- [x] 84 focused tests passed including isolated commit-blocker rollback; harness build OK. Official file absent; corrected authenticated upload/fresh preview not exercised. See docs/parkville-csv-parser-validation.md.
- [x] Global snapshot (no 1,000-row cap), conservative cross-camp/profile proof and historical holds.
- [x] Strict Gregorian calendar and bounded finite money; refund/cancellation and duplicate holds.
- [x] Admin-only persisted skip decisions and atomic immutable-plan commit, snapshot revalidation, policy trigger, complete audit and retry serialization; migrations 0005–0007 applied.
- [x] 73/73 regressions, 10/10 isolated PostgreSQL tests with rollback/lock contention; preview build OK. No real imports or auth calls. See docs/csv-safeguards-validation.md for exact limits: one file, conservative whole-table stale guard, skip-only review, no authenticated browser/live concurrency validation.