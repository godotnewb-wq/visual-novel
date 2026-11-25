# Conversation Design --- Living Audit

**Status:** Milestone 0 static audit and consolidation complete. No gameplay changes implemented. Baseline builds and tests pending M1.

## Purpose and design objectives

Improve natural back-and-forth conversation between the player and NPCs while preserving visual novel presentation and game mechanics.

-   Natural rhythm: statements, reactions, questions, pauses and observations arise organically.
-   Distinct voices: vocabulary, temperament, mannerisms and motivations distinguish characters.
-   Character autonomy: NPCs have independent interests and intentions rather than behaving like engagement assistants.
-   Player agency: never invent player dialogue, thoughts or actions.
-   Knowledge boundaries: distinguish witnessed, learned and unknown information.
-   Emotional continuity: reflect prior encounters, relationships and current circumstances.
-   Structural variation: avoid repetitive phrasing, narration and endings.
-   Group dynamics: avoid mandatory round-robin participation.
-   Preserve existing mechanics and assess compatibility before implementation.

## Current architecture

Repository: `godotnewb-wq/rpg-game`, main branch, version 0.8.7 at initial inspection.

Player input in `src/renderer/src/ui/SceneView.tsx` passes to `App.tsx` (`send`, line 890), through `src/preload/index.ts` to the `IPC.chat` handler in `src/main/index.ts` (line 664). The handler builds a dynamic system prompt with `src/shared/game/prompt.ts` (`buildCharacterPrompt`, line 153), reconstructs scene history with `sceneTurns`, and calls `src/main/ai/router.ts` and `openai.ts`. `src/shared/game/scene.ts` parses directives and splits visible dialogue into beats. Character content, relationships, memories, location and game state inform the prompt. Line references reflect the inspected revision and may drift.

## Findings register

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  ID                      Finding                                     Evidence and status
  ----------------------- ------------------------------------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  M0-002                  Hardcoded response length                   `prompt.ts`: 2--4 beats, 25 words per beat, 60 total; lecture targets 5--8 beats, 30 words per beat, about 180 total. Confirmed source.

  M0-003                  Modular prompt architecture                 `src/shared/i18n/en/scene.json` holds localized writing instructions and reminders. Confirmed.

  M0-004                  Behavioral evaluation opportunity           `prompt.test.ts` and `scenePrompt.test.ts` cover prompt structure; generated dialogue quality evaluation not identified in inspected tests. Preliminary.

  M0-005                  Answer-seeking endings                      `scene.json` keys `prompt.reply.end` and `prompt.reply.unknowable` encourage answerable endings and constrain question subjects. Confirmed wording; causal effect unmeasured.

  M0-006                  History may reinforce repetitive patterns   `prompt.ts:819–832`, `sceneTurns()` replays assistant responses with hidden tags. Confirmed mechanism; behavioral impact hypothetical.

  M0-007                  Context growth                              `sceneTurns()` and `openai.ts:134–240` send full scene history without explicit token budgeting in inspected path. Other scene-duration limits require review.

  M0-008                  Custom profile instructions                 `openai.ts:141–143` appends `profile.instructions` to system prompt. Confirmed; settings UI exposure pending inspection.

  M0-009                  Tool compatibility                          `openai.ts` retries certain tool-related endpoint errors without tools. Models may differ in gameplay capabilities.

  M0-010                  Soft formatting constraints                 `scene.ts:362–383`, `dialogueLines()` splits on newlines and recognizes narration and speakers; does not enforce word or beat counts. Confirmed.
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## Behavioral observations

The player reports NPC replies ending in questions approximately eight times out of ten across multiple models. This is an informal observation, not a measured benchmark. Shared prompt instructions and replayed conversation patterns are plausible contributors.

Current `prompt.reply.end`:

> -   Say one thing and stop. End on something {player} can answer. This is a conversation, not a speech: short turns, back and forth.

Current `prompt.reply.unknowable`:

> -   {player} knows only what he has seen or been told. Anything you invent (a book's contents, a person, an event he wasn't at) he cannot know: tell him about it rather than ask him about it, and ask him only about himself, his opinions, and what has happened in front of him.

These rules are inserted at `prompt.ts:339–341`. Ordinary replies are instructed to contain mostly speech and at most one short action or expression in third-person present tense. Group instructions already allow selective participation. Opening and lecture prompts differ from ordinary turns. The final reminder repeats length and formatting requirements.

