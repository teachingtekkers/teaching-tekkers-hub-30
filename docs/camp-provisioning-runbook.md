# Camp Provisioning Runbook (private operator doc)

Repeatable, safe path for creating app camps from verified source-system camps
(bookings.teachingtekkers.com). Used first for Halloween 2026 sources 177–181
(audit batch `halloween_camp_provision_2026_10_17`).

## Access model

- Admin-only. The provisioning block runs through the privileged database query
  tool inside Lovable Cloud. There is NO unauthenticated write path, no edge
  function, and no client-side code for this. Do not create one without a
  separate review.
- No secrets are involved or stored in this document.

## Identity rules

- Identity is `source_system` + `source_camp_id`, never the camp name.
- Uniqueness is enforced by the unique index
  `source_camp_mappings(source_system, source_camp_id)` — concurrent or retried
  runs cannot create duplicate mappings.
- A source camp maps to exactly one app camp. Never remap an existing mapping
  without an explicit, separately audited decision.

## Required source fields (hold if any is absent — never fabricate)

Per source camp, verified by an authenticated read of
`https://bookings.teachingtekkers.com/camp/{id}/edit` (record the read date):

- source_camp_id (from the URL)
- camp name, club name, county
- start date and end date (or explicit duration/day range to derive end)
- daily start/end times
- age range
- maximum participants (capacity)
- price per child
- venue street address — if unknown, leave the app venue field BLANK and flag
  it in the audit evidence; do not invent an address.

Reference-only values (family/participant counts from the listing) are NOT
capacity and must not be written to the camp.

## Validation before creation

- Dates: start and end must be real calendar dates, end >= start, and the
  derived end must come from an explicit duration/day range, not guesswork.
- Capacity must be a positive integer from the source Maximum Participants
  field.
- Price must be a non-negative number from the source price field.
- If any check fails: HOLD the source camp, record the reason in the audit,
  create nothing.

## Existing-camp reuse rules

Reuse an existing app camp ONLY when the event identity fully matches:

- club name AND county AND start date AND end date AND camp name/type all match
  (same club+county+start alone is NOT enough — girls-only, morning/afternoon,
  or different camp types can share those).
- Exactly one candidate (active or archived) matches. Zero candidates → create
  new. More than one → HOLD and record candidates in the audit.
- Reuse never overwrites existing camp fields (staff edits are preserved); it
  only adds the mapping.

## Transaction / retry / rollback

- The whole batch runs as ONE atomic block: any failure rolls back everything.
- Per source camp, in order:
  1. Mapping exists → reuse (audit status `reused`), done.
  2. Fully matching camp found → reuse camp, insert mapping
     (`ON CONFLICT (source_system, source_camp_id) DO NOTHING`).
  3. Ambiguous candidates → HOLD, audit status `held`, no writes.
  4. Otherwise → insert camp + mapping together.
- Every decision writes a `data_repair_audit` row (kind `camp_provision`) with
  before/after and evidence: source URL, verification date, who verified,
  dates, times, ages, price, discounts, kit/football notes.
- Retry safety: re-running the same batch must produce only `reused` audit rows
  and zero new camps/mappings. Verify this after every batch.
- Rollback: to undo a batch, delete the created camps by the IDs recorded in
  the audit `after.camp_id` and their mappings — only after re-reading each row
  and confirming it still matches the audited `after` state and has no
  dependent rows (bookings, attendance, rosters). Skip and report anything
  staff changed since.

## New-camp field conventions

- status: `active` (the dominant existing convention; the app's "Published"
  filter includes any status other than `draft`/`archived`, and import/
  attendance selectors exclude only `archived`).
- is_auto_created: `false` (provisioned from verified evidence, not auto-sync).
- venue: blank if unknown (see above).

## Operator contract for scheduled runs (Codex browser + Lovable)

1. Codex collects source camp settings via authenticated browser reads of the
   source admin (no live provider feed; booking-intake stays disabled).
2. Codex hands Lovable the verified field set per source camp.
3. Lovable validates fields, runs the atomic block, writes audit rows.
4. Lovable re-runs the batch as a retry check (expect all `reused`) and reports
   created/reused/held IDs.
5. No bookings are imported by this path. Registration import remains a
   separate preview-first flow.

## First batch reference

- Batch: `halloween_camp_provision_2026_10_17` (5 applied, 0 held)
- Retry check: `halloween_camp_provision_2026_10_17_retry` (5 reused, 0 new)
- Sources 177–181 → camps created 2026-10-17; source 176 (Portmarnock) and
  July camps 124/125/128 were pre-existing and untouched.
