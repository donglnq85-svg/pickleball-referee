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

Tournament data uses a separate versioned localStorage document. Reads validate references and reject corrupt or unsupported data without overwriting it. Persistence remains device-local; no multi-device operational coordination is claimed. Linking a tournament schedule record to a Match Session spans two browser storage keys, so it is not a cross-key atomic transaction yet. Do not expose live tournament match launch until recovery/reconciliation of that boundary is designed and verified.

One referee can have only one active Work Session on this device. The repository refuses to replace its resume pointer with another tournament's session or to clear an unfinished task.

`vercel.json` holds auto production deployment for `main`; preview branches remain enabled. Production release requires a separately authorized change to that setting or an explicit deployment.

Run `node --test tests/*.test.mjs` and `npm run build`. The Gate #2 tests cover all three scope types, unknown facts, independent identities, work session transitions, readiness, storage reopen, corruption refusal and the Gate #1 engine adapter.
