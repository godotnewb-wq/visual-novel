# Project 2 --- Dual-Call Generation Architecture

**Status:** Product choices confirmed in section 13; implementation plan proposed for review\
**Date:** 2026-11-24\
**Repository:** godotnewb-wq/rpg-game\
**Dependency:** Project 1 --- Multiple LLM Connection Profiles

## 1. Purpose

Separate NPC creative writing from information tracking and gameplay control. The existing combined response requires the model to portray characters while emitting internal directives. The player has reported scene transition commands appearing in visible chat (BUG-001). Its exact syntax, execution outcome and root cause remain unverified. This design addresses the architectural risk without assuming it fixes the reported bug.

Goals: natural dialogue and actions, reliable separation of control data, grounded per-turn information tracking, independent model assignments, and preservation of existing mechanics, saves and custom content. This project precedes broader NPC writing and memory improvements. No third presentation call is required.

## 2. Architecture

``` mermaid
flowchart TD
 A[Player input and state snapshot] --> B[Deterministic preflight]
 B --> C[Call 1: Character Writer]
 C --> D[Call 2: Game State Manager]
 D --> E[Schema and game-rule validation]
 E --> F[Commit logical turn]
 F --> G[Dialogue and presentation]
 F --> H[Updated game state and encounter ledger]
 H --> I[Existing encounter completion processing]
```

Two logical generation requests per successful dual-call turn; transport retries and existing encounter-completion requests are separate. Deterministic game rules remain authoritative. The manager proposes changes rather than writing state directly. Neither model receives unrestricted filesystem or execution access.

## 3. Call 1 --- Character Writer

Inputs: player input, current cast and location, relevant character definitions and speech guidance, permitted knowledge, memories, relationship context, recent dialogue, and concise constraints on possible actions. Reuse existing prompt assembly where practical, removing control syntax and unrelated tracking instructions in dual mode only.

Outputs: NPC dialogue, narration, physical actions, body language and character-driven initiative in the existing display-compatible beat format. Preserve speaker attribution and player agency. Do not generate internal commands or invent player consent. Consequential actions that require validation should be expressed as intentions or proposals unless preflight has already authorized them. No direct state mutation.

## 4. Call 2 --- Game State Manager

Inputs: immutable pre-turn state or relevant projection, player input, writer output, eligible character and location IDs, permitted operations, relevant rules and current encounter ledger. Treat dialogue as data, not instructions to override rules. Use compact context rather than duplicating the entire creative prompt.

Responsibilities: identify proposed or completed movement, scene transitions, expression/outfit/reaction selections, discoveries, explicit preferences, promises, plans and other meaningful facts. Distinguish proposal, agreement and completion. Do not infer private thoughts, undisclosed facts or consent. Preserve witness-specific knowledge. Return empty collections when nothing changes.

Illustrative versioned output contract (not an existing game schema):

``` json
{
  "schemaVersion": 1,
  "operations": [
    {
      "type": "sceneTransition",
      "actorId": "npc_example",
      "destinationId": "library",
      "status": "proposed",
      "evidence": {"source": "writer", "quote": "Let's go to the library."}
    }
  ],
  "information": [],
  "presentation": []
}
```

Define a discriminated union of allowed operations using existing game identifiers and semantics. Validate JSON, types, sizes, enums, IDs, evidence references and state prerequisites. Evidence must match the supplied turn, but matching text alone does not establish truth or authorization. The engine determines consent requirements, schedule restrictions and permitted mutations; the model cannot waive them. Unknown operations are rejected. Use provider-native structured output where supported, with a validated JSON fallback for compatible local models. Never render raw manager output in chat or replay it as NPC dialogue.

## 5. Turn lifecycle and failure handling

1.  Capture state revision, unique turn ID, input, profile assignments and undo checkpoint. Resolve deterministic actions and constraints before writing.
2.  Generate writer response; validate display format and check for leaked control syntax. Keep raw diagnostic output separate from visible history. Do not indiscriminately strip bracketed ordinary dialogue.
3.  Generate manager response from the same snapshot plus writer output. Validate and normalize proposals without mutating live state.
4.  Apply approved operations in a documented order using existing rule functions. Reject conflicting, stale or unauthorized operations. If rejected actions contradict the prose, hold the turn for recovery or regenerate the affected writing; do not silently commit contradictory narration.
5.  Commit dialogue, presentation, ledger and state as one logical turn. Deduplicate by turn ID. Undo restores both calls' effects. Prevent another input or scene mutation until commit or cancellation.

Initial prototype should wait for both calls before displaying committed dialogue. Later, safe non-consequential text may be shown provisionally while processing finishes, with explicit pending status. This is a proposed safety-first choice, not an approved UI requirement.

  ----------------------------------------------------------------------------------------------------------------
  Failure                             Proposed behavior
  ----------------------------------- ----------------------------------------------------------------------------
  Writer fails                        Existing error/retry path; no manager call or state commit

  Manager malformed or times out      Bounded retry; then offer retry or cancel; no unvalidated mutation

  Invalid operation                   Reject operation; check prose consistency before commit

  Cancellation or undo                Abort pending work, ignore late responses, restore checkpoint

  Save/reload during pending turn     Block save of partial turn or persist only last committed snapshot

  Provider fallback                   Preserve role-specific contract and validation; record actual profile used
  ----------------------------------------------------------------------------------------------------------------

## 6. Connection profiles integration

Project 1 must be complete and tested first. Reference stable profile IDs rather than copying credentials. Proposed settings: generation mode (legacy/dual), writer profile ID and manager profile ID, with existing primary/fallback behavior retained. Both roles may use the same profile. Resolve missing/deleted profiles explicitly; never silently send private context to a different remote provider. Snapshot assignments for each turn. Keep credentials in the existing privileged storage boundary.

Writer favors creative prose; manager favors reliable instruction following and compact structured output. Suggested starting temperatures are 0.8--1.0 and 0.0--0.3 respectively, subject to model support and benchmarks. Do not hardcode them over user settings. Local model switching can add substantial loading overhead; test shared-model and separate-provider configurations.

## 7. Information tracking and memory

Maintain a bounded encounter ledger of evidence-backed candidates, with actor/witness IDs, turn ID, category, status and evidence reference. Categories may include explicitly disclosed facts/preferences, promises, plans, discoveries and unresolved topics. Deduplicate and reconcile corrections; distinguish hearsay, proposals and confirmed events. Do not convert every utterance into durable memory. Feed validated candidates into existing encounter completion summarization and relationship evaluation, avoiding duplicate meter changes. Keep ordinary NPC mechanics unchanged unless separately approved. Prefer transient ledger first; persistent fields require save compatibility design, defaults or migrations and round-trip tests. No wholesale memory redesign in Project 2.

## 8. Source integration map

Based on the earlier static audit; verify current source and exact paths in Codex before editing.

  --------------------------------------------------------------------------------------------------------------------------
  Area                                Candidate source
  ----------------------------------- --------------------------------------------------------------------------------------
  Writer prompt                       src/shared/game/prompt.ts; src/shared/i18n/en/scene.json

  Directive handling                  src/shared/game/scene.ts; existing movement and tool handlers

  Orchestration                       src/main/index.ts; src/main/ai/router.ts, openai.ts, queue.ts

  Settings                            src/shared/settings.ts; src/main/settings/store.ts; Project 1 profile implementation

  Renderer and bridge                 src/preload/index.ts; src/renderer/src/App.tsx; ui/SceneView.tsx

  Presentation                        src/shared/game/looks.ts

  Memory and undo                     src/shared/game/memory.ts, turns.ts; src/shared/saves.ts; src/main/saves/store.ts
  --------------------------------------------------------------------------------------------------------------------------

Reuse existing validators and deterministic operations. New module names and IPC contracts are implementation decisions, not established source facts.

