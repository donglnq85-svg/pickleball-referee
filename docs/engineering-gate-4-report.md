# Engineering Gate #4 — Result & Group Operations

## Candidate boundary

- Branch: `codex/engineering-gate-4`
- Base: Gate #3 merge `948291afb07b1a84d65cb413056c225b93bdaa96`
- Production deployment: **not performed**
- Gate #4 merge: **not performed; Product Control audit required**

## Architecture

- Gate #1 Match Store remains the source of truth for the completed match, game scores, winner, end time and event history.
- Tournament Store owns a versioned Canonical Result ledger. A scheduled match has exactly one current result version; prior versions are immutable history.
- `MATCH_ENDED` is represented by `Match.finishedAt`. `RESULT_CONFIRMED` is a later explicit transition with its own `confirmedAt`.
- A result correction appends a new pending version with parent version, actor and reason. It never edits a prior version or a prior Group Snapshot.
- Ranking Rules have independent immutable versions. Each Group Snapshot stamps the exact Ranking Rules Version ID and exact confirmed Result Version IDs used for calculation.
- Standings statistics are calculated independently from ranking. Missing criteria, unsupported metrics and unresolved ties return `NEEDS_CONFIRMATION`/`UNKNOWN`; the engine does not invent an order or qualification decision.
- Application resume now treats an ended Tournament Match with an unconfirmed result as mandatory unfinished work before returning to Court Manager.

## Identity Closure

- Removed normalized display-name fallback identity from Canonical Result and standings.
- Added first-class `Player`, `Entry` (Singles/Pair/Team entry), and `Team` roster identities. Scheduled Matches reference stable Entry IDs; names are render data only.
- Added deterministic schema v1 → v2 migration. Legacy match-side occurrences receive stable IDs without merging equal names; Canonical Result and Group Snapshot references are rewritten/recalculated from exact result versions.
- Unknown participants remain explicit `null` Entry references and never create blank/fake Players.
- Added regressions for duplicate display names, rename stability, Pair reuse, correction mapping, migration/reload, exact Group Snapshot inputs, and explicit unknown participants.
- Closure verification: 54/54 automated tests pass; production build passes.

## Vertical slice

`Match End → read-only Canonical Result review → explicit confirmation → Court Manager progress → Group Snapshot → Group Completion assessment`

Court Manager shows Match progress separately from result confirmation, the most recent group standings snapshot and Group Completion state.

## Automated coverage

- Match end time vs result confirmation time.
- Idempotent result derivation from one Match state/event ledger.
- Exactly one current Canonical Result version.
- Only confirmed current results enter standings.
- Incomplete ranking policy and unsupported head-to-head remain explicit `NEEDS_CONFIRMATION`.
- Result v1 → correction → Result v2, with old result and old Group Snapshot preserved.
- Recalculation impact classification: `RESULT_CHANGED`, `RANKING_CHANGED`, `QUALIFICATION_CHANGED`.
- Frozen Ranking Rules Version despite later active version changes.
- Persistence/reopen of result versions, snapshots and Court Manager projection.
- Reload priority for pending result confirmation without duplicate Match creation.
- Full Gate #1–#3 regression remains part of the same test command.

## Candidate browser verification

Verified on Vercel candidate source `d9f70cacc64a9fab5754e4e5e430b7a6b19fe066`:

- Created a Tournament with frozen Match Rules and Ranking Rules, one group, court, scheduled Singles match and group-scoped Work Session.
- Completed Call/Waiting → reload/resume → arrival → Pre-Match → immutable Match Start Snapshot → Gate #1 Match Session.
- Finished the match and verified `MATCH_ENDED` first rendered the Gate #1 result.
- Full reload before confirmation resumed directly at the mandatory pending Canonical Result review, without onboarding, duplicate Match or duplicate Result version.
- Confirmed Canonical Result v1 and verified Court Manager projected one completed match and one confirmed result.
- Verified Group Snapshot `RANKED`, Alpha `QUALIFIED`, Beta `NOT_QUALIFIED`, and Group Completion `READY`.
- Reloaded Court Manager and reopened the result; confirmation state and separate Match End / Result Confirmation timestamps persisted.
- No application-origin console errors were observed. Browser-extension metadata errors were isolated to the test harness extension.

## Known limitations for Product Control audit

- **P2:** The minimal UI configures one aggregate ranking criterion. The domain supports ordered criteria, but advanced head-to-head policy remains `NEEDS_CONFIRMATION` until a verified rule specification is supplied.
- **P3:** Result correction is domain/persistence complete and regression-tested; this candidate does not add a correction-entry UI.
- **P3:** Group Completion is an operational state foundation only; reporting, signatures, PDF and messaging integrations remain outside Gate #4.
