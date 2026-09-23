# Engineering Gate #6 — End-to-End Tournament Integrity

## Boundary

- Base: Gate #5 merge `e79e16f2779a173e3037a78ddefd27e6b627847e`
- Branch: `codex/engineering-gate-6`
- Merge: **not performed; Product Control audit required**
- Production deployment: **not performed**
- Product scope: unchanged; this gate adds integration evidence, not a new feature.

## Tournament simulation

The automated vertical simulation crosses Tournament/Rules/Assignment/Work Session/Court Manager/Call & Waiting/Pre-Match/Gate #1 Match Engine/Canonical Result/Standings/Reporting/Group Completion.

It proves:

- a no-show waiting clock and extension remain persisted while the referee runs other matches;
- rest/readiness is an explicit `blocked` operational state with a reason, survives reload, and requires an explicit transition to `ready`;
- a crash after Match Store persistence but before Tournament linkage deterministically recovers one Match Session with the frozen Rules Version and Match Start Snapshot;
- a BO3 `2–1` Match reloads after Game 1 and continues through exact per-game scores; a second BO3 ends `2–0`;
- unfinished Match resume outranks Court Manager; finished/unconfirmed Match routes to Result Review;
- Canonical Results are confirmed once and standings/group completion read their exact current Result Version IDs;
- correction creates Result v2, preserves Result v1 and Group Snapshot v1, recalculates Snapshot v2, and invalidates both Match and Group reports;
- reports that were already sent create `NEEDS_RESEND` revisions and return to `SENT` only after explicit confirmation;
- no-show resolution never creates a Match Session, score, winner or automatic forfeit;
- Court Manager projects two confirmed played matches, while the no-show match remains an explicit operational record.

## Verification

- Gate #6 integration simulation: pass.
- Full Gate #1–#6 automated suite: **67/67 pass**.
- Production build: **pass**.
- Known P0/P1: none at implementation checkpoint.

The simulation found and closed one cross-subsystem P1 before candidate publication: `reportingAttention()` iterated historical Group Completion records, so an old completion could keep requesting a Group Report after the current snapshot revision had already been sent. The projection now considers only the latest completion per group; immutable completion/report history is not rewritten. Gate #5 reporting regressions and the Gate #6 resend sequence cover the fix.

## Deliberate limits

- Gate #6 does not add a dedicated rest-policy engine; it verifies the locked readiness boundary using persisted `blockedReason` and explicit release to `ready`.
- No-show remains a safe operational resolution without automatic sporting outcome, as required by the Product Baseline.
- End Shift and deeper History are not started in this gate.