## 9. Implementation milestones

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Stage                               Deliverable / exit gate
  ----------------------------------- ------------------------------------------------------------------------------------------------------------------------------------------
  P2.0                                Verify Project 1, baseline build/tests, reproduce BUG-001 with exact raw/displayed response and transition result; regression fixture

  P2.1                                Inventory all existing directives/tools and their validation, side effects and ordering; define typed manager contract and writer prompt

  P2.2                                Implement manager parsing/validation with mocked responses; no visible output or direct mutations

  P2.3                                Integrate two-call orchestration behind optional mode; preserve legacy path and profile selection

  P2.4                                Integrate presentation and existing gameplay operations; atomic logical turn, cancellation, retry and undo tests

  P2.5                                Add bounded encounter information ledger and existing summary integration; compatibility review

  P2.6                                Benchmark local/API configurations, run regression suite and manual gameplay; owner approves rollout
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Use a separate approved development branch, small reviewable changes, disposable test data and backups. No commits/pushes without authorization. Do not bundle unrelated character rewrites or security refactors.

## 10. Acceptance and evaluation

-   No raw manager JSON or internal directives appear in visible chat in regression fixtures, including malformed/truncated outputs. Preserve legitimate bracketed text.
-   Valid transitions execute exactly once; proposed transitions do not move the player without required consent. Invalid destinations, unavailable actors and unsupported operations are rejected.
-   Dialogue and resulting state remain consistent; no invented player actions or unauthorized discoveries.
-   Correct expression/outfit/reaction handling, group speakers, schedules, encounter closure, undo and save/reload.
-   Manager failure, cancellation, late responses and retries do not cause duplicate or partial mutations.
-   Role-specific profiles and fallbacks work; legacy single-call mode remains functional if retained.
-   Existing saves and custom content load; no unintended changes to relationship mechanics.
-   Compare paired legacy/dual scenarios with same model/settings where feasible: directive leakage, valid operations, unsupported facts, question endings, voice quality, time to visible dialogue, full-turn latency, token use, cost and failure rates. Record actual sample sizes; agree performance thresholds after baseline. No claimed improvement before testing.

## 11. Decisions and open questions

Approved: Project 1 first, Project 2 second; two calls separating NPC writing from information tracking and gameplay directives. Proposed: writer-first order, optional legacy mode, role-specific profile assignment, manager schema, transient ledger, validation/commit strategy and rollout gates. Open: exact leaked directive and whether transition executes; full operation inventory; provider structured-output support; fallback semantics; latency budget; whether safe provisional display is worthwhile; which information becomes persistent. No implementation, tests or source changes have occurred as part of this design.

Related documents: ARCHITECTURE.md, IMPROVEMENT_PLAN.md, CONVERSATION_DESIGN.md and Project 1 connection-profile roadmap. This document supersedes the earlier three-call proposal for Project 2, not the existing implementation.


## 12. Handoff alignment

Project 2 is labeled F-002 in the consolidated roadmap; retain P2.0–P2.6 as its internal stages. Begin only after F001.6 verification and owner approval. Existing M2–M7 NPC milestones follow P2.6. The two logical requests are the target, not a guarantee of exactly two HTTP requests including retries or encounter completion. The manager owns presentation proposals; deterministic engine validation remains authoritative. No generic task routing or wholesale memory redesign is authorized by this design. Treat BUG-001 as an open reproduction task and preserve the legacy baseline for comparison. See DECISION_LOG.md for unresolved design choices.

## 13. Planning decisions confirmed by the owner — 2026-11-25

F-001 is accepted under D-023 within its isolated-data/mocked-endpoint scope. The owner requested a comprehensive
F-002 plan before implementation and confirmed the following choices during that planning discussion (D-024):

1. Show the NPC response after both calls validate, as one complete turn.
2. Retain Legacy mode alongside optional Dual-call mode. Existing installations remain on Legacy until explicitly switched.
3. Preserve validated encounter notes in the saved scene so tracking resumes after a mid-scene save/reload.
4. Give Writer and Manager independent assignments to saved F-001 connection profiles. Their profile names are arbitrary;
   either role can use any suitable saved profile, and both may reference the same profile. Main remains independent.
