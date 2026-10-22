# Source 176 preview failure (22 Oct): what happened and the proposed fix

## What the evidence shows (read-only checks)
- **Exact error:** the booking-import logs at 18:34:45–46 UTC show two boots, then `ERROR CPU Time exceeded` and `shutdown` at 18:34:50 UTC. The service ran out of its processing-time allowance. This is not a database error.
- **Different from the 19 Oct failure:** that one was the database timeout (57014) while saving the preview, which migration 0009 fixed. Today the logs show no database error. The service stopped while it was still doing its own work.
- **Where it failed:** before any preview was saved. No preview runs were created in the last 2 days. The latest saved source 176 preview is still `6c326dcf` from 19 Oct (95 rows). So the service died while comparing the file in memory, between loading the safety evidence and saving the preview.
- **No writes at all:** 0 runs, 0 change-audit entries and 0 new bookings in the last 2 days. Confirm import stayed disabled, so it failed closed as intended.
- **Protected records are untouched:** 425 corrections are still staged and 81 records are still held.
- **Why now:** this file has 104 rows, against 95 for that camp and a full cross-camp snapshot of every child. The 19 Oct source 180 file had 24 rows. The matching code checks each row against the whole snapshot, so the work grows with rows × snapshot size. That pushed it past the processing limit. This is the most likely cause, but no profiling has been done yet, so it is unconfirmed.

## Capacities: not changed in the app
- Source 176 → Portmarnock AFC Halloween Camp 2026: the app shows **95** (you say the source is now 105).
- Source 178 → Dunboyne AFC Halloween Camp 2026: the app shows **55** (you say the source is now 60).
- Nothing was updated. Changing them would be a separate, explicit step that you approve.

## Proposed smallest fix (only if you approve it)
1. Time the preview's matching steps on a synthetic 104-row file against a snapshot of the same size, offline. This confirms which loop uses up the time.
2. In the shared safety and matching code, build lookup tables once per preview, keyed by normalized name+DOB, guardian email/phone and source participant ID. Use them instead of scanning the whole snapshot for every row. Matching rules, hold rules and the digest stay exactly the same.
3. Add a test that gives the same results as before on the existing cases. Add a performance test so a 3,000-row file against a large synthetic snapshot finishes well inside the limit.
4. Redeploy only booking-import. Then you run a fresh normal source 176 preview, without confirming.

There is no fallback, no skipping of safety checks and no change to the commit path. The 425 corrections, holds, duplicate pairs, financial/medical/consent fields and provider sync are not touched.

## Technical notes
- The edge CPU limit is separate from the wall-clock limit. The log ran about 5 s of wall time, and the error is CPU only.
- Candidates to check: `applyGlobalSafety` / `scopedExisting` in `_shared/booking-safety.ts` and `planImport` in `_shared/booking-logic.ts`.
- Also check that a CPU kill returns readable JSON. Today the client showed the platform's generic message. That is already fail-closed, but it could say "nothing was saved".
