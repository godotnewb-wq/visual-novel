# Project 2 --- Dual-Call Generation Architecture

**Status:** Approved project direction; detailed design proposed for review\
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
