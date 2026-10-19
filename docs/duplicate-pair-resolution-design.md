# Duplicate-pair resolution design (owner-authorized, case-specific)

Status: DESIGN ONLY — not implemented, no real data applied. Owner decision already
recorded: each pair is ONE child attending ONCE, with BOTH source booking histories
retained. Case-specific to these two pairs only; never a general merge rule.

- Noah Moloney, source camp 178 (Dunboyne AFC Halloween 2026): source booking IDs 8061 + 8064
- Axel Cosgrave, source camp 181 (St. Josephs AFC Kilmuckridge Halloween 2026): source booking IDs 8008 + 8009

## Why the current importer cannot resolve this

1. `applyGlobalSafety` marks BOTH rows of an in-file identity duplicate `ambiguous`
   with `_safety_hold = true`, `candidate_ids = []`, `diff = null`.
2. The hardened decision path (`save_csv_decisions` + `commit_csv_safety_run`)
   accepts only `skip` for safety-held rows. Skipping row 2 leaves row 1 held.
3. The CSVs carry no durable source booking IDs, so the evidence (8061/8064,
   8008/8009) must come from the explicit decision payload, not the file.

## Proposed supported mechanism: `attend_once_keep_histories` decision

A new explicit decision type, applied to BOTH rows of a proven identity-duplicate
pair, carrying evidence. Never inferred; only valid when an authenticated admin
sets it per pair.

### Decision payload (per pair, keyed by identity — not row index)

```json
{
  "decision": "attend_once_keep_histories",
  "identity_key": "noah|moloney|2015-…|normalized-contact",
  "source_booking_ids": ["8061", "8064"],
  "primary_source_booking_id": "8061",
  "note": "Owner-confirmed 18 Oct: one child, one attendance, both histories kept"
}
```

Identity key = normalized name + DOB + normalized guardian email OR phone, so
repeated and reordered CSVs resolve to the same decision; row position is never
used. The decision is stored server-side (`save_csv_decisions` extension) and
re-validated inside the commit transaction.

### Commit behaviour (inside the existing atomic `commit_csv_safety_run`)

1. Re-derive the pair from the persisted plan: exactly two rows, same proven
   identity, both currently safety-held as in-file duplicates. Any drift aborts.
2. Import ONE registration from the row whose source booking ID matches
   `primary_source_booking_id` (owner designates the primary; if the CSV has no
   booking IDs, the admin designates row A or B explicitly in the UI — the choice
   is recorded, never silent).
3. Store BOTH source booking IDs on the kept registration (`source_values` evidence
   JSON + `data_repair_audit` entry with before/after and the full decision payload).
4. Financials: use ONLY the primary booking's values (total/paid/owed as computed
   by the existing rules). The secondary booking's amounts are preserved as
   evidence text but NEVER added, averaged, or consolidated — no double-counting,
   no arbitrary financial selection beyond the owner-designated primary.
5. The skipped row is recorded as `resolution: 'attend_once_secondary'` with a
   link to the kept registration ID, so both histories remain traceable.
6. Idempotent: re-running the same run/pair is a no-op; a fresh CSV containing the
   same child matches the kept registration by identity and imports unchanged.

### Guardrails

- Decision rejected unless the pair matches the owner-authorized list
  (178/Moloney/8061+8064, 181/Cosgrave/8008+8009) — enforced server-side, so the
  mechanism cannot be used for broad duplicate merging.
- Medical/consent fields: if the two rows differ, the pair stays held; no
  automatic pick.
- No change to the 425 staged corrections, existing holds, or any stored values.

## Implementation checklist (next step, after owner approves design)

1. Extend `save_csv_decisions` RPC to accept and persist `attend_once_keep_histories`
   with the evidence payload (validated against the authorized pair list).
2. Extend `commit_csv_safety_run` to execute the behaviour above atomically.
3. `booking-safety.ts`: emit a pair-scoped hold token so the UI can offer the
   decision only for the authorized pairs.
4. `ImportPreviewStep.tsx`: decision UI for the pair (designate primary row,
   shows both source booking IDs).
5. Synthetic tests: resolve, reorder stability, repeat import unchanged, wrong
   booking IDs rejected, differing medical/consent stays held, rollback.
