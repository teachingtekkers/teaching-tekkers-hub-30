# Source 180 hold and deployment verification — 19 October 2026

## Observed live previews (read-only)

- `1c7bbb8c-086c-4a23-9663-631969acc8fb`, 10:16:47 UTC: 24 rows, 17 new, 7 ambiguous, 0 updated/unchanged/rejected.
- `760bec24-7c1c-443c-acbe-c2107e22bb9f`, 18:27:36 UTC: identical counts. Both remain `preview`; no commits were performed.
- Abby O’Regan has reason `Conflicting or multiple cross-camp person identities`, not the historical-hold reason. This investigation does not resolve her identity.

## Exact durable historical-hold provenance

All six names match existing registration evidence with target IDs in the saved snapshot's `held_audits`. The corresponding live audit rows are `owed_correction`, batch `payment_owed_correction_2026`, status `staged`, created 15 October 2026 at 10:06:30.818801 UTC, with no `applied_at`. These are payment-repair evidence, not pending-preview decisions. All nine registrations below have `needs_admin_review=false` and `duplicate_warning=false`; the audit target predicate causes these holds.

| Child | Existing registration ID | Staged audit ID |
|---|---|---|
| John O’Regan | `9d121efd-16f1-4163-aac5-765cac2fee7e` | `9167f66f-7545-41d8-966b-9b4eb6fe8799` |
| Theodore Honan | `51397ded-899c-4059-a655-b70d8c77e259` | `21b7c3d1-8d9c-4e12-8c94-72d01ea8e85d` |
| Theodore Honan | `64ded5ec-5ac9-4e31-a11f-55225e387af8` | `11ae2af5-9239-4c09-a9fa-dcc3938c82e5` |
| Jess McPartlin | `57c65afd-bc3e-415f-8515-78b0492ae74d` | `16bf08a2-8113-4986-88ca-f9a6803ecfac` |
| Jess McPartlin | `9a1da3e3-d655-4855-9c13-0b3b1119f1f7` | `87a5986b-dc94-4ee2-be29-22fe95a4bc15` |
| Logan Maher Mulligan | `845dc802-fab6-496e-867e-8213b1181dae` | `bd3e90cd-ea68-4cbc-944a-a02cb0917cef` |
| Jack Miller | `a88ea3b4-ddd3-49bf-95a7-d9b4f9690aeb` | `c576b591-80f1-49c3-9e97-f17a60811f29` |
| Sophie Miller | `2c0dbc44-58d7-47a3-82ac-6195c30a7d94` | `95cbdb4f-9fa6-4a58-bb53-42691b8d6420` |
| Sophie Miller | `f5490da4-b4b7-45d1-a0ef-99fff7b2ba0c` | `261b2b11-de26-4e62-b079-bb6e570f9bc7` |

The current safety predicate deliberately holds a same-normalized-name row when an existing evidence record has an ID in `held_audits`; that snapshot includes both staged and held repair audits. It does not consult pending previews. This broad durable-audit predicate is preserved, not relaxed. The historical label does not imply an admin made an identity decision about the Halloween child.

## Deployment evidence and limits

The authenticated 18:27:40 POST returned HTTP 200 on deployed `booking-import` revision **21**, verified from runtime request metadata. Repository contents and matching preview counts cannot prove that revision contained the pending-row correction; the six durable audits would produce the same result either way.

Only `booking-import` was explicitly redeployed through the supported deployment tool in this investigation. It returned success and submitted source/settings SHA-256 `4af53a8cbdebf8d2b6fa389ab57e72d78d17250bb2f1732c1cda1e707739c349`. The corrected local safety file SHA-256 is `d49d7400983e6b4d511b501b2ba02e7a48156a2c19db84df5072e20a1a3b5342`.

An unauthenticated OPTIONS-only readiness request returned HTTP 200 at approximately 18:30:09 UTC. It does not execute preview matching or auth. Subsequent analytics reads still exposed only pre-deployment revision-21 requests: the new live revision number/source digest is not independently verified. Deployment-tool success and submitted digest are confirmed, not authenticated post-deployment execution. A fresh normal authenticated preview is required to validate post-deployment matching; no such request was performed here. Existing persisted previews are not recomputed by a deployment. Expect the six staged-audit holds to persist, not necessarily a drop in review count.

## Sync & Review visibility gap (documented only)

Read-only counts: 0 rows with `review_status='pending'`; 2 non-preview history runs; 10 saved preview runs across sources 176–181 (including superseded previews).

`SyncReviewPanel` excludes `status='preview'` from history and selects only `review_status='pending'` for the queue. Preview staging leaves that row field null; the commit path marks skipped ambiguous rows pending. Thus “Waiting for review 0 / Nothing waiting” describes the post-commit queue, not unresolved saved previews. User-reported UI agrees with database/query evidence; no browser session was used here and no UI change was made.

## Duplicate-pair evidence retained

Owner-authorized one-attendance decision remains design-only. Independent local comparison reports Noah 178 / booking histories 8061+8064 differs only in row number and alternate number; Axel 181 / histories 8008+8009 also differs in medical condition. Each row has €85 total, €0 paid, €0 refund, Unpaid, Cash. No primary source assignment is verified. Equal money does not resolve provenance or authorize medical selection. Both pairs remain held; no implementation, merge, financial consolidation or commit occurred.

## Validation and preserved scope

65 synthetic tests passed: 39 CSV safeguards and 26 booking-import logic tests. No application code or schema changed; no manual build was run. The automatic preview build log reports `build OK` at 18:30:45 UTC. No real preview/import/commit, booking mutation, auth/session/mint/logout, provider activation or financial/medical/consent update was performed. The 425 payment corrections remain staged.