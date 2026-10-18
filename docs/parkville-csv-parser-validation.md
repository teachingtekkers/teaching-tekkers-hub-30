# Parkville CSV parser correction — 18 October 2026

## Read-only evidence
- Source179 latest persisted run: `9b32b6fb-7dcc-4d62-a91f-9f4ca7e85536`, created 18:29:33 UTC, status `preview`.
- Persisted counts: 20 submitted rows, 17 new, 2 ambiguous, 1 rejected, 19 accepted participant registrations. This does **not** establish that those 20 submitted objects represent the correct 20 source children.
- Rejected logical preview row13: `Missing total_amount`, 12 mapped fields versus 20–23 elsewhere. No persisted mapped field contains a newline. This is consistent with stripped/split multiline data; the original file is required to establish its exact raw syntax.
- Old upload code split physical lines before quote parsing, reset quote state per line, filled absent cells and discarded extra columns. This is a confirmed parser defect, not a claim that every observed discrepancy has been independently reproduced on the official file.
- User-supplied official-file SHA256: `b97236e3d33660d0256469cb7b30e5215c6c1905f8627b2bcde9445dc6693cf7`. The named Parkville file is not available in this sandbox, so its hash/raw bytes and reported 22-row UI state were not independently verified.
- No private medical/contact values are reproduced here.

## Changes
- `src/lib/bookingCsv.ts` uses Papa Parse 5.7 for quoted logical CSV records, escaped quotes, BOM, CRLF, comma/semicolon/tab detection and embedded newlines. Values remain strings; no dynamic money/date coercion.
- Invalid quotes, mismatched column counts and duplicate/blank headers reject the upload before preview. No silent extra-cell discard.
- Upload accepts one file per confirmation, including drag/drop; removed multiple-file selector/copy and Add More.
- Migration0008 installs a database trigger blocking the exact diagnosed run's `committing` transition. Existing preview and evidence rows were **not** edited. A different fresh run is not blocked by this trigger; existing authorization, identity holds and atomic commit checks still apply.
- The trigger deliberately identifies a **preview run**, not a child or CSV row. It is not an identity-matching rule.

## Validation
- 84/84 focused tests passed: bookingCsv11, csvSafeguards36, bookingImportLogic26, bookingBalance6, bookingConnectionStatus4, csvInvalidPreviewGuard1.
- Parser fixture has exactly 20 logical children/Sr.No1–20 and a three-line quoted field in child13; all20 survive with aligned name/email/charged/paid/consent columns and20 eligible synthetic plans. Other tests cover delimiter detection, quoted blank lines, escaped quotes, malformed quotes, too few/many columns and ambiguous headers.
- Isolated PostgreSQL guard test loads the actual migration, rejects the old run transition, verifies unchanged saved counts/status, permits a different synthetic run, and rolls back all fixture schema/data. No live commit attempted.
- Harness preview build reported `build OK` after code/test edits; no manual build or typecheck run.
- Live read-only check: guard installed, run still preview, 2 ambiguous rows intact, 0 booking_import_changes for that run.
- Authenticated upload/fresh official preview was **not** exercised by this agent: no auth/session/logout calls or session generation. User's report establishes their browser now works, not verification of the corrected official-file flow.
- Original two review identities remain held pending evidence. No real booking imports, repairs, financial recalculation, held-row edits, provider activation or425corrections.

## Required next check
Upload the original official file in the corrected UI and generate a fresh preview: expect20 logical source rows with no parser-generated blank child. Review identities remain subject to evidence; do not assume new/held counts until the fresh preview is examined. Old persisted raw mapped rows cannot reconstruct multiline source bytes already lost by the defective parser.