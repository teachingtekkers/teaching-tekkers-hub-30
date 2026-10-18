# CSV safety implementation
- [ ] Fix quoted CSV parsing, enforce one-file upload, and test 20 logical records without lost/aligned fields.
- [ ] Inspect source 179 preview read-only and block its invalid commit; preserve all holds and financial records.
- [ ] Run focused regression tests and report official-file/authenticated-UI limits.
- [x] Global snapshot (no 1,000-row cap), conservative cross-camp/profile proof and historical holds.
- [x] Strict Gregorian calendar and bounded finite money; refund/cancellation and duplicate holds.
- [x] Admin-only persisted skip decisions and atomic immutable-plan commit, snapshot revalidation, policy trigger, complete audit and retry serialization; migrations 0005–0007 applied.
- [x] 73/73 regressions, 10/10 isolated PostgreSQL tests with rollback/lock contention; preview build OK. No real imports or auth calls. See docs/csv-safeguards-validation.md for exact limits: one file, conservative whole-table stale guard, skip-only review, no authenticated browser/live concurrency validation.