# Engineering Gate #3 — Operational Court Workflow candidate

## Gate #2 Integration Closure

Gate #2 was closed and merged to `main` at `4b0e5cce3e4fd1e08f5ec24c3c6c9accd5e745fb`. The Tournament Store writes a prepared launch journal before touching the separate Gate #1 Match Repository. The journal contains a deterministic Match Session ID, frozen Rules Version, config and Final Setup. Recovery inserts that ID only if absent, verifies `tournamentContext`, and then commits the Tournament linkage. Prepared, linked, unique legacy-orphan and corrupt/ambiguous states all have deterministic behavior; unsafe states fail closed without overwriting Match history.

The closure regression suite injects failure before intent persistence, after intent persistence, after Match Session persistence, after Tournament linkage and during each storage write. It also covers reopen/retry, missing or corrupt journal/session state, unique legacy orphan recovery, version stamping, retained rally history and Court Manager projection. Gate #1 and Gate #2 remained green before merge. Production was not deployed.

## Gate #3 implementation

Gate #3 adds an operational state boundary to each Scheduled Match without adding another Match Engine:

- initial call timestamp, recall history and BTC loudspeaker request history;
- a waiting clock with its own `startedAt`, independent from call time, plus arrival, extensions and explicit no-show resolution;
- no-show never creates a forfeit, score or Match Session automatically;
- elapsed waiting time is derived from persisted timestamps, so it continues across Court Manager navigation and reload;
- true Singles participant identities `A1/B1`; stable Doubles identities `A1/A2/B1/B2`;
- athlete confirmations, warm-up lifecycle and equipment checks driven by the stamped Tournament Rules Version;
- factual Final Setup and starting score, followed by an immutable Match Start Snapshot;
- launch through the existing recoverable Gate #2 protocol into the one Gate #1 Match Engine;
- Tournament Result returns to Court Manager, whose progress is projected from the Gate #1 Match Repository.

No toss-choice workflow, serve/receive/end/defer policy or side-change threshold was introduced. Those facts remain outside this candidate until Product Control supplies verified Rules specifications.

## Automated verification

Command: `node --test tests/*.test.mjs`

Result: 37/37 passing. Gate #3 tests cover persisted call/recall/loudspeaker facts, call/wait clock separation, reload timing, arrival, extension, no-show without auto-forfeit, required equipment gating, warm-up transitions, Singles/Doubles identity stability, immutable snapshots, Rules Version freeze, launch crash recovery, exactly one linked Match Session and finished Court Manager projection. All Gate #1 state-correctness and Gate #2 launch-recovery regressions remain green.

Command: `npm run build`

Result: PASS (Vite production build).

## Browser candidate verification

Candidate source implementation: `f67ce30f365f5a0ec1ad26ec88470ad53df19120`.

Preview verified: `https://pickleball-referee-iy286yr7s-thoc-software.vercel.app/` (Vercel deployment `dpl_5bZSTaWpyQynj3sD6jkWLSjDBNDQ`, READY, preview target).

Scenarios completed in the browser:

1. Create Tournament, Rules Version, Court, Singles and Doubles schedule entries, Court-scoped Assignment and active Work Session.
2. Singles: readiness → initial call → recall → BTC loudspeaker request → independent waiting timer → extension → reload → resume in Court Manager → arrival → athlete confirmation → skip warm-up → required equipment checks → Match Start Snapshot → Gate #1 Match Session → reload/resume → Result → return Court Manager.
3. Doubles: call/wait/arrival → stable A1/A2/B1/B2 confirmation → completed warm-up → required equipment checks → factual positions with Team B and B2 as first server → snapshot → Gate #1 Court View showing Lan serving and Chi receiving → timeout → reload/resume with timer/state preserved → finish → Undo → Redo → Result → return Court Manager.
4. Court Manager projected `2/2` finished from the Match Repository. History listed both Singles and Doubles results. Browser console contained no application-origin runtime error.

## Known issues / boundaries

- P0: none known.
- P1: none known.
- P2: persistence and coordination are device-local; cross-device referee handoff is not part of this gate.
- P3: the guest login introduction is shown again after a full page reload; persisted Work Session and Match state are still recovered after entering the app.
- Product boundary: no automatic no-show forfeit and no unverified toss or side-change rules, by design.

Gate #3 remains on `codex/engineering-gate-3` for Product Control audit. It is not merged and Production is unchanged.
