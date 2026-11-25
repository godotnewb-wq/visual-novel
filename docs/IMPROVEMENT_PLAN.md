# Improvement Plan

**Repository:** godotnewb-wq/rpg-game · **Date:** 2026-11-24\
**Status:** Proposed roadmap following M0 static audit; implementation not authorized by this document.

Current implementation checkpoint: the owner accepted F-001 under D-023 (2026-11-25) within the documented isolated/mock scope after F001.6 and the D-022 undo repair/recheck passed. ACC-001 is resolved. See F001_ACCEPTANCE_REPORT.md for preserved evidence and limits; separately scope/approve F-002/P2.0 before implementation. The roadmap below retains its historical scope.

## 1. Objective and scope

Create natural back-and-forth dialogue with distinct voices, independent NPC intentions, meaningful pauses, grounded knowledge and emotional continuity. Preserve the visual novel beat presentation, player agency, game rules, localization and custom content. Prefer targeted changes and measured experiments over a rewrite. The reported eight-in-ten question endings are an informal observation, not a baseline measurement.

## 2. Priority and dependencies

**Current approved order (2026-11-24):** M1/F001.0 baseline → F-001 (Project 1: LLM Connection Manager) → F-002 (Project 2: Dual-Call Generation Architecture) → M2–M7 NPC improvements. Each feature requires its own verification and owner approval. Existing NPC milestone numbering and original audit recommendations are retained. F-002 is a handoff alias for Project 2; its internal P2.0–P2.6 numbering remains unchanged.

| Feature | Dependency | Detailed design |
|---|---|---|
| F-001 | M1/F001.0 | `LLM_CONNECTION_ROADMAP.md` |
| F-002 | F001.6 accepted | `DUAL_CALL_GENERATION_DESIGN.md` |
| M2–M7 | F-002 accepted; individual gates below | This plan |

The historical milestone table below describes NPC-specific dependencies; the new feature gates above additionally apply to every M2–M7 milestone. M1 and F001.0 share baseline work, not duplicate mandatory runs.


  --------------------------------------------------------------------------------------------------------------------------------------------------------------
  Milestone         Scope                                                      Priority                          Dependency
  ----------------- ---------------------------------------------------------- --------------------------------- -----------------------------------------------
  M1                Baseline, safe development setup and regression fixtures   Required                          M0

  M2                Natural endings and flexible dialogue rhythm               Highest conversational priority   M1

  M3                Character voice, companion parity and group relevance      High                              M2 baseline comparison

  M4                Memory validity, relevance and knowledge continuity        High                              M1; compatibility gate for persistent changes

  M5                Relationship semantics and NPC initiative                  High                              M3--M4 where relevant

  M6                Configurable conversational preferences and editor         Medium                            Evidence from M2--M3

  M7                Presentation nuance and optional media improvements        Medium/optional                   M2--M3

  R                 Reliability/security workstream                            Parallel, risk-based              M1; gates affected features
  --------------------------------------------------------------------------------------------------------------------------------------------------------------

This numbering supersedes earlier provisional milestone ideas; it is a proposal for approval. No dates or effort estimates are asserted without implementation investigation.

## 3. M1 --- Establish baseline

