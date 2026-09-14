# Core Match implementation boundary

## Current runnable scope

The deployed app currently supports:

- create/setup match;
- start match;
- manual point changes;
- manual serving-side changes;
- undo;
- manual game completion confirmation;
- manual match completion;
- persistence/recovery through Supabase;
- event audit log through `match_events`.

## Canonical boundary

The current runnable build must not be treated as the final rules engine.

The following capabilities are intentionally kept behind a manual/provisional boundary until canonical specification is recovered or approved:

- scoring semantics;
- serving semantics;
- serve/receive position derivation;
- normal game completion semantics;
- match-completion format rules where not explicitly approved.

The persistence model, event log, recovery model, and UI shell are implementation infrastructure and can remain while the rule engine is replaced.

## Implementation principle

Do not hard-code a new pickleball rule assumption simply to make the UI feel complete. When canonical rules are available, map validated domain events into the existing persistence/event architecture.
