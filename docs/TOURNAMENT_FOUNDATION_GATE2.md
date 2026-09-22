# Engineering Gate #2 — Tournament Foundation candidate

This slice covers Tournament → Rules Version → My Assignment / Work Session → Court Manager. Gate #1 Match Engine remains the only scoring and service subsystem. The tournament domain owns scheduling, referee scope, work session, readiness and links to the existing Match Repository. It has no rally reducer.

## Boundaries

| Domain | Identity and responsibility |
| --- | --- |
| Tournament | Container for rules versions, structure, schedule and assignments. |
| Rules Version | Explicit source/label and optional scoring/format snapshot. `unknown` and absent format are valid until configured. New versions append; old ones remain. Tournament records can retain future scoring identifiers and formats, but only a Gate #1 supported configuration can enter the current Match Engine. |
| Structure | Courts and groups belong to a tournament; neither grants referee responsibility. |
| Schedule | Match entry may have unknown court, group, type, participants and readiness. Schedule is not an assignment. |
| Assignment | Explicit Court, Group or Match scope with IDs referencing structure or schedule. It never implies that all tournament matches belong to the referee. |
| Work Session | Start/end of an assignment's operational responsibility, independently persisted from its schedule. |
| Court Manager | Projection of matches inside the assignment scope with readiness and progress from the Gate #1 Match Repository. |

The current browser form creates schedule entries with unknown participants. Participant entry and deep Call/No-show/Pre-Match resolution are reserved for later Gate #2 increments. The domain permits complete participant facts when an authoritative operator supplies them. `beginTournamentMatch` delegates to `createMatch` from Gate #1, and the match is stored in the Gate #1 repository; the current UI deliberately does not launch an incomplete scheduled match.

Tournament data uses a separate versioned localStorage document. Reads validate references and reject corrupt or unsupported data without overwriting it. Persistence remains device-local; no multi-device operational coordination is claimed.

## Gate #2 Integration Closure — recoverable launch

`tournament-launch.js` writes a prepared launch intent to the Tournament Store first. It freezes the Rules Version, config, Final Setup and a deterministic Match Session ID derived from Tournament ID and Scheduled Match ID. It then inserts that ID into the Gate #1 Match Repository only if absent, verifies `tournamentContext`, and finally commits the Tournament linkage. Reload recovery replays a prepared intent idempotently, or verifies an already linked Match without replacing its rally/event/Undo history. A unique legacy orphan can be linked; ambiguous, missing or corrupt records fail closed.

The two stores remain separate. This is a recoverable journal protocol, not a claim of cross-key transaction atomicity. `launchTournamentMatch` serializes browser launch requests across tabs through Web Locks; if Web Locks are unavailable, it refuses the launch. Once launched, a changed Tournament active Rules Version cannot rewrite the session's stamped version. Recovery tests inject crashes before the intent, after the intent, after the Match Store write and after linkage, and failed storage writes at each boundary. Live Tournament Match launch is exposed in Gate #3 only after the Pre-Match snapshot is complete.

One referee can have only one active Work Session on this device. The repository refuses to replace its resume pointer with another tournament's session or to clear an unfinished task.

`vercel.json` holds auto production deployment for `main`; preview branches remain enabled. Production release requires a separately authorized change to that setting or an explicit deployment.

Run `node --test tests/*.test.mjs` and `npm run build`. The Gate #2 tests cover all three scope types, unknown facts, independent identities, work session transitions, readiness, storage reopen, corruption refusal and the Gate #1 engine adapter.
