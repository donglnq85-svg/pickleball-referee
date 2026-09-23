# Engineering RC1 Report

## Release boundary

- Gate #8 accepted source: `3a311e97827b2ae5a923f02b93183da993ee7e85`
- Gate #8 merged `main`: `e95db1ca07547197a2e5ce4be08b3dc306e43bf2`
- RC1 branch: `codex/release-candidate-rc1`
- Production deployment: **not changed**

## Correctness and recovery fixes

1. Group Snapshot retry is idempotent when the immutable Result Version and Ranking Rules Version inputs are unchanged.
2. Group Completion retry is idempotent for the same status, reason, Group Snapshot, Match and Result Version inputs.
3. Repeated system-share activation while a report is already `SHARED_UNCONFIRMED` does not create duplicate Reporting Events or replace the first share timestamp.
4. The Match Session event-sheet close action now has a 44 x 44 px minimum touch target.
5. A completed Work Session with outstanding attention now exposes History directly, while bootstrap continues to prioritize the unfinished-work projection.

## Automated verification

- Full Gate #1–#8 plus RC1 suite: **78/78 PASS**.
- Production Vite build: **PASS**.
- RC1 additions cover:
  - failure-boundary retry from launch journal through rally save, game transition, Match End, Result derivation/confirmation, Group Snapshot/Completion, report generated/shared/sent and Shift Completion;
  - 320-transition Singles stress and 320-transition Doubles stress with diagonal server/receiver invariants, first/second server, side-out, court ends, Undo/Redo, timeout and reload;
  - a long tournament day with two groups, two assignments, BO1/BO3 Singles/Doubles, waiting/loudspeaker, timeout/medical, correction/resend, reports, handover and History projection;
  - corrupted Match/Tournament stores failing closed without rewriting persisted bytes.

## Browser RC1 scenario

An iPhone-width (390 px) browser run covered two assignment scopes and four scheduled matches:

- Group A: Singles BO1 and Doubles BO3, including waiting reload, Pre-Match snapshot, readiness gate, timeout reload, medical, side-out, Undo/Redo, game transitions, Result confirmation, correction, `NEEDS_RESEND`, Match Report resend, Group Report and clean completion with configured reminders.
- Group B: Singles BO3, a second Work Session reload, full Match/Result/Report flow, plus a Doubles no-show workflow with BTC loudspeaker request, waiting extension, blocking End Shift and immutable Handover Snapshot. `HANDED_OVER` remained distinct from `RESOLVED`.
- Court View was checked against Match State for Singles and Doubles. Server, receiver, service lane, server number and diagonal relationship remained consistent through side-outs, server 1 → 2, reload and game transitions.
- Score semantics remained distinct: current game points, immutable completed-game scores and match games won.
- History chain covered Tournament → Work Session → Match, Result revisions, Reporting status and handover/outstanding state.

## Mobile usability and console

- Audited Home/resume, Tournament setup, Court Manager, Call/Waiting, Pre-Match, Match Session, Timeout/Medical, Result Review, Match/Group Report and End Shift at 390 px.
- No page-level horizontal overflow or clipped primary action was found.
- Live Match state remained mounted under Timeout/Medical sheets.
- Application-origin browser console errors: **0**. Browser-extension metadata errors were excluded as test-harness noise.

## Remaining issues

- P0: none known.
- P1: none known.
- P2: none known.
- P3 / verification limitation: the OS share-target picker cannot be completed by the automated desktop browser. The app boundary `GENERATED → SHARED_UNCONFIRMED → SENT`, persistence and retry idempotency are covered by automated tests; explicit `ĐÃ GỬI BTC` was browser-verified.

## Candidate

The fixed candidate commit, Draft PR and Vercel Preview URL are recorded in the Product Control handoff after the final preview build is READY.
