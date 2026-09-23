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

## Candidate browser verification

- Exact source candidate completed Tournament setup with required Match/Group Reporting Policy, group assignment, Call/Waiting, Pre-Match, Gate #1 Match Session and Canonical Result confirmation.
- Required Match Report and Group Report were generated from their exact source IDs, previewed read-only, explicitly marked sent, reopened from Court Manager and preserved after full reload.
- Browser E2E found and closed two attention-state defects: generated-but-unsent reports now remain actionable, and the first Group Report no longer shows a false qualification-change warning.
- Final candidate source loads without application-origin console errors; browser-extension metadata errors are isolated to the test harness.

## Score Semantics Closure

Root cause: Gate #1 used the generic field `score` for live points and completed-game points, while Gate #4 reused `gamesWon` beside those point scores without carrying the frozen Match Format into Canonical Result. Normal engine completion happened to derive the winner from games, but the correction API could accept an incomplete best-of-three result. Standings also named point totals `pointsWon/pointsLost`, which obscured the boundary between games won and points scored.

The closure establishes three explicit layers:

- `currentGamePoints` is mutable only for the game being played.
- `completedGames[].points` is the immutable per-game ledger.
- `gamesWon` in Match State and `matchGamesWon` in Canonical Result are derived from completed games; a best-of-N result is valid only when `requiredWins = floor(sets / 2) + 1`.

Canonical Result now freezes `{sets, requiredWins}`, corrections must provide exact `completedGames`, and result validation recalculates winner/game wins. Standings expose separate `matchWins`, `gameWins`, `gameLosses`, `gameDifferential`, `pointsFor`, `pointsAgainst`, and `pointDifferential`. Match/Group Reports and History label match game-wins separately from per-game points. Match Store v2 records migrate deterministically to Match schema v3, including Undo/Redo/event snapshots; Tournament candidate data migrates result and standings fields without changing Result Version or Group Snapshot source IDs.

Regression coverage adds best-of-three 2–0 and 2–1, the 1–0 and 1–1 game boundaries, deciding Game 3, game-boundary Undo/Redo, reload/migration, exact Canonical Result, one-game correction, and separate game/point differential plus Match/Group report assertions. Full Gate #1–#5 suite: **66/66 pass**; production build: **pass**.

Browser E2E on candidate commit `0ac22298baba1e82d3ad89d7e36e09408951b884` completed a real best-of-three Singles match: Game 1 `11–4`, Game 2 `8–11`, Game 3 `11–6`. Match Session showed `1–0`, then `1–1`, then Match `2–1`; Canonical Result, History and Match Report retained all exact game points; Standings showed game `2-1 (HS 1)` separately from points `30-21 (HS 9)`. A Doubles smoke from `10–0–2` confirmed Server 2/Court View and ended `11–0`. No application-origin console error was observed.

## Known limitations for Product Control audit

- Share-ready artifact is a deterministic plain-text preview; PDF/template designer is outside Gate #5.
- Uses the browser/OS system share mechanism only; there is no Zalo API or BTC backend integration.
- Result correction entry remains domain/API-level from Gate #4; the reporting revision flow is fully tested but this candidate does not add a correction editor.