-   Record exact commit SHA, Node/npm versions, lockfile, model identifiers, provider parameters and content version. Reconcile AGENTS.md and CLAUDE.md instructions with owner; preserve existing saves and add-ons by default.
-   Back up Electron userData, use disposable test data, keep secrets out of repository and logs. Source player mode uses BREEDHAVEN_ADDONS=1 but does not itself isolate data.
-   After owner approves implementation, create a separate branch from verified main. No branch or commit was created during audit.
-   Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`; record actual results and existing failures. Run `npm run build:win` when packaged Windows verification is needed. Do not silently fix unrelated failures.
-   Establish representative dialogue fixtures, prompt snapshots and manual play scenarios. Capture raw and displayed responses with secrets/private context removed. Record latency, output length, directive validity and failures.

**Exit gate:** reproducible baseline or explicitly documented blockers, backup/recovery verified, known pre-existing failures recorded, owner agrees on evaluation scenarios.

## 4. M2 --- Natural dialogue first

**Findings:** M0-002--010, 012, 039, 055. **Primary files:** `src/shared/i18n/en/scene.json`, `src/shared/game/prompt.ts`, prompt and scene tests.

First experiment: change only `prompt.reply.end` to a natural stopping-point instruction. Candidate:

> End at a natural conversational stopping point. Statements, reactions, and silence are valid endings. Ask questions only when motivated by the character, never merely to prompt another response. Keep turns short and varied.

Preserve lecture behavior initially. Review `prompt.reply.unknowable` separately to retain knowledge boundaries without suggesting routine questioning. Compare fresh histories and replayed histories. Then test allowing one-beat reactions and variable length, relaxing rigid targets only where evidence supports it. Keep existing defaults for unaffected modes. Do not strip question marks or truncate generated dialogue mechanically. Test existing character extraInstructions before adding settings. Review final reminders for contradictory instructions.

**Acceptance:** fewer formulaic question endings relative to baseline in paired scenarios; motivated questions remain; no observed regression in player agency, directive handling, speaker attribution, scene closure or lecture behavior. Owner reviews naturalness; no arbitrary question quota.

## 5. M3 --- Character voice and group conversation

**Findings:** M0-011--017, 043--044, 047. **Files:** prompt.ts, scene.ts, character schemas and content, moods.ts.

Test existing speech patterns, examples and traits with contrasting characters. Evaluate compact companion voice guidance including relevant examples/extra instructions without copying entire biographies. Distinguish addressing from mentioning characters in speaker selection; preserve selective participation. Separate enduring personality, current mood and immediate reaction in prompt wording. Do not add personality meters before testing existing fields.

**Acceptance:** recognizable voices in solo and group scenes, relevant speakers, no compulsory round-robin replies, no observed increase in knowledge leakage or excessive context growth.

## 6. M4 --- Memory and knowledge

**Findings:** M0-017--024, 067, 073. **Files:** memory.ts, facts.ts, codex.ts, prompt.ts, IPC.summarize, save/model schemas.

First validate malformed summary output and use explicit fallback rather than storing malformed structured text. Preserve witness/departure boundaries. Compare current recall with a relevance/importance/recency ranking using existing codex-style keyword matching before considering embeddings. Investigate retaining important early facts in long transcripts. Consider structured promises and unresolved topics only after checking overlap with existing state. Ordinary NPC personal memory is an intentional scope expansion: require approval and compatibility design; do not attach romance meters by default. Consider withholding ineligible secrets from prompts where feasible; recorded discovery validation alone is insufficient.

**Acceptance:** relevant old callbacks, distinct witness perspectives, no unsupported discoveries, graceful malformed output recovery, bounded context and readable old saves. Test absent new fields and round-trip persistence before introducing persistent changes.

## 7. M5 --- Relationships and initiative

**Findings:** M0-025--041. **Files:** relationships.ts, bonds.ts, rapport.ts, drama.ts, social.ts, courier.ts, windDown.ts, prompt.ts, turns.ts.

Start by distinguishing affection from explicit commitment in prompt language; audit every stage-dependent rule before changing thresholds or identifiers. Preserve independent feelings and negative/unchanged outcomes. Investigate quality-sensitive ties and directional attitudes only as separate approved mechanics changes. Encourage character-driven topics grounded in interests, memories, events and obligations. Separate ending a turn from ending a topic or encounter. Evaluate wind-down flexibility without bypassing schedules. Prototype optional Continue only after defining time, undo, closure and player-agency semantics; expedition banter is a precedent, not a drop-in implementation.

**Acceptance:** high affection does not force agreement or invent commitment; characters initiate grounded topics and depart naturally; existing time, bond, drama and undo rules remain correct.

## 8. M6 --- Conversational customization

**Findings:** M0-008, 042--049. Add optional dialogue-only overrides or qualitative character preferences only if M2--M3 show need. Candidate controls: talkativeness, initiative, narration, question tendency, extra instructions. Inherit global defaults; avoid quotas. Coordinate schema defaults, nested merge behavior, editor, drafting, ordinary NPC support, card conversion, localization and pack round-trips. Consider prompt-size warnings.

**Acceptance:** existing characters load unchanged, settings survive reload and pack exchange, no loss of authored nested fields, secondary generation unaffected by dialogue-only controls.

## 9. M7 --- Presentation

**Findings:** M0-050--060. Use described custom sprites for thoughtful, skeptical, amused, worried, irritated and other nuanced reactions before extending standard expressions. Warn about missing neutral sprites. Test dialogue/presentation consistency and directive complexity. Defer TTS, video continuation, capability metadata and multi-output gallery unless separately approved. Keep media cancellation fixes in reliability workstream.

**Acceptance:** custom expressions resolve correctly, missing assets degrade safely, dialogue remains readable, no extra generation request required for ordinary expressions.

## 10. R --- Reliability and security gates

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Finding                 Action                                                                                                             Gate
  ----------------------- ------------------------------------------------------------------------------------------------------------------ ---------------------------------------------------------
  M0-001, 067, 069        Resolve compatibility guidance, backup data, isolate authoring; migrations before incompatible state changes       Before affected development

  M0-064, 072             Warn on plaintext credential fallback; review session-only storage and trusted credential destination validation   Early focused review before credential/download changes

  M0-062, 070             Review IPC sender/navigation, authorization, real-path containment and archive handling                            Before expanding privileged APIs

  M0-068                  Consider shared temporary-file replacement for JSON settings/content; test interrupted writes                      Before persistence refactors

  M0-071                  Verify model integrity policy, hashes and incomplete downloads                                                     Before downloader changes

  M0-059--060             Verify shared-server cancellation and per-job ownership                                                            Before concurrent media changes

  M0-065                  Document external data flows and provider retention distinction                                                    Before remote-service expansion

  M0-007, 074             Measure context growth and queue latency before budgeting or priority changes                                      Before transport redesign
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

Static findings are not proven exploits. Dependency vulnerabilities and complete IPC coverage remain unverified. Security changes should be independently reviewed and tested, not bundled into dialogue prompt experiments.

## 11. Evaluation protocol

Use paired baseline/candidate runs with the same model, settings, character, starting state and player input. Include at least two model configurations if available; repeat stochastic scenarios and report sample counts. Start with fixed scripted player turns, then manual free play. Record fresh versus existing histories separately. Proposed initial pilot: 10 scenarios, 3 repetitions per configuration; adjust after measuring cost and variance. This sample size is a planning choice, not statistical proof.

  ----------------------------------------------------------------------------------------------------
  Scenario                                  Observe
  ----------------------------------------- ----------------------------------------------------------
  Mundane greeting and casual topic         Formulaic vs motivated questions, natural stopping point

  Terse or reserved character               One-beat reactions, voice consistency

  Emotional disagreement                    Independent reactions, no automatic agreement

  Group with named and mentioned NPCs       Relevant speaker, no forced participation

  Ordinary NPC repeated encounter           Continuity within supported scope

  Old memory relevant to current topic      Recall relevance and accuracy

  Secret or absent witness                  Knowledge boundaries

  Long scene and busy NPC                   Context growth, closure, schedule adherence

  High affection without explicit bond      Commitment accuracy

  Invalid output, cancellation and reload   Recovery, undo, directives, save integrity
  ----------------------------------------------------------------------------------------------------

Record total replies, final spoken question count, reviewer-classified formulaic questions, agency violations, unsupported facts, repeated phrasing, voice and emotional continuity (1--5 reviewer rubric), words/beats, valid directives, latency and failures. Report denominators and qualitative examples; do not claim statistical significance from a small pilot. Zero observed violations is a regression target, not a guarantee. Acceptance thresholds beyond preserved mechanics and directional improvement require owner approval after baseline.

## 12. Codex handoff and change control

Use `CODEX_HANDOFF.md` as the entry point and read the complete working documentation set. Preserve `audit_archive/` as the immutable original evidence snapshot. Instruct Codex to inspect current branch and exact source, reconcile drift, report plan and affected files before edits, keep changes scoped, run relevant tests and report actual outcomes. No commits/pushes without authorization. Preserve localization keys and existing content, avoid exposing credentials, do not change save format casually. Each milestone should include a small diff, tests, manual verification, compatibility note and rollback instructions. Revert isolated changes rather than resetting unrelated user work. Update documentation with evidence and decisions after each approved milestone.

## 13. Audit closure

M0.1--M0.9 initial static reviews and M0.10 consolidation are complete. Runtime validation remains deferred until M1. No gameplay changes, builds, tests or repository commits were performed. The findings register remains in CONVERSATION_DESIGN.md; M0-001 is the repository-level conflicting compatibility guidance, recorded here and in the architecture document. Priorities, milestones, pilot sample size and proposed features are recommendations requiring owner approval.


## 14. Integration gates after the audit

F-001 must preserve legacy routing and credentials, establish stable profile IDs and verify all consumers. F-002 uses those IDs for two role-specific calls; broader per-task routing remains deferred. Reproduce BUG-001 (transition directives appearing in chat) before claiming a fix. Compare legacy and dual modes, measure full-turn latency and verify atomic state/undo before rollout. The original M2 prompt experiments should be re-baselined against the accepted generation architecture rather than blindly applied to obsolete prompts. M7's no-extra-request criterion means no third presentation call beyond the accepted turn architecture. Preserve the original M0 findings even if later fixes resolve them; record resolution separately in DEVELOPMENT_STATUS.md. See DECISION_LOG.md for approval boundaries.