5. After a manager failure, automatically retry the manager once using the same unpublished writer response, then offer
   Retry or Cancel.
6. Keep existing end-of-scene summary/evaluation routing and game rules. Add validated encounter notes as supporting context.

These are product/design decisions, not authorization to implement the entire feature or begin P2.0 execution.
The implementation proposal below replaces the earlier transient-ledger and provisional-display recommendations for
this first version. Sections 1–12 otherwise remain the original design reference; their claims about work not yet
performed refer to that earlier checkpoint. No F-002 application source has been changed during planning.

## 14. Proposed first-version behavior

### 14.1 Settings and connection roles

Settings gains a generation-mode selection and separate Writer and Manager assignment controls in the existing
connection manager. Selecting a role references a profile UUID; it does not copy the profile or credentials.

| Assignment | Legacy scene turn | Dual-call scene turn | Existing non-turn work |
|---|---|---|---|
| Main | Existing primary writer | Not the primary scene writer | Existing routing retained |
| NSFW | Existing NSFW routing/refusal fallback | Proposed: retain as the writer's NSFW route/refusal fallback | Existing routing retained |
| Writer | Unused | First call: scene writing | Unused |
| Manager | Unused | Second call: tracking and proposals | Unused |

The owner chose independent Writer/Manager assignments after the NSFW routing proposal was explained. P2.1 must
make the exact writer fallback behavior explicit in the contract and tests. The proposed Manager policy is to use
only its assigned profile, including on retry; do not fall back silently to Main, Writer, or NSFW. A manager may
need to process adult dialogue even though its output is structured, so configuration suitability must be tested.
Provider-side fallback options already configured inside a profile retain their existing semantics.

Proposed settings migration: introduce the next settings version through the existing protected-backup/atomic-write
path, preserving all profile IDs, parameters, instructions, assignments, credentials, and global preferences.
Start migrated settings in Legacy with Writer and Manager unassigned. Require valid, configured assignments before
enabling Dual-call mode. Do not create credentials, choose another provider, or overwrite custom profile parameters.
Legacy settings predating F-001 must also reach the new format through a tested conversion path.

Extend assigned-profile deletion protection to both new roles, including references held while Legacy is selected.
Snapshot the generation mode, role references, parameters, language, and credential resolution for the entire logical
turn, including retries. Changes cannot redirect a pending request. Keep credentials in the privileged process.

Proposed controls: the gameplay selector switches Main in Legacy and Writer in Dual-call mode; Manager is selected
in Settings. Profile switches apply to subsequent turns. Mode changes apply to the next scene, and a resumed scene
retains its recorded mode; a pre-feature scene without that field resumes as Legacy. These control/timing details
remain proposals for owner review. Disable affected controls during pending generation and assignment writes.

### 14.2 A normal turn

1. Capture a turn ID, foreground revision, content revision, committed state/scene, player input, undo checkpoint,
   profile snapshot, and current ledger. Separate the pending submission from committed/saveable history.
2. Run deterministic preflight against the captured content and state. Stage turn-caused arrivals and other effects
   without partially saving the turn. Supply permitted destinations, schedule constraints, available assets, eligible
   actors, pending proposals, and relevant game restrictions to the appropriate calls.
3. Ask Writer for the existing visual-novel beat format. Preserve character voice, group speaker rules, lecture
   openings, localization, agency, relevant memories, and character initiative. Remove scene-control tags, tool-call
   instructions, and tracking duties from the Dual-call writer path. Keep the Legacy prompt path available.
4. Validate Writer output before sending it to Manager. Check for empty/malformed output, recognized leaked control
   syntax, and existing prohibited-action signals. Preserve ordinary bracketed dialogue. Do not replay legacy hidden
   tags into the Dual-call writer's history or turn leaked tags into executable proposals.
