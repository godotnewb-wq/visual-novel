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


## 12. Approved future direction (not current implementation)

F-001 introduces a named profile library and role-to-profile references in settings; main process resolves credentials and snapshots the selected profile at request start. Existing main/nsfw conditional routing remains the baseline. See LLM_CONNECTION_ROADMAP.md.

F-002 (Project 2) separates a turn into Character Writer and Game State Manager calls. Proposed flow: deterministic preflight → writer beats → manager structured proposals → schema/rule validation → one logical commit. Presentation belongs to the manager, not a third call. Existing encounter-completion processing remains separate. See DUAL_CALL_GENERATION_DESIGN.md for the proposed ledger, error handling and integration map. Neither feature has been implemented. BUG-001 is a player report, not a verified parser defect.

The original architecture above is an M0 snapshot; recheck paths and line numbers against the actual checked-out commit. M0-055 describes the old combined request; the earlier recommendation to retain integrated directives initially is superseded for Project 2 only. Existing media behavior must remain compatible. See DECISION_LOG.md and DEVELOPMENT_STATUS.md for approved direction and evidence status.

## 13. Verified F001.1 checkpoint — 2026-11-24

On branch `codex/llm-connection-profiles`, the owner-approved model and pure conversion are implemented but dormant.
`src/shared/llmConnections.ts` reuses current profile parameters/global defaults and adds version 2, UUID identities,
trimmed case-insensitively unique names, and main/optional-NSFW references. Its shared schemas exclude credentials.
`src/main/settings/migrate.ts` adds the main-only stored schema and converter, preserving key bytes and encryption
flags without decryption or writes. The caller supplies migration UUIDs/names; version-2 reloads retain identities.

The existing settings store, fixed-role routing, preload, and renderer still run the earlier architecture. No
startup migration or new profile UI is active. F001.2 requires separate approval for protected backups, atomic
persistence, credential behavior, and IPC. This checkpoint supplements the historical source map; it does not
mark the complete F-001 feature implemented or any historical audit finding automatically resolved.

## 14. Verified F001.2 checkpoint — 2026-11-24

`src/main/settings/connectionStore.ts` now implements the separate version-2 persistence service. It uses
`connectionFiles.ts` for exclusive migration backups and flushed temporary-file replacement, rejects stale disk
snapshots, and publishes memory only after a successful write. Keys remain encrypted in stored records and are
decrypted only by main-only `getProfile`; unreadable keys are retained and reported. New persisted credentials
require encryption; keyless operations work without it. Legacy plaintext cannot be rewritten without encryption.

Shared contracts in `llmConnections.ts` describe safe views, validated CRUD/assignment/preferences, and fixed
result/error codes. The IPC registrar requires sender authorization; the separate preload bridge uses only IPC
constants at runtime. English and Chinese messages are present. None of these factories is called by normal main
or preload startup yet; the original settings/routing/UI path still runs. D-017 defers activation to F001.3.

Tests and real Electron safeStorage/IPC checks passed on disposable data. A settings-only restore could not unlock
the original key until backed-up `Local State` was included, so full user-data/account context is required for
recovery. Unique migration backups preserve original settings bytes but do not replace the full backup. Atomic
replacement is not a cross-process locking protocol or exhaustive crash/storage proof. Unrelated persistence and
IPC trust-boundary findings remain open. See DEVELOPMENT_STATUS.md for precise results.

## 15. Verified F001.3 checkpoint — 2026-11-24

The application now uses ConnectionStore in startup and every LLM consumer. Legacy fixed-format store writes and
IPC were removed; the cipher interface remains in `settings/store.ts`. Main/preload register/expose the version-2
connection namespace, guarded by `settings/trustedSender.ts` for the owning main frame and exact renderer URL.
Startup recovery reports invalid settings without replacing originals. Existing language preference writes use
the same atomic store.

`settings/requestSnapshot.ts` describes a captured pair of role references and parameter/key outcomes. One snapshot
per logical IPC operation survives corrective/tool retries, refusal fallback, summary witnesses, profile edits,
and reassignment/deletion. Locked unused keys are isolated. The router returns both profile UUID and routing role;
the renderer records NSFW takeover by role. Direct-main consumers remain direct-main. Endpoint queues, overrides,
and the original combined scene/directive architecture remain; F-002 has not started.

