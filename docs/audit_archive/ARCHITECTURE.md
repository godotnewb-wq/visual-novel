# Application Architecture

**Repository:** godotnewb-wq/rpg-game · main · initial inspected version 0.8.7\
**Date:** 2026-11-24 · **Status:** M0 static audit reference

## 1. Scope and evidence

This document consolidates the M0.1--M0.9 source-review findings recorded in CONVERSATION_DESIGN.md. It describes existing behavior, not an implemented redesign. Paths are relative to the repository; line numbers refer to inspected revisions and may drift. No build, runtime, dependency scan or exhaustive security test has been performed. The repository is GPL-3.0-only according to package.json; review distribution obligations before release.

## 2. System boundaries

Electron hosts a React/TypeScript renderer, a restricted preload bridge and a privileged main process. Zod schemas validate many content, state and IPC inputs. Shared game modules contain deterministic simulation and prompt construction. JSON content packs define characters and world data. External OpenAI-compatible inference endpoints and ComfyUI perform generation.

``` mermaid
flowchart TD
 R[React renderer: App and SceneView] --> P[Preload window.api]
 P --> M[Main process IPC]
 M --> G[Shared game rules and prompt builder]
 G --> C[Content and state]
 M --> L[AI router and endpoint queue]
 L --> E[LLM endpoint]
 M --> V[ComfyUI studio and client]
 V --> W[ComfyUI server]
 M --> S[Save and settings stores]
 M --> A[Content and add-on assets]
 A --> R
 M --> P
 P --> R
```

## 3. Source map

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Area                    Source                                                                                                          Responsibility
  ----------------------- --------------------------------------------------------------------------------------------------------------- ------------------------------------------------------------------
  Application lifecycle   `src/main/index.ts`                                                                                             Window, IPC, content startup, service coordination

  Bridge                  `src/preload/index.ts`                                                                                          Explicit renderer API

  Renderer                `src/renderer/src/App.tsx`, `ui/SceneView.tsx`                                                                  State ownership, input, scene display, response application

  Prompt construction     `src/shared/game/prompt.ts`, `src/shared/i18n/en/scene.json`                                                    Dynamic system instructions, history and localized writing rules

  AI transport            `src/main/ai/{router,openai,queue,tools}.ts`                                                                    Endpoint selection, requests, concurrency and tools

  Scene processing        `src/shared/game/{scene,turns,windDown}.ts`                                                                     Directives, dialogue beats, undo and closure

  Character data          `src/shared/model/{loveInterest,npc,trait}.ts`, `content/default/love-interests/`                               Character identity, speech, traits, assets

  Memory                  `src/shared/game/{memory,facts,codex}.ts`                                                                       Summaries, discoveries and recall

  Relationships           `src/shared/game/{relationships,modifiers,bonds,rapport,drama}.ts`                                              Stages, meters, commitments and social dynamics

  Autonomy                `src/shared/game/{social,courier,map,freeTime,banter}.ts`                                                       Independent events, messages, schedules and banter

  Content management      `src/main/content/{loader,addons,packs,assets}.ts`                                                              Load, validate, override, exchange and serve content

  Editor                  `src/renderer/src/ui/editor/ContentEditor.tsx`, `NewCharacterDialog.tsx`, `src/shared/game/draftCharacter.ts`   Authoring and AI drafting

  Media                   `src/main/comfy/{studio,client,workflows,graph,downloads,backgroundKey}.ts`, `src/shared/game/looks.ts`         Generation, bindings, assets and expressions

  Persistence             `src/main/saves/store.ts`, `src/shared/saves.ts`, `src/main/settings/store.ts`                                  Save slots, validation and settings
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 4. Dialogue request lifecycle

1.  SceneView submits input to App.send (initial inspection around line 890). App records undo information, appends the player message and sets busy state.
2.  The preload bridge invokes IPC.chat. Main validates the request, resolves cast and first speaker, builds the system prompt and reconstructs history with sceneTurns.
3.  The AI router sends the request through the OpenAI-compatible client. The system message combines the game prompt, language instruction and profile instructions. Temperature, output limits and extra parameters come from the selected profile. Endpoint queues limit concurrency; some tool-related failures trigger retry without tools.
4.  Main parses returned directives and validates proposed state/presentation changes. Visible text is separated from hidden tags. dialogueLines interprets newline-delimited beats, speaker names and asterisk-delimited narration.
5.  App applies the response to scene and state, retains the last prompt and presents dialogue. Failure handling can roll back the submitted message. Scene history and hidden tags are replayed on later requests.

### Writing contract

Ordinary responses target 2--4 beats, 25 words per beat and 60 words overall. Lectures target 5--8 beats, 30 words per beat and 180 words overall. These are prompt targets, not hard parser limits. Mostly speech, at most one short action, no invented player speech/actions/feelings, selective group participation. `prompt.reply.end` asks for an answerable ending; `prompt.reply.unknowable` restricts questions to player-known information. The former is a leading hypothesis for habitual question endings, not a proven causal result. Profile instructions are appended globally; dialogue-only customization is not established. Full history replay can grow context and reinforce patterns; no explicit token budgeting was identified in that path.