## Proposed improvements --- not approved for implementation

1.  Replace the answer-seeking ending instruction with a natural stopping-point rule. Candidate: "End at a natural conversational stopping point. Statements, reactions, and silence are valid endings. Ask questions only when motivated by the character, never merely to prompt another response. Keep turns short and varied."
2.  Review `prompt.reply.unknowable` without weakening knowledge boundaries.
3.  Consider configurable dialogue length and narration balance; preserve current defaults.
4.  Investigate dedicated dialogue-only instruction overrides, since profile-wide instructions can affect secondary generation tasks.
5.  Improve prompt inspection and evaluate context budgeting after reviewing scene duration and memory.
6.  Consider optional formatting normalization rather than destructive truncation.
7.  Review character-specific examples, voice, autonomy, group speaker selection, emotional state and knowledge in later audit stages.

## Evaluation plan

After the full audit, establish baseline builds and automated tests. Compare controlled dialogue scenarios across models, keeping settings and inputs consistent. Test fresh scenes and existing histories separately.

Record question-ending frequency (distinguish motivated from formulaic questions), character voice, player agency violations, repetition, knowledge leakage, group dynamics, emotional continuity, response length and mechanical correctness. Do not optimize toward an arbitrary question quota.

Baseline commands: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. No tests or runtime evaluations performed yet.

## Design decisions

-   Audit first; builds and tests after the full program picture is obtained.
-   Maintain this Markdown document in the ChatGPT project workflow for now. GitHub write access was denied; repository documentation can be transferred using Codex later.
-   No gameplay code changes during Milestone 0. Create a development branch when implementation begins.
-   Prefer targeted changes over architectural rewrites; preserve localization and existing mechanics.
-   Proposed improvements remain subject to approval.

## M0.3 — Character portrayal and NPC architecture

Sources: `src/shared/model/npc.ts`, `src/shared/model/trait.ts`, `src/shared/game/npcs.ts`, `src/shared/game/prompt.ts:345–435,490–567`, `src/shared/game/moods.ts`, `src/shared/game/scene.ts:483–508`, `content/default/traits.json`, and character definitions `anwen.json` and `bryn.json` under `content/default/love-interests/`.

| ID | Finding | Status |
| --- | --- | --- |
| M0-011 | Ordinary NPCs extend the love-interest schema; shared dialogue architecture with restricted mechanics. | Confirmed strength |
| M0-012 | Universal beat and speech targets can conflict with individual mannerisms (e.g. Anwen answering with a look). | Confirmed instruction tension; impact unmeasured |
| M0-013 | Trait definitions inform dialogue and jealousy/sociability modifiers inform simulation. | Confirmed strength |
| M0-014 | Mood derives from latest relevant happening over two game days, rather than accumulated influences. | Confirmed mechanism; impact unmeasured |
| M0-015 | Group lead selection favors first named character, otherwise least recently leading, with every fourth unnamed turn left to model. | Confirmed; relevance concerns untested |
| M0-016 | Companion description omits biography, backstory, examples and extra instructions present in primary character section. | Confirmed section asymmetry |
| M0-017 | Guarded secrets are included in prompt with disclosure instructions. | Confirmed; leakage risk untested |

### Conversation design implications

- Permit one-beat reactions, silence and variable response lengths when motivated by character and situation. Preserve player agency and presentation constraints.
- Evaluate existing speech patterns, traits and examples before introducing new numerical personality dimensions. Anwen and Bryn demonstrate distinct voices in existing content.
- Distinguish enduring personality, relationship, daily mood, immediate scene emotion and intention; inspect existing mechanisms before adding state.
- Evaluate relevance-based group speaker selection, including the distinction between mentioning and addressing a character. Preserve selective participation and avoid mandatory round-robin dialogue.
- Consider compact voice guidance for all participants, balancing characterization against context cost.
- Preserve knowledge and secret disclosure boundaries; evaluate them in M0.4.
- Add evaluation scenarios for terse characters, silent reactions, group topic relevance, companion voice consistency and mood transitions. No runtime evaluation performed.

Ordinary NPC scenes reuse character definitions but omit relationship meters, gifts, meeting arrangements and the inspected social mood prompt. Scene extras are limited to two and receive abbreviated information. These differences should be considered in dialogue testing.

## Audit stage tracking

