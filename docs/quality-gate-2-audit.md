# Experience Build #1 — Quality Gate #2 checkpoint

Status: **NOT PASSED. Do not promote.**

Production baseline/rollback source: `5c9a4b781ae41472627894f5f5bbb3fc6329ef9f`.
Production baseline deployment: `dpl_2hS9iGt5r49izBtPneTtyA2F7LZW` (previous handoff; not newly redeployed).
Correction branch: `codex/experience-quality-gate-2`, created from exact baseline.

## Evidence standard

READY in the previous handoff meant an asset had been selected, not that visual fidelity or full functionality passed. Prior browser evidence measured a 390px **app shell inside a desktop viewport**; this is NOT an iPhone viewport test. No 13-screen canonical screenshot comparison is claimed here.

Current retrieval rechecked the confirmation asset in Library and original approval context. `Vietnamese Court Assignment Confirmation.png` exists, but the retrieved approval at 10:43:39 does not bind unambiguously to this image rather than Add Group. Screen 05 remains BLOCKED MASTER. No replacement screen has been designed.

## Master audit matrix

All rows require new canonical-viewport rendering and side-by-side visual comparison before PASS. Source findings are not substituted for screenshots.

| Screen | Master | Render evidence this audit | Difference found | Correction | Remaining / status |
|---|---|---|---|---|---|
| 01 Tournament list | Selected asset from previous inventory | Production DOM | Typography/token consistency and exact geometry unverified | None | NOT PASSED |
| 02 Create | Selected asset | Not recaptured | Optional image area has no upload; input validation/date ordering unverified | None | NOT PASSED |
| 03 Success | Selected asset | Not recaptured | Geometry and dynamic status require verification | None | NOT PASSED |
| 04 Assignment | Selected asset | Not recaptured | 3 assignment modes disabled; all-day selection not applied in submit | None | NOT PASSED |
| 05 Assignment saved | Asset exists; approval binding unresolved | Not implemented | Routes directly to courts | No guessed UI | BLOCKED MASTER |
| 06 Add group | Selected asset | Not recaptured | Fixed four pairs; knockout option still produces round robin | None; no knockout expansion authorized | NOT PASSED |
| 07 Scoring format | Selected asset | Not recaptured | Five hard-coded rounds all edit same tournament format; misleading per-round affordance | None; domain retained | NOT PASSED |
| 08 My courts | Selected asset | Not recaptured | Court match link opens first group's schedule, not every match on court | None | NOT PASSED |
| 09 Group list | Selected asset | Not recaptured | Missing filters; status based on existence of session, not completion | None | NOT PASSED |
| 10 Athletes | Selected asset | Not recaptured | Edit action absent; participant row chevrons not actions | None | NOT PASSED |
| 11 Schedule | Original final Schedule(2) image inspected | Corrected source not yet browser-verified | Vertical scores; live score absent; finished session labelled live; first row assumed NEXT; BO3 displayed final-game points | Read-only match projection and horizontal score CSS | Canonical visual/render QA still pending |
| 12 Results | Selected final asset/contact sheet inspected | Corrected source not yet browser-verified | Same match row issues; correction could show stale standings snapshot | Uses current Result version and read-only projection | Canonical visual/render QA still pending |
| 13 Standings | Selected final asset/contact sheet inspected | Corrected source not yet browser-verified | Stale snapshot used after correction; scoring column not configured | Current confirmed result statistics; stale ranking withheld | Points policy/display and canonical visual QA pending |

## Implemented corrections (not deployed)

- `tournament-experience-projection.js`: pure UI read models over existing Match Store and Canonical Result ledger; no new store/engine.
- LIVE uses `currentGamePoints`; completed BO1 uses exact completed-game points; completed BO3 uses `matchGamesWon`.
- Winner emphasis exists only after completion, never on LIVE.
- Completed-but-unconfirmed match is not mislabelled LIVE; result confirmation remains a separate fact.
- NEXT requires ready state, rather than row index zero.
- Standings statistics use current confirmed Result versions. A snapshot with stale exact input IDs cannot provide current ranks. Old snapshots remain immutable.
- Schedule/results use the same projection and horizontal score renderer.
- Existing active-match/result routes are selected by actual session state rather than whether operations data exists.

## Data/recovery automated evidence

Test-only dataset: Vietnam Pickleball Open 2026; one court, one assignment, one pool, eight Players, four Entries, six unique matches. No seed is shipped in application logic.

Five added executable tests verify:

1. Stable IDs, references and no duplicate round-robin pairs after reopening repositories.
2. LIVE points and no winner emphasis; completed pre-confirmation state.
3. Result v1 → corrected v2; current statistics, stale-rank suppression, recalculated snapshot, preserved old snapshot and original Match ledger, reload.
4. NEXT respects readiness; unknown/blocked never inferred ready.
5. BO3 games-won vs game-points distinction; projection never mutates source.

Result correction intentionally does NOT overwrite original rally history. Current result views follow the revision; engine history retains what was recorded on court.

## Quality status

- Automated suite: 93/93 PASS at checkpoint before final navigation routing adjustment; final full rerun required/recorded in handoff.
- Lint/typecheck/build: PASS at same checkpoint.
- Dependency security audit: BLOCKED (`npm audit` ENOLOCK; repository has no package-lock). No clean security result claimed.
- Browser E2E for corrections, canonical iPhone 13 captures, overflow/CTA/back/reload verification: NOT COMPLETE.
- No Production deployment, merge, data deletion, engine/rules/migration changes.

## Known severity

- P1: per-round rules affordance edits shared rules; knockout selection produces wrong schedule. These existed in production baseline and require closure before acceptance.
- P1 fixes pending browser validation: live/completed state, score semantics and correction/statistics projection.
- P2: disabled assignment modes, inactive image upload, missing edit/filter interactions, court list showing only first pool; visual fidelity unverified.
- Evidence blocker: screen 05 MASTER approval and canonical viewport specification remain unresolved.

## Product Owner test script (for a future passing candidate, not acceptance approval now)

1. Home → Giải đấu → create Vietnam Pickleball Open 2026.
2. Reload and reopen the same tournament.
3. Add court assignment; reload and verify the assignment.
4. Review scoring format before match start.
5. Add Bảng A and four pairs; reload and verify six unique matches.
6. Open athletes, schedule, results and standings; use Back and bottom navigation.
7. Conduct a one-game match; check LIVE red, horizontal score and no winner emphasis.
8. Finish and confirm result; check completed green and correct winner.
9. Correct result through the existing business workflow, confirm and verify current standings plus retained history.
10. Reload/reopen and verify the same context, IDs and scores.