## 5. Character portrayal

Ordinary NPCs extend the love-interest schema and reuse dialogue infrastructure with restricted mechanics. Character AI fields include speechPattern, tone, verbalQuirks, exampleDialogue and extraInstructions. Traits contribute prompt guidance and simulation modifiers. Primary characters receive richer context than companions; scene extras receive abbreviated descriptions. Group lead selection considers named characters and prior leads, periodically leaving selection to the model. Mood uses the latest relevant happening within two game days. Guarded secrets can be present in the prompt; disclosure instructions and recorded-fact validation do not guarantee absence of visible leakage.

Extension points: localized writing rules, character AI fields, compact companion context and group speaker selection. Preserve player agency and existing NPC category restrictions unless explicitly redesigning them.

## 6. Memory and knowledge

Scene completion generates perspective-specific summaries for eligible witnesses, respecting departure boundaries. Personal and global recall are separately limited (default eight each) and ranked by importance/recency rather than current topic. Ordinary NPC personal memory is intentionally omitted. Summaries target one sentence; long transcripts retain the last 12,000 characters. Structured discovery IDs coexist with free-text memories. Invalid summary JSON can become raw memory text; exceptions can trigger fallback summaries and neutral feelings. Codex keyword matching and budgeting provide an existing relevance-retrieval precedent.

Extension points: summary validation, relevance ranking, early-scene fact preservation and ordinary NPC memory without romance meters. Persistent changes require compatibility review.

## 7. Relationships and autonomous simulation

Retrospective LLM judgments feed deterministic meter changes. Affection-based stages (Dating at 60, Lover at 85) can imply commitments independently of explicit bonds. Skills and other modifiers can amplify gains. Rapport/ties are symmetric; shared scenes can grow ties without dialogue-quality assessment. Drama scoring uses commitments, traits, proximity and availability. Daily social events and courier contact supply independent experiences; contact is substantially relationship-driven. Schedules and obligations already provide reasons to leave. Wind-down thresholds: ordinary/work 8, society 10, class 12, planned 16 player turns; maximum primary comfort and other exceptional states can suspend automatic wind-down. These are soft prompts, not hard context limits. Expedition banter is a precedent for NPC dialogue without fabricated player speech.

## 8. Content and authoring

Character edits use ID-based JSON overrides, schema and pack validation, and content reload. Existing AI fields allow experiments without rebuilding. Ordinary NPC editor exposes fewer controls. Shallow top-level compatibility merging can leave nested AI fields unchanged when built-in defaults evolve. Drafting uses a separate schema; new fields must be reviewed across editor, drafting, card import, pack export/import and localization.

Source mode defaults to authoring and can modify tracked base content. Packaged mode separates player add-ons. For player-style source testing in PowerShell:

``` powershell
$env:BREEDHAVEN_ADDONS = "1"
npm run dev
```

This selects add-on behavior, not an isolated user-data directory. Back up existing user data and use disposable test data before running tests that write state.

## 9. Media

ComfyUI studio resolves API-format workflows, applies bindings and sends jobs to an external server. First-frame binding distinguishes automatic image/video selection; explicitly named workflows bypass that filter. Video supports first and optional last image, separate timeout and cancellation; video continuation is not established. Generated assets use unique filenames. The client retrieves the first matching output and limits download size. Cancellation uses an unscoped interrupt and specific queue deletion; overlapping jobs share one abort reference.

The LLM selects presentation directives in the dialogue request. Seven standard expressions coexist with described custom sprites; validLook validates available custom expressions or standard aliases. Missing assets can fall back to neutral or another available sprite. Named reaction audio and MP3/OGG/WAV serving exist; full TTS is not established. Preserve integrated presentation initially; add custom expressions through content before redesigning the engine.

## 10. Persistence and trust boundaries

Electron userData contains addons/, saves/, settings.json, comfy.json, civitai.json and achievements.json. Saves contain state, scene and optional undo history. Forty manual slots and one autosave use version 1 schema validation and temporary-file replacement. No explicit version migration pipeline was identified. Settings use direct writes and may revert to defaults on invalid data. Save files and custom content should be treated as private data.

Renderer sandbox, context isolation, disabled Node integration, CSP and explicit preload methods are strengths. IPC authorization/sender checks need further review. API keys are excluded from ordinary renderer settings and encrypted with safeStorage when available; plaintext fallback exists. Remote LLM and ComfyUI endpoints receive relevant context or assets. Asset and download path containment is lexical; symlink/junction containment is unverified. Download hashes are optional, existing model checks largely size-based. Credential-bearing download origin validation needs review. These are static observations, not demonstrated exploits.

## 11. Development invariants

Keep deterministic mechanics separate from model prose; validate model directives; preserve player agency, localization, save compatibility, content portability, undo semantics and existing gameplay. Do not introduce new persistent fields without defaults or migrations where required. Preserve existing user-authored values. Reconcile conflicting AGENTS.md and CLAUDE.md compatibility guidance with the owner before changes: the audit recommends preserving released saves and add-ons. Do not commit without approval. See IMPROVEMENT_PLAN.md for sequence and acceptance gates and CONVERSATION_DESIGN.md for individual findings.