All ten initial audit stages are now reviewed; subsequent sections retain the historical findings. Runtime validation remains pending.

## Revision history

-   2026-11-24 --- Initial document incorporating architecture discovery and primary LLM pipeline findings (M0.1--M0.2). Next: M0.3 character portrayal and NPC architecture.

- 2026-11-24 — M0.3 initial character architecture review; findings M0-011–M0-017 and evaluation additions. Next: M0.4 memory and knowledge.

## M0.4 — Memory and knowledge systems

Source references: `src/shared/game/memory.ts` (buildSummaryPrompt, parseSummary, sceneRevelations, addMemory, selectMemories), `src/main/index.ts` (IPC.summarize, lines 1176–1225), `src/shared/game/prompt.ts` (lines 265–285, 435–443), `src/shared/game/facts.ts`, `src/shared/game/codex.ts`, `src/shared/settings.ts`, `src/shared/game/memory.test.ts`.

| ID | Finding | Status / priority |
| --- | --- | --- |
| M0-018 | Separate perspective-based summaries for love-interest witnesses; departed characters receive transcript only through departure. | Confirmed strength |
| M0-019 | Ordinary NPC scenes explicitly omit personal memory generation and recall, though global memories remain available. | Confirmed intentional design; high for continuity |
| M0-020 | Memory selection ranks importance, recency and insertion order, not current topic; default limit eight separately for personal and global memories. | Confirmed; high |
| M0-021 | Codex retrieval already matches titles/keywords and uses priority and character budget. | Confirmed opportunity |
| M0-022 | Summaries target one sentence; transcripts over 12,000 characters retain only the end. | Confirmed mechanism; high, actual loss unmeasured |
| M0-023 | Player discoveries use structured fact IDs; encounter recollections are primarily free text. | Confirmed asymmetry; medium |
| M0-024 | Invalid summary JSON can become raw memory text without triggering the exception-based fallback. | Confirmed parser behavior; medium |

### Design implications

- Consider personal memories for ordinary NPCs without romance meters; this expands intentional original design.
- Combine relevance, importance and recency in recall; investigate reusing codex keyword matching and budgeting before adding embeddings.
- Preserve perspective-specific memories and departure boundaries. Consider compact structured personal facts, promises, shared experiences and unresolved topics alongside encounter summaries; avoid duplicating existing appointment or profile data.
- Investigate summary validation and graceful fallback; avoid storing malformed structured output as dialogue context.
- Guarded secrets remain visible to the model, but sceneRevelations validates discovered IDs against eligible hiddenFacts. This protects recorded discoveries, not necessarily visible dialogue.
- Add future evaluations for repeated ordinary NPC encounters, old topic recall, early-scene revelations, distinct witness perspectives, malformed summaries and unresolved-topic callbacks. No runtime tests performed.

### Revision history addition

- 2026-11-24 — M0.4 initial memory and knowledge review; findings M0-018–M0-024. Next: M0.5 relationships and emotional systems.

## M0.5 — Relationships and emotional systems

Sources: `content/default/relationships.json`; `src/shared/game/relationships.ts` (stageFor); `modifiers.ts` (feltChange, trustOf); `memory.ts` (sceneRapport, applyFeelings); `bonds.ts` (growTies, formBond, describeBonds); `rapport.ts` (setRelation, assignRapport); `drama.ts` (claimOf, dramaHooks); `prompt.ts` (370–435); `src/shared/i18n/en/scene.json` (memory.judge, memory.change, memory.negative, memory.three).

| ID | Finding | Status / priority |
| --- | --- | --- |
| M0-025 | Affection alone determines stage; Dating at 60 and Lover at 85 imply commitments that may not exist in explicit bonds. | Confirmed mechanism; high for consistency |
| M0-026 | Retrospective LLM evaluation is separated from deterministic meter updates. | Confirmed strength |
| M0-027 | Skills, relics and temporary modifiers can amplify emotional gains. | Confirmed; medium |
| M0-028 | Summary instructions support independent feelings, negative reactions and no automatic reward for time together. | Confirmed strength |
| M0-029 | Rapport and ties are symmetric, limiting structured one-sided attitudes. | Confirmed; medium |
| M0-030 | growTies defaults to +5 per pair sharing a scene (+1 for enemies), independent of dialogue quality. | Confirmed function behavior; medium |
| M0-031 | Rapport changes require matching judgments from both characters. | Confirmed strength with limitation |
| M0-032 | Drama engine scores autonomous interruptions using commitments, traits, proximity and availability. | Confirmed strength |
| M0-033 | Drama claim calculation treats affection-based Dating as a romantic claim even without a bond. | Confirmed; medium-high |