`ai/connectionDiagnostics.ts` handles unsaved edited discovery/test calls with explicit endpoint/key association;
`ai/redact.ts` protects known credentials in transport errors. Existing forms use `connectionForm.ts` and atomic
role-form saves; shared references stay synchronized. Library UI and gameplay switching remain F001.4/F001.5.
Verification used isolated backup copies and mocked LLM endpoints only; detailed evidence is in DEVELOPMENT_STATUS.

## 16. Verified F001.4 checkpoint — 2026-11-24

`ConnectionManager.tsx` now provides the profile library/editor and main/optional-NSFW selectors in Settings.
`ConnectionProfileFields.tsx` holds the complete existing parameter controls; `connectionLibrary.ts` builds safe
drafts and payloads with omitted/preserved, replaced, or explicitly cleared keys. Existing store and IPC contracts
handle all operations; no new format or routing layer was needed. `connectionForm.ts` retains the safe-result and
assigned-profile helpers, plus the prior role adapter for its retained tests/contracts.

Profile/global-preference saves are independent existing transactions. Duplicate immediately creates a saved,
unassigned keyless copy; Name plus Save preserves identity. Main and renderer protect assigned deletion. Settings
guards dirty navigation via `useConfirm`; App passes generation busy state for assignment controls. Local widgets
remount on selection/Cancel to prevent stale displayed samplers. Discovery/Test remain unsaved and endpoint guarded.

Six integration tests and real rendered-interface/IPC/restart checks passed with disposable data/mocked transport;
desktop/narrow layouts were seen. Live data and archives were untouched. The gameplay switcher remains F001.5;
full gameplay, hosted-provider, and packaged acceptance remain deferred. Historical sections above retain their
original checkpoint boundaries; use the latest section and DEVELOPMENT_STATUS.md for current behavior.

## 17. Verified F001.5 checkpoint — 2026-11-24

`MainConnectionSelector.tsx` reads safe settings on pause-menu mount and persists main assignments through the
existing bridge. App passes foreground/scene and photo busy; pending writes also disable it. The component publishes
only successful assignments and retains the old display on failure, with Retry. Reopening refreshes names and
references edited in Settings. Main/NSFW identity, router snapshots, scene/history/undo state, and backend formats
are unchanged. Labels distinguish assignment from actual routed reply. Runtime IPC/mocked request and restart
checks passed on disposable data; desktop and narrow translated menus were seen. No full-gameplay/packaged/hosted
acceptance or live migration was performed. F001.6 is the next separate approval gate.

## 18. F001.6 acceptance observation

No production architecture changed during final testing. The unsigned Windows directory build matches all source
outputs/resources; an isolated packaged bootstrap loaded the original unchanged ASAR with actual file-origin IPC,
secure storage, renderer, saves, and content. Profile-specific runtime/native gameplay smoke checks passed with
mocked transport. Original release bytes/live data were not modified. See F001_ACCEPTANCE_REPORT.md for limits.

ACC-001 is a baseline defect: App.start (`App.tsx:312`) forwards state/scene but drops SaveData.turns, while Game
(`App.tsx:415`) initializes undo from initial.turns. The first autosave is skipped, delaying the visible loss until
another game/scene update. Actual packaged testing loaded a save with six records; one new reply saved only its
one record. This loader is unchanged from baseline HEAD and unaffected by the profile-switcher integration.
D-022 proposes preserving records for a valid resumed scene and clearing them when that scene is rejected, with
regression coverage. That proposal is not implemented; acceptance and F-002 remain held for the owner decision.

## 19. D-022 verified repair — 2026-11-25

`shared/game/resume.ts` now owns the existing state-reconciliation and scene-cast validation boundary, returning
the saved packed turns only for a valid resumed scene. App.start passes the complete SaveData into this helper.
Game's unpack/pack/rewind implementation and save version are unchanged. The type-only SaveData import avoids
introducing a runtime dependency on saves/schema initialization from the new helper.

Five regressions and the full suite pass; a new Windows build and instrumented packaged native load/switch/send/
history/restart check preserve six original records plus a seventh new record. ACC-001 is resolved, with the
original failure kept in the report. No settings/credential/content/schema migration or live-data write. Final
F-001 acceptance and rollout/F-002 scope remain the owner's decisions.

## 20. Owner acceptance record — 2026-11-25

D-023 accepts F-001, including the D-022 repair, within the documented isolated-data/mocked-endpoint scope.
No architecture/source change accompanies the acceptance record. Testing limits, original failure evidence, and
all 74 findings remain preserved. A separate P2.0 plan/approval is required before F-002 implementation; live rollout,
paid-provider tests, release, commits, and pushes are not authorized by this acceptance.
