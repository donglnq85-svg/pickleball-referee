# Engineering Gate #8 — History / Work Record / Audit

## Integration baseline

- Gate #7 audited head: `31d7116192ebaa9bec0cf14bdd38a0ca570f56dd`
- Gate #7 merge on `main`: `f1f622db5428ed758e793da1a9b1773b659eb4c8`
- Gate #8 branch: `codex/engineering-gate-8`
- Draft PR: #9
- Production deployment: not performed

## Architecture

`projectHistory()` is a disposable read model over the existing Match and
Tournament repositories. It does not persist a History document and does not
write to either source repository. Tournament, Work Session, Match and Group
records all retain their stable IDs; names are render/search fields only.

Quick Match and Tournament Match share one Match Record shape. Tournament
records additionally project Rules Version, Match Start Snapshot, Canonical
Result versions, exact Report revisions, Group Snapshots and Gate #7 Shift
Completion/Handover snapshots.

The score invariant remains explicit:

- current rally/game points remain Match Engine state;
- completed-game points remain immutable game records;
- match result is derived games won.

History displays significant events by default and exposes the immutable full
ledger separately. Result corrections and report revisions are appended and
the previous versions remain queryable. Started official records have no
generic delete affordance.

## Automated verification

- Full Gate #1–#8 suite: **74/74 PASS**
- Production build (`vite build`): **PASS**
- Gate #8 regression covers:
  - BO3 `2–1` with exact game scores;
  - Canonical Result v1/v2 correction history;
  - report `OUTDATED`, `NEEDS_RESEND`, and `SENT` history;
  - frozen historical Rules/Ranking Rules Version references;
  - Shift Handover unresolved and Shift Completion records;
  - duplicate display names with distinct Player/Entry IDs;
  - rename-safe identity linkage;
  - Quick Match projection;
  - reload/search projection;
  - no mutation of Match or Tournament source records.

## Browser candidate verification

Candidate source was verified on the Vercel preview for the Gate #8 branch.

Tournament scenario:

1. Created a BO3 side-out Tournament Match and completed Call/Waiting,
   Pre-Match, immutable Match Start Snapshot and Match Session.
2. Played exact scores Game 1 `11–4`, Game 2 `8–11`, Game 3 `11–6`.
3. Verified End Match and Canonical Result as match games won `2–1`.
4. Confirmed Result v1 and sent Match Report revision 1.
5. Corrected Game 1 to `11–5`; verified v1 remained immutable, v2 became
   current, report revision 1 became `OUTDATED`, and revision 2 became
   `NEEDS_RESEND` then `SENT`.
6. Verified recalculated Standings point differential without changing game
   differential.
7. Completed the Work Session and verified its immutable Shift Completion
   Snapshot.
8. Searched History and navigated Tournament → Work Session → Match. The Match
   Record showed both Result versions, both report revisions, exact game
   scores, stable Player/Entry IDs, Rules Version, Match Start Snapshot and the
   Significant Events ledger.

Quick Match scenario:

1. Completed a Singles Quick Match `11–0`.
2. Verified the same Match Record semantics, record-scoped stable participant
   IDs, exact game score and match result `1–0`.
3. Reloaded the app, searched by participant name with Match scope, and opened
   the same record without duplicate creation.

Browser follow-up fixed during verification: Pre-Match no longer presents an
actionable launch CTA while Court Manager readiness is still unknown. It now
routes the referee back to the explicit readiness decision; the launch domain
guard remains unchanged.

## Known issues

- P0: none found.
- P1: none found.
- P2: native system share sheet cannot be completed in the automated cloud
  browser; `SHARED_UNCONFIRMED` remains covered by automated persistence tests.
- P3: History date filtering is supported by the projection API but the Gate #8
  minimal UI currently exposes query and scope controls only.