### Design implications

- Distinguish emotional attachment from explicit commitments in prompt wording; inspect all stage-dependent mechanics before changing thresholds or identifiers.
- Preserve independent affection, trust and desire evaluation, including negative and unchanged outcomes. Do not equate high affection with automatic agreement.
- Consider whether emotional progression should be grounded in remembered experiences even when mechanical bonuses accelerate meters.
- Investigate quality-sensitive tie growth and directional attitudes only after assessing compatibility and gameplay consequences.
- Reuse the simulation/portrayal separation for mundane NPC initiatives, such as callbacks and personal interests, rather than only dramatic interruptions.
- Evaluate high affection with low trust, high affection without a bond, disagreement in established relationships, negative encounters, repeated antagonistic group scenes and character-initiated topics. No tests run.

### Revision history addition

- 2026-11-24 — M0.5 initial relationship and emotional systems review; findings M0-025–M0-033. Next: M0.6 game mechanics and NPC autonomy. No repository changes.

## M0.6 — Game mechanics and NPC autonomy

Sources: `src/shared/game/social.ts` (socialDue, candidate scoring); `courier.ts` (chanceOfWriting, chanceOfDm, courierRound, sceneEndWriter); `windDown.ts` (SCENE_LENGTHS, windingDown); `prompt.ts` (765–835); `src/shared/i18n/en/scene.json` (prompt.reply.end, prompt.ending.*); `map.ts` (locationOf); `freeTime.ts` (busyWith); `banter.ts` (buildBanterPrompt, readLines); `turns.ts` (packTurns, rewound).

| ID | Finding | Status / priority |
| --- | --- | --- |
| M0-034 | Daily social simulation creates independent experiences and memories before optional LLM embellishment. | Confirmed strength |
| M0-035 | At most one social happening per daily evaluation. | Confirmed; medium, design trade-off |
| M0-036 | Unsolicited courier contact is substantially relationship-driven; post-scene messages also consider mood and recent encounters. | Confirmed; medium |
| M0-037 | Wind-down thresholds are fixed by scene type: ordinary/work 8, society 10, class 12, planned 16 player turns. | Confirmed; high for pacing |
| M0-038 | Maximum primary-character comfort suspends automatic wind-down; other exceptional states also exempt scenes. | Confirmed; medium |
| M0-039 | Answer-seeking turn endings coexist with natural scene closure and later explicit wind-down instructions. | Confirmed wording; high, behavioral impact untested |
| M0-040 | Existing schedules and availability checks supply independent obligations and reasons for departure. | Confirmed strength |
| M0-041 | Expedition banter generates validated NPC dialogue without a player response; possible precedent for optional continuation. | Confirmed strength / opportunity |

### Design implications

- Distinguish ending a turn, ending a topic and ending an encounter. Do not require questions to keep an encounter alive.
- Encourage character-driven topics based on known memories, interests, current events and obligations; avoid inventing consequential off-screen events as facts.
- Consider flexible wind-down based on conversational context while preserving schedule constraints and explicit player exits. Fixed thresholds are soft prompts, not hard context budgets.
- Investigate an optional Continue action that does not fabricate player speech. Preserve explicit player agency, undo semantics, time advancement and scene termination. No implementation approved.
- Courier selection is not solely affection-based: post-scene contact includes desire, appeal, bond, recent encounter and mood, and respects unread messages and unanswered invitations. Daily and post-scene rounds each select at most one writer per evaluation.
- Evaluate spontaneous topics, callbacks, comfortable silence, natural departures, long high-comfort scenes, busy characters, and continuation without invented player input. No tests run.

### Revision history addition

- 2026-11-24 — M0.6 initial autonomy and pacing review; findings M0-034–M0-041. Next: M0.7 character editor and content management. No repository changes.

## M0.7 — Character editor and content management

Sources: `src/renderer/src/ui/editor/ContentEditor.tsx` (283–298, 727–888), `NewCharacterDialog.tsx`; `src/shared/model/loveInterest.ts` (LoveInterestAiSchema), `npc.ts`, `content.ts`; `src/main/content/addons.ts` (235–257, 632–697), `addons.test.ts`, `packs.ts`, `loader.ts`; `src/main/index.ts` (reload, saveAndTidy); `src/shared/game/draftCharacter.ts` (draftSchema, buildDraftPrompt, parseDraft).