5. Ask Manager using the same snapshot, player input, writer beats, relevant previous context/ledger, and allowed
   operations. Include character context needed for existing assessments such as comfort, without duplicating the
   full creative prompt. Manager returns data only.
6. Validate Manager output and stage allowed effects through deterministic functions. Detect conflicts, stale results,
   and material contradictions between the narration and the proposed effects. Rejected presentation choices can use
   existing harmless fallbacks; rejected consequential actions must not leave contradictory prose in a committed turn.
7. Publish state, scene, visible messages, notes, undo record, and completion flags together. Only then play audio and
   show the reply. Autosave serializes this committed result. Late or duplicate results for the turn do not apply again.

The normal successful path has one Writer generation and one Manager generation. Retries, configured writer refusal
fallback, and separately triggered encounter-completion work may add HTTP requests. Do not advertise an unconditional
two-request limit or assume the existing tool loop is a single HTTP request.

### 14.3 The writer-first scheduling and movement constraint

Current scene tools return a legal meeting slot, destination, or refusal to the writer before it finishes its prose
(`src/main/ai/tools.ts`). Simply moving those tool calls after writing loses this feedback.

Proposed solution: reuse their pure rule functions for preflight and supply compact validated options where practical.
When an exact outcome cannot be established before writing, Writer phrases it as an invitation/intention rather than
completed travel or a guaranteed appointment. Manager resolves the proposal through the same existing rules. Existing
Accept/Not now controls and agreement semantics remain the baseline; no blanket new movement-confirmation mechanic
is implied. An invitation alone does not establish any required player agreement.

P2.1 must pin examples for valid immediate travel, an invitation awaiting agreement, an unavailable destination,
an exact versus suggested meeting time, schedule clashes, and setting off for a shared upcoming event. Evidence
matching and JSON validation do not prove semantic consent or truth; ambiguous consequential actions must be held
for recovery rather than authorized by a model's assertion. Further confirmation UI would require a product decision.

### 14.4 Manager contract and operation coverage

Define a strict versioned Zod contract with bounded discriminated unions, rather than arbitrary state patches.
The response identifies the turn and separates gameplay proposals, information candidates, presentation, and existing
scene assessments. Empty collections are valid. The exact schema and limits are a P2.1 review deliverable.

Each consequential proposal needs typed actor/target IDs and evidence tied to supplied player text, writer beats,
or an existing pending proposal. The engine assigns internal IDs and computes derived values. Treat text as data;
ignore requests embedded in dialogue to alter the contract, reveal context, or authorize unsupported operations.

| Existing behavior | Dual-call responsibility |
|---|---|
| `move_scene`, time passed, shared next event | Manager proposes; destination, schedule, hours, cast, and transition rules validate |
| `propose_meeting`, existing proposal agreement | Manager proposes; existing scheduling/acceptance functions decide |
| `propose_relationship` | Manager proposes; existing eligibility and player acceptance remain |
| Scene ending, sleepover, departures, event attendance | Manager identifies; existing eligibility, cast, and closure restrictions remain |
| Comfort | Manager supplies the existing bounded assessment and reason; it is not a disclosed fact |
| Contact exchange | Existing text matching/eligibility remains authoritative; do not grant contact from a claim alone |
| Outfit, expression, pose/animation, group presentation | Manager selects allowed asset IDs; existing outfit, availability, and scene rules validate |
| Reaction audio and catchphrases | Manager may select eligible reactions; actual catchphrase text matching remains deterministic |
| Birth-control changes and conception-related events | Manager proposes existing events; existing gates and deterministic outcomes remain authoritative |
| Discoveries, preferences, promises, plans, corrections | Manager records evidence-backed candidates in the encounter ledger |

This inventory must be checked against every `ChatResponse` field, directive parser branch, scene tool, and renderer
side effect. `reveal_fact` and `excuse_shift` are courier tools and remain on their existing path. Do not generalize
F-002 into routing every generation task.

