# F-002 P2.2 dormant parsing and validation

Date: 2026-11-25. Owner authorization: D-029, following the P2.1 contract package. Baseline:
`writer-manager`, `6788dfb0c6ea979a60e7ef35fb0eaf19ef73771c`, retaining the earlier P2.0/P2.1 changes.

## Delivered

| File | Responsibility |
|---|---|
| `src/shared/game/dualTurnContract.ts` | Strict Zod schemas for the Manager envelope, eleven operation families, evidence, presentation, comfort, information/review items, and dormant note/scene metadata; bounded whole-object JSON parsing |
| `src/shared/game/dualTurnValidation.ts` | Pure source/actor/game-rule validation, conflict detection/deduplication, candidate visibility, and a separate Writer display/control guard |
| `src/shared/game/dualTurnContract.test.ts` | Wire/schema/size/reference/metadata cases |
| `src/shared/game/dualTurnValidation.test.ts` | Source/permission/rule/presentation/privacy cases, immutable snapshots, and Writer guard regressions |

No pre-existing application source was edited. New modules are not exported through the game barrel or imported by
application entry points. Settings remain version 2 and Scene/save readers are unchanged. No migration, role assignment,
IPC, prompt builder, retry orchestration, turn reducer, or Dual-call control has been activated. Standalone storage
schemas do not imply that new metadata can already be saved through the application.

## Interfaces and behavior

- `parseDualManagerReply` accepts one whitespace-trimmed JSON object, enforces 65,536 UTF-8 bytes, and validates strict
  required collections, discriminated unions, bounds, UUID turn identity, local references, and cross-field rules.
  It does not extract JSON from fences/prose or rewrite quoted evidence.
- `validateDualManagerReply` checks the captured turn, engine-owned sources, exact UTF-16 spans and surrogate boundaries,
  current evidence, canonical IDs, actor attribution, relevant player evidence/recorded actions, existing scene/schedule/
  bond/intimacy/asset rules, cardinality/conflicts, and information targets/discoveries. It reuses existing game functions
  without applying their returned states or mutating the captured state/scene/content.
- Identical supported operations/selections/readings deduplicate; incompatible duplicates fail. Invitations are excluded
  from `operationCandidates`. Unknown actor/asset/fact/state-patch requests fail. Explicit engine-recorded player actions
  bind to the actual destination/delay/staying cast or pending option rather than a generic authorization flag.
- Eligibility context alone cannot generate proposals or disclose facts. Writer-owned declarations are required where
  the character's choice matters. Existing ordinary-NPC restrictions and intimacy gates remain authoritative.
- Information audience candidates intersect every cited conversational source, including historical quotations.
  A public current statement cannot launder a private earlier quote into another character's knowledge. Corrections
  and resolutions validate without mutating the earlier entry's text, audience, or status.
- `validateDualWriterReply` preserves ordinary brackets/braces/JSON-like dialogue and existing beat/speaker parsing.
  It holds known control families, tool/operation/Manager objects, provider tool-call metadata, full-width/unfinished
  controls, garbled comfort tags, and known fabricated player speaker labels. Failure holds the reply instead of
  silently stripping a command into dialogue. Closed leading reasoning blocks are separated; unfinished/misplaced
  reasoning is held.
- Dormant saved-note schemas enforce bounded entries/receipts, coherent role/speaker pairs, distinct IDs/audiences,
  discovery/fact relationships, explicit diagnostics, and acyclic correction links. Evicted parents are permitted.
  Completion intent is represented, but persistence integration remains deferred.

Failures expose bounded issue codes/paths, not copied provider responses or evidence. Source text, attribution,
witnesses, and explicit action grants are engine-owned context; model output cannot supply them. The helpers make
no HTTP, filesystem, Electron, or renderer calls.

## Validation boundary

A matching quote proves origin, not meaning. Every successful Manager check returns `requiresConsistencyReview: true`
and mechanically eligible `operationCandidates`, not committed effects. Current player evidence is a necessary agency
check, not a deterministic free-text consent classifier. Negation, hypotheticals, ambiguity, and missed prose/state
contradictions still require the scoped consistency/model evaluation described in the contract. A Manager review issue
already holds the entire envelope.

P2.2 does not implement atomic publication, exactly-once application, actual seeding-pose/event settlement, core-memory
application, profile fallback/retry budgets, ledger eviction, or full application save/load/undo. Those belong to later
stages. Tests here establish that parsing/validation does not perform those live effects. The Writer guard is dormant:
P2.0 Legacy comparisons remain unchanged and BUG-001 is not marked fixed.

## Verification

- 119 new focused checks passed across two files.
- `npm run typecheck` passed.
- `npm test`: 139 files passed; 1,339 tests passed; one pre-existing skip. The complete suite ran with its required
  loopback mock-server and Windows junction permissions.
- `npm run build` passed with the existing Zod annotation and Phaser mixed-import warnings.
- Extracted P2.1 wire/note/scene types compile bidirectionally against inferred implemented schema types.
- No application imports reference the modules. All 554 previous source/script/config files retain their hashes.
  Both original backup trees and full immutable archive match prior hashes; all 74 original audit IDs remain.
- Local boundary/parity files and source hashes are in Git-ignored `.dev-data/p22/`, without real credentials/private
  saved conversations. P2.1's earlier static report is historical, not a statement that P2.2 schemas do not exist.

No app session, real-provider/paid test, user-data migration/write, package release, commit, or push was performed for
P2.2. No UI changed or was visually tested. Earlier staged/uncommitted changes remain intact.

## Next gate

Review this implementation before P2.3: independent assignments/protected settings conversion, request snapshots,
role-specific transport, sequential calls, and bounded cancellation/recovery. Activation stays unavailable until
P2.4/P2.5 commit/persistence/ledger invariants pass. P2.2 approval does not authorize live migration, Dual-call gameplay,
or real-provider/paid tests.