| ID | Finding | Status / priority |
| --- | --- | --- |
| M0-042 | Character edits are saved as ID-based JSON overrides and content is reloaded; source-authoring mode differs. | Confirmed strength |
| M0-043 | Existing speech, tone, quirks, knowledge and extraInstructions fields allow character-level prompt experiments without a rebuild. | Confirmed strength; behavioral effect untested |
| M0-044 | Ordinary NPC editor hides examples and secrets although NPCs share the character schema. | Confirmed; medium |
| M0-045 | upToDate merges top-level fields shallowly; existing nested ai objects do not inherit new built-in nested values through this merge. | Confirmed; medium |
| M0-046 | Character saves validate schema and whole-pack references; invalid add-ons can be isolated. Existing tests cover overrides and compatibility. | Confirmed strength |
| M0-047 | Inspected AI strings and arrays lack explicit size bounds. | Confirmed; medium, context impact unmeasured |
| M0-048 | AI drafting uses a separate schema, so new fields require coordinated review. | Confirmed; medium |
| M0-049 | New conversational fields must survive pack export/import and reload. | Derived requirement; medium, not a demonstrated defect |

### Design implications

- First evaluate existing extraInstructions and example dialogue controls with representative characters; do not assume they override universal writing rules.
- Consider optional character-level preferences for talkativeness, narration, initiative and conversational style, with inherited global defaults. Prefer qualitative preferences over rigid quotas.
- Consider exposing example dialogue for ordinary NPCs after verifying prompt inclusion. Conditional secrets need additional dependency review.
- Preserve existing custom characters through schema defaults and explicit nested compatibility tests. Avoid silently overwriting authored values.
- Review drafting, card conversion, pack round-trips, localization and prompt construction before adding fields. Consider prompt-size estimates and warnings rather than arbitrary text caps.
- Evaluate old overrides, new custom characters, ordinary NPCs, save/reload, pack export/import and conflicting instructions. No tests run.

### Revision history addition

- 2026-11-24 — M0.7 initial character editor and content management review; findings M0-042–M0-049. Next: M0.8 image generation and media systems. No repository changes.

## M0.8 — Image generation and media systems

Sources: `src/main/comfy/{studio,client,workflows,downloads,backgroundKey,graph}.ts`, `src/shared/game/{looks,scene,prompt}.ts`, `src/main/content/assets.ts`, `src/main/index.ts`.

| ID | Finding | Status / priority |
|---|---|---|
| M0-050 | Modular external ComfyUI generation backend. | Strength |
| M0-051 | Automatic workflow classification relies on first-frame binding; explicit selection bypasses this filter. | Confirmed; medium |
| M0-052 | Seven standard expressions compress emotional nuance; custom expressions mitigate this. | Confirmed; medium-high |
| M0-053 | Missing neutral or requested sprites can fall back to unrelated expressions. | Confirmed; medium |
| M0-054 | Described custom sprites are offered to the LLM and validated by existing expression logic. | Strength |
| M0-055 | Dialogue and presentation directives share a generation request. | Confirmed; medium; quality impact untested |
| M0-056 | Video generation supports first and optional last images, not established video continuation. | Confirmed frame-oriented design; low |
| M0-057 | Named audio reactions and audio asset serving provide a potential voice-system foundation; full TTS not established. | Opportunity |
| M0-058 | ComfyUI client retrieves only first matching output. | Confirmed; low-medium |
| M0-059 | Cancellation calls unscoped /interrupt before deleting specific queued prompt. | Confirmed call; shared-server effects untested; medium-high |
| M0-060 | Image/video IPC handlers share one abort-controller reference, overwritten by subsequent requests. | Confirmed; medium; renderer concurrency untested |

Design: preserve integrated visual directives initially; test custom expressions (thoughtful, skeptical, amused, worried, irritated, bored, disappointed, confused) with matching art. Warn about missing neutral sprites. Defer workflow capability metadata, video continuation, multi-output gallery and TTS until core conversation work is stable. Test cancellation ownership and shared-server behavior.

## M0.9 — Security, persistence and reliability