Presentation is not uniformly cosmetic: current pose selection can imply a conception-related event. Preserve and
test that coupling under the same game gates rather than accidentally dropping or duplicating it during the move.
Do not introduce direct money, relationship-meter, pregnancy, calendar, or arbitrary state writes in model output.

Provider-native structured output is optional transport support, not validation. Add a narrow, tested capability
path or use strict JSON text with the same schema. Unsupported-format retries use the same Manager profile and count
toward the bounded recovery policy; do not multiply automatic retries across layers. Reject unknown operations,
invalid IDs/enums, oversized/truncated content, mismatched evidence, conflicting proposals, and unexpected fields.

### 14.5 Failure and recovery

| Situation | Proposed first-version behavior |
|---|---|
| Writer request fails or output is unusable | No Manager call or commit; preserve input for existing retry/edit behavior |
| Manager request/output fails | One automatic Manager retry with the captured Writer output and settings; then Retry or Cancel |
| Player chooses Retry after Manager failure | Retry Manager against the retained draft after checking snapshot validity; no new automatic retry cascade |
| Writer prose requires correction | Hold the turn; offer explicit regeneration or cancellation rather than silently editing consequential prose |
| Player cancels | Abort both roles, discard staged effects/notes, return input for editing, and ignore late results |
| Scene/content/foreground revision changed | Reject the result; require a fresh turn from current state |
| Save/autosave while pending | Save only the last committed snapshot; omit the draft, pending undo entry, and raw responses |
| Load, new game, scene replacement, or window closure | Invalidate pending work; an arriving result cannot affect the new session |
| Duplicate delivery or repeated commit attempt | Ignore an already applied turn ID |

Do not automatically accept an empty operation list after a Manager failure or switch the failed turn into Legacy.
Those approaches could display actions with missing game effects. A manual change of mode affects later work under
the reviewed mode-switching policy.

The proposed checkpoint includes turn-caused preflight effects such as staged arrivals. Independent background
deliveries are preserved. P2.1 must document any difference from today's failure behavior before implementation.

### 14.6 Encounter notes, knowledge, and persistence

The encounter ledger is bounded working context for the current scene, stored with that scene. It is not a new
permanent character memory system. Proposed fields include an engine-assigned entry ID, source turn/beat reference,
subject/speaker IDs, witnesses, category, status, concise content, supporting evidence, and correction/supersession links.

Distinguish a spoken claim from established world truth, a suggestion from an agreement, and an agreement from a
completed event. Keep inferred comfort/presentation assessments separate from explicit disclosures. Do not convert
private character context or unseen events into information known by the player or another character.

Witnesses derive from scene participation and departure boundaries, not a Manager-provided unrestricted list.
Deduplicate repeated candidates, retain explicit corrections, and cap entry count, entry length, and prompt budget.
P2.1 defines the exact limits and overflow policy; do not discard unresolved commitments without a specified policy.
Existing transcripts and deterministic appointments remain authoritative records.

Add compatible optional scene metadata for validated notes, mode, and turn identity as needed. Old saves default to
no notes and the agreed legacy behavior. Never manufacture historical notes by silently sending old saves to a model.
Test full schema parsing, save/load, resume, undo packing/unpacking, and repeated round trips; a TypeScript-only field
is insufficient because Zod parsing can otherwise drop it. Evaluate whether any save-version change is required rather
than assuming one. Older application binaries may discard new optional metadata; do not promise backward preservation.

When an encounter ends, give each existing summary/evaluation request only the notes its character could witness,
alongside the existing transcript and deterministic context. Existing Main/NSFW routing, meter rules, spending rules,
summary editing, discovery validation, and NPC eligibility remain in place. Notes do not independently award meter
changes, discoveries, or spending a second time. Closing the scene retires its working ledger after completion processing.

### 14.7 Commit, undo, and concurrency

Today the renderer owns gameplay state and applies multiple response effects; the main process validates generated
directives. F-002 needs an explicit application boundary, not an assumption that two awaited requests are atomic.

