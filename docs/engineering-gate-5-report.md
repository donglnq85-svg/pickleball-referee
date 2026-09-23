# Engineering Gate #5 — Reporting & Group Completion Delivery

## Candidate boundary

- Base: Gate #4 merge `13846c427f35f1b93f19c8e23755fdbd0fa951b2`
- Branch: `codex/engineering-gate-5`
- Gate #5 merge: **not performed; Product Control audit required**
- Production deployment: **not performed**

## Architecture

- Match Report derives only from one exact confirmed Canonical Result Version.
- Group Report derives only from one exact immutable Group Snapshot.
- Reports never own or recalculate match score, standings, ranking or qualification.
- Each logical Match/Group report has an append-only revision ledger and at most one current revision.
- Reporting Policy is frozen in a Tournament Rules Version and independently configures Match and Group reporting as `required`, `optional` or `disabled`.
- Opening the system share sheet creates `reportShareSheetOpened` and `SHARED_UNCONFIRMED`; only explicit `ĐÃ GỬI BTC` creates `reportSent` and `SENT`.
- Result correction invalidates the old Match Report. A previously sent report creates a `NEEDS_RESEND` revision from the new current Result Version.
- A new Group Snapshot invalidates the old Group Report. Result, ranking and qualification impact remain separate; qualification changes carry high attention without auto-send or auto-confirmation.

## Vertical slice

`Canonical Result / Group Snapshot → Report preview → system share → explicit sent confirmation → Court Manager → reopen / resend`

Court Manager and Tournament Home project required reports, shared-but-unconfirmed reports and resend attention from persisted reporting state.

## Automated coverage

- Generated-but-unsent Match Report persistence/reload.
- Share sheet opened without sent confirmation.
- Explicit sent Reporting Event persistence/reload.
- Result v1 report → correction → old report `OUTDATED` → Result v2 report `NEEDS_RESEND` → resend confirmed.
- Group Snapshot v1 report → correction/recalculation → Group Snapshot v2 report revision.
- High attention for qualification change.
- Exact Result Version and Group Snapshot source IDs on every report revision.
- Required/optional/disabled Reporting Policy without hard-coded per-match sending.
- Full Gate #1–#4 regression remains in the same automated command.

## Known limitations for Product Control audit

- Share-ready artifact is a deterministic plain-text preview; PDF/template designer is outside Gate #5.
- Uses the browser/OS system share mechanism only; there is no Zalo API or BTC backend integration.
- Result correction entry remains domain/API-level from Gate #4; the reporting revision flow is fully tested but this candidate does not add a correction editor.
