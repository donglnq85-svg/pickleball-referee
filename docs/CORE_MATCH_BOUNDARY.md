# Core Match boundary — Engineering Gate #1

This is the Quick Match implementation in `codex/engineering-gate-1`. The approved Pages 01–05 retain their existing UI and flow. Production remains on its prior commit.

## Ownership

- `match-domain.js`: validates setup and persisted match shape; stamps the 2026 side-out rules version and schema version. A future Rules Version entity can replace the fixed Quick Match reference without changing the UI.
- `match-engine.js`: owns score, serving order, receiver, positions, court end, game completion and reversible state transitions. Singles has a separate two-number service path; doubles uses server 1/2, including the initial second-server exception.
- `match-persistence.js`: one atomic browser storage document for draft, active match, completed matches, transition snapshots, Undo/Redo stacks and event history. Reads legacy V1 keys once without deleting them. Invalid or unsupported stored documents fail closed rather than being overwritten.
- `v1.js`: adapts the approved setup flow and Match Session to the engine and repository. It does not calculate rally rules.

## Gate limits

Persistence is on the **same browser profile and device**. Cloud sync, multi-device conflict resolution, Tournament Mode, standings and confirmed canonical result lifecycle are outside Gate #1. Browser storage can be cleared by the user or device; this gate does not claim server backup.

The `events` array records transitions and Undo/Redo actions. Complete snapshots are retained in `undo` and `redo` and saved on each transition. A formal immutable server audit store and result confirmation belong to later gates; do not infer those are already implemented.

Rule reference: [USA Pickleball Official Rulebook 2026](https://usapickleball.org/rules/) and [USA Pickleball side-out scoring guidance](https://usapickleball.org/pickleball-skills/level-one/pickleball-scoring-positioning-side-out-scoring/). Recreational touch-point, cap, handicap and game counts follow the explicitly selected Quick Match configuration.

Run `node --test tests/*.test.mjs` and `npm run build`. These tests cover Singles and Doubles matches through completion, service changes, courts, handicap, Undo/Redo across repository reopen, legacy migration and corrupt storage. Candidate browser QA is required before any production release.

## Match State correctness audit

For doubles, a point changes the current server's court, while losing server 1 passes the serve to the partner **without changing the team's score or their court positions**. Thus the serving team's score parity alone cannot identify the service court of server 2. The engine derives the server's service court from the current server identity and the team's right-court player; it then derives the receiver from the diagonally corresponding court on the opposite end. Singles derives its service court directly from the serving player's score. `court-view.js` only renders `matchView` and never applies an additional rule.

`tests/match-state-correctness.test.mjs` asserts server/receiver identity, lane, opposite court ends and opposite rendered rows at every transition, including handicap, side-out, first-to-second server, correction, changed ends, next game, Undo/Redo and reopen from persistence. The service oracle checks known sequences separately from the geometric invariant.