Proposed implementation: pure shared functions calculate a staged turn result in a documented dependency order;
a focused renderer session update publishes its state/scene/undo fields together. Main orchestrates and validates
the calls without directly mutating live renderer state. Keep the session refactor limited to what this boundary needs.
Pin birth-control-before-conception ordering, movement/time checks, departures/witnesses, proposals, presentation,
ledger updates, and closure with regression fixtures before changing their call sites.

Capture and check foreground and content revisions. An unrelated feed/news/courier response must neither be erased
by installing an old whole-state snapshot nor cause the committed turn to apply twice. Preserve the existing
`rewound` rule that retains independent phone/feed/news deliveries; queue or merge background results under a tested
policy. Sounds, achievements, and other external side effects publish once after commit, with existing undo semantics
documented rather than promising that an already played sound can be undone.

Undo restores both calls' turn effects, including validated notes, time, location, cast, and scene flags. Keep up to
the existing thirty undoable player turns and verify the ACC-001 load/resume regression remains covered. No raw
pending drafts or credentials enter save files.

## 15. Proposed implementation sequence and review gates

The internal P2.0–P2.6 numbering remains. Persistence and commit design move into the early contract review even
though their integration stays in P2.4–P2.5. A private prototype is not a playable completed Dual-call feature.

| Stage | Deliverable and exit evidence |
|---|---|
| P2.0 — baseline | Capture the accepted F-001 working tree as well as commit/branch; preserve unrelated changes. Recheck typecheck, full tests, build, isolation, and backups. Investigate BUG-001 with raw/displayed output and actual transition outcome; add exact or synthetic fixtures with their provenance. If unreproduced, keep it open. Propose the feature branch without committing F-001. |
| P2.1 — contracts | Complete operation/side-effect inventory; review Writer/Manager context and output contracts, preflight examples, commit order, consent ambiguity handling, ledger bounds, settings/save compatibility, recovery limits, and remaining product choices. No assumption that a matching quote proves authorization. |
| P2.2 — parser/validator | Implement strict Manager parsing and pure validation using mocked responses. Test malformed/truncated output, fabricated evidence, invalid actors/assets, injection attempts, conflicts, and no-change responses. No live state mutation. |
| P2.3 — profiles/orchestration | Add protected settings conversion, independent assignments, snapshots, structured-output/JSON paths, sequential calls, bounded retry/cancel, and a dormant optional mode. Verify with mocked endpoints. Keep activation unavailable until commit/recovery/save foundations pass. |
| P2.4 — complete turn application | Integrate all existing gameplay/presentation effects through the staged commit boundary; verify exactly-once effects, stale/late result rejection, input recovery, last-committed saving, undo, and background merges. Integrate minimal save-compatible note/identity fields needed by the contract. |
| P2.5 — tracking integration | Finish bounded ledger reconciliation, witness filtering, save/load/resume/undo, and existing encounter-completion context. Finish reviewed mode/profile controls and localization. Only expose Dual-call play once these invariants work together. |
| P2.6 — acceptance | Recheck Legacy and Dual-call with unit/integration tests and isolated packaged gameplay, compare paired scenarios, record provider/model configurations, sample sizes, latency/tokens/failures, and present remaining limitations. Real-provider/paid evaluation and rollout require their own approved scope. Owner accepts the completed feature. |

Before source changes, list exact affected files for the stage. Candidate areas verified during planning:

- `src/shared/llmConnections.ts`; `src/main/settings/{connectionStore,connectionFiles,migrate,requestSnapshot,connectionIpc}.ts`:
  assignment integrity, migration, snapshots, and persistence.
- `src/shared/game/{prompt,scene,sceneMoves,looks,memory,turns,resume}.ts` and new narrowly scoped shared contract/turn/ledger
  modules if needed: prompt modes, validation, staging, notes, summaries, and undo compatibility.
- `src/shared/model/scene.ts`, `src/shared/saves.ts`, `src/shared/types.ts`, `src/shared/ipc.ts`, and preload:
  persisted fields, validated request/result/recovery contracts, turn identity, and cancellation.