Sources: `src/main/index.ts` (window setup, IPC, startup), `src/preload/index.ts`, `src/renderer/index.html`, `src/main/settings/store.ts`, `src/shared/settings.ts`, `src/main/saves/store.ts`, `src/shared/saves.ts`, `src/main/content/{assets,addons,packs}.ts`, `src/main/comfy/{downloads,studio}.ts`, `src/main/ai/queue.ts`.

| ID | Finding | Status / priority |
|---|---|---|
| M0-061 | Context isolation, sandbox, disabled Node integration, CSP and denied new windows. | Strength |
| M0-062 | Privileged IPC surface needs sender, navigation and authorization review beyond schema validation. | Review requirement; medium; no exploit established |
| M0-063 | API keys excluded from ordinary renderer settings; OS-backed encryption when available. | Strength |
| M0-064 | LLM and Civitai credential stores permit plaintext fallback. | Confirmed; high when encryption unavailable |
| M0-065 | Remote LLM and ComfyUI services receive relevant context or images. | Confirmed; medium-high privacy consideration |
| M0-066 | Save writes use temporary-file replacement; unreadable saves listed. | Strength |
| M0-067 | Exact save version schema and direct parse; no explicit migration pipeline in inspected loader. | Confirmed; high before incompatible state changes |
| M0-068 | Settings and character files use direct writes rather than save-style temporary replacement. | Confirmed; medium |
| M0-069 | Source defaults to authoring mode; BREEDHAVEN_ADDONS=1 enables player-style add-ons. | Confirmed; high development consideration |
| M0-070 | Lexical path containment and numbered archive extraction exist; symlink/junction containment not established. | Strength with residual review |
| M0-071 | Download hash verification conditional; existing model check primarily size-based. | Confirmed; medium |
| M0-072 | Credential-bearing Civitai URL derives origin from manifest page without explicit allowlist in inspected function. | Confirmed construction; exploitability unverified; high review priority |
| M0-073 | Memory generation failure can use fallback summary and neutral feelings. | Strength |
| M0-074 | Endpoint FIFO inference queues may delay interactive requests behind background tasks. | Confirmed design; latency unmeasured; medium |

Design: preserve save compatibility with optional fields/defaults; introduce migrations and backups before incompatible changes. Use isolated player-mode development, back up user data, consider atomic JSON writes, credential storage warnings and trusted-origin validation. Measure queue latency before changing scheduling. Review IPC sender/navigation restrictions, filesystem links, download integrity and cancellation ownership. Do not treat static findings as demonstrated exploits.

### Revision history addition

- 2026-11-24 — Combined M0.8 and M0.9 static review, findings M0-050–M0-074. Nine of ten stages initially reviewed. Next: M0.10 consolidated audit and roadmap. No builds, tests, repository edits or commits. Full audio playback, all IPC handlers, dependency vulnerabilities, save/content reconciliation and live integration behavior remain unverified. Proposed features are not approved implementations.


## M0.10 — Consolidated audit and roadmap

M0-001 (repository-level finding): AGENTS.md and CLAUDE.md give conflicting backward-compatibility guidance. Resolve with the owner before implementation; preserve existing saves and add-ons by default as a proposed policy. This supplements the 73 numbered entries M0-002–M0-074 above.

The initial static audit is complete. See ARCHITECTURE.md for subsystem boundaries and IMPROVEMENT_PLAN.md for the proposed sequence, dependencies, evaluation and Codex handoff. Baseline builds/tests remain pending M1. No source modifications, commits or branch creation occurred. Findings are not exhaustive runtime or security validation. Priorities and proposed features require approval.

- 2026-11-24 — M0.10 consolidation completed; architecture and improvement plan drafted.


## Post-audit handoff note — 2026-11-24

All original findings M0-001–M0-074 and their historical wording are retained above. The owner subsequently prioritized F-001 (connection profiles) and Project 2/F-002 (dual-call generation) before M2–M7 NPC work. This supersedes the earlier implementation ordering and M0.8's initial integrated-directive recommendation for Project 2, not the underlying source evidence. BUG-001: player reports scene-transition commands appearing in visible chat; exact syntax, execution outcome and cause remain unverified. Do not mark M0-055 resolved until regression testing supports it. Preserve this register; add dated resolution evidence rather than deleting historical findings. Original uploaded bytes are in audit_archive/CONVERSATION_DESIGN.md. See DECISION_LOG.md, DEVELOPMENT_STATUS.md and both feature designs.