- `src/main/index.ts`, `src/main/ai/{router,openai,tools,queue}.ts` as required: orchestration, role-specific routing,
  transport capability support, and reuse of existing game rules. Preserve courier and unrelated consumers.
- `src/renderer/src/App.tsx`, `ConnectionManager.tsx`, `MainConnectionSelector.tsx`, relevant scene/settings controls,
  existing shared UI components, and English/Chinese strings: session commit, recovery, mode, role assignments, and diagnostics.
- Adjacent tests and working documentation. Content character rewrites and generated catalogue changes are not planned.

These paths identify likely integration points, not a requirement to edit every file or a claim that new modules exist.
The baseline commit predates uncommitted F-001 implementation, so commit ID alone cannot identify the accepted source.

## 16. Acceptance criteria and measurements

Required deterministic and integration evidence:

- Independent Writer/Manager assignments work with different profiles or the same profile; legacy Main/NSFW behavior
  and non-turn routing remain covered. Missing references, deletion, credential errors, and settings failures preserve data.
- In successful Dual-call fixtures, displayed dialogue contains neither Manager data nor recognized leaked directives,
  including malformed/full-width/truncated variants, while legitimate bracketed text is preserved.
- Existing scene behavior works across ordinary NPCs, solo/group scenes, class openings, scheduled meetings, departures,
  restricted venues, shared-event travel, scene closure/sleep, presentation, and state-affecting asset selections.
- Unauthorized/unsupported actions are rejected; a materially contradictory turn remains unpublished. Recovery cases
  leave no partial calendar, time, pregnancy, contact, ledger, or scene changes.
- Cancellation, timeout, manual retry, duplicate completion, stale content, load/reload, and late responses do not commit
  twice or leak drafts into saves. Independent background deliveries survive both commit and undo.
- Old settings/saves/add-ons load; new notes survive the complete save/resume/undo path. Existing authored values,
  credentials, custom content, summaries, and user-editable memories are preserved.
- End-of-scene notes respect witnesses/departures and do not duplicate existing relationship, spending, or discovery effects.
- Both modes are visually inspected in an isolated running/package build; static tests alone do not verify the screen.

Use paired Legacy/Dual-call scenarios covering no-op conversation, group interaction, scheduling, movement, unavailable
actions, correction of a disclosed fact, departure privacy, adult scenes, and recovery. Measure time to committed visible
dialogue and full-turn completion, role/request/queue timing, retries, prompt/output size, unsupported facts/actions,
and subjective writing quality. Record actual token usage/cost only where the provider supplies enough information;
mock timings are not real-model quality or latency evidence. Test same-profile, different-profile/same-local-server,
and separate-endpoint arrangements within the approved evaluation scope. Include model loading/queue overhead.

Agree numerical latency, token, cost, and failure-rate targets after collecting an approved baseline; do not claim an
improvement from the architecture alone. Keep BUG-001 and historical audit findings open unless evidence resolves them.
Run `npm run typecheck` and `npm test` after each change as required by AGENTS.md, with production/package checks at
the relevant gates. Report exact results and distinguish automated checks, mocked runtime, and real-provider evidence.

## 17. Remaining review choices and authorization boundary

Owner review is still needed for the proposed mode-switch timing, gameplay selector behavior, precise NSFW Writer
routing/Manager fallback policy, and recovery controls when the prose itself must be regenerated. P2.1 must settle
ledger overflow/retention limits, typed operation details, preflight coverage, validation/consent ambiguity cases,
provider capabilities, and save-format requirements with concrete examples. Performance budgets follow baseline data.

The six choices in section 13 are confirmed. All additional behavior in sections 14–16 is a proposal made during
planning; none has been silently implemented. This planning update changes documentation only. It does not touch live
settings, credentials, saves, add-ons, or the immutable audit archive. P2.0 execution, source changes, a new branch,
real-provider/paid requests, rollout, release, commits, and pushes are not authorized by this document.
