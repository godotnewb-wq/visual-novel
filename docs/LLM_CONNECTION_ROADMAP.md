# F-001 — LLM Connection Manager

Historical repository reference: `godotnewb-wq/rpg-game`; local remote: `godotnewb-wq/visual-novel` | Status: F-001 accepted under D-023 within the documented isolated/mock scope (2026-11-25)

## 1. Objective

Save multiple named OpenAI-compatible connections, including different models at the same endpoint, and switch between them without re-entering credentials or losing the current scene. This is the first feature implementation after M1 baseline safeguards and before M2–M7 NPC work. No new provider protocol is required.

## 2. Existing architecture and constraints

`src/shared/settings.ts` currently defines fixed IDs `main` and `nsfw`, a reusable `LlmProfileSchema`, fixed settings/update/view schemas, `ListModelsRequestSchema`, and `pickProfileId()`. The secondary role is conditional scene routing, not necessarily a generic error fallback. Preserve existing routing and inspect `completeWithFallback` and every consumer before changing it. Existing fields include baseUrl, apiKey, model, temperature, maxTokens, timeoutSeconds, instructions, reasoning, reasoningStyle, topP, minP, topK, repetitionPenalty, frequencyPenalty, presencePenalty, providerOrder, providerIgnore, allowFallbacks and maxConcurrent. Language, memoryRecall and newsWebSearch remain global. `allowFallbacks` is provider routing, not a new application fallback chain.

Relevant source entry points: `src/shared/settings.ts`, `src/main/settings/store.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/main/ai/openai.ts`, `src/main/ai/queue.ts`, `src/renderer/src/App.tsx`. Locate actual settings UI, IPC contracts, localization and tests during implementation discovery; do not assume filenames. Audit findings M0-008, 009, 063–069 and 074 are relevant. Source schema was inspected in the feature discussion; full consumer inventory is pending.

## 3. Target design

Use stable opaque profile IDs, display names, a collection of profiles and role assignments (`main`, optional `nsfw`). Reuse existing profile fields and validation. Store keys only in main process; renderer receives hasApiKey. Resolve assigned profiles at request start; keep a snapshot for that request and its retries. Do not change an in-flight request when selection changes. Preserve endpoint-based concurrency semantics. Use atomic settings writes and retain a recoverable pre-migration backup. Never include secrets in logs or exported configurations. D-017 approves refusing new persisted keys when encryption is unavailable while allowing keyless connections; session-only credentials and explicit key reuse are deferred.

Example (conceptual, not a drop-in settings file):

```json
{"settingsVersion":2,"profiles":[{"id":"local-a","name":"Local model A","baseUrl":"http://localhost:11434/v1","model":"model-a"}],"assignments":{"main":"local-a","nsfw":null}}
```

Owner-approved F001.1 contract (D-016): version 2, UUID profile IDs, trimmed names unique without regard to case,
and main/optional-NSFW role references. UUID spelling is normalized to lowercase. Main references an existing
profile even on first run, when that profile may be unconfigured. Optional secondary resolves or is explicitly
null. Preserve existing parameters/global preferences and credential material; no game-save schema change.
The illustrative IDs above describe the concept only; implemented IDs must validate as UUIDs.

## 4. Implementation phases

| Phase | Deliverables | Exit gate |
|---|---|---|
| F001.0 Baseline | M1 branch, backups, exact commit, consumer inventory, existing tests/build | Baseline recorded; owner resolves conflicting repository guidance |
| F001.1 Data model | Dynamic IDs, named profiles, assignments, validation, pure legacy conversion | Fixture conversion preserves data and repeat loading is idempotent |
| F001.2 Persistence and IPC | Separate store, atomic writes, credential handling, safe views, CRUD and assignment IPC | Standalone persistence/IPC verified; keys stay private, failures preserve settings; no application startup activation |
| F001.3 Activation and routing | Activate store/IPC after updating all fixed-profile consumers; resolve roles, snapshots, model discovery and connection tests | Reviewed rollout preserves routing and parameters; migration protected; selected profile supplies correct parameters |
| F001.4 Settings UI | List, create, edit, rename, duplicate, delete, test, fetch models, assign roles | All operations usable without source edits; localized labels |
| F001.5 Gameplay switcher | Compact main-profile selector, current assignment display, busy-state handling | Next request uses selected profile; scene/history/state unchanged |
| F001.6 Verification | Unit, integration, manual and packaged Windows regression checks | Acceptance matrix passes; known limitations documented; owner sign-off |

### Migration and CRUD rules

- Convert legacy main and configured secondary to named profiles, preserve every sampler, instruction, credential and global preference. Retain an unconfigured secondary draft if it contains user-entered values; do not activate it unless valid. Preserve first-run behavior.
- Validate before writing; migration failure leaves original intact and reports a recoverable error. Backups containing secrets require same protection as settings. Do not overwrite a valid backup with failed migration output.
- Rename preserves ID. D-017 approves duplication of nonsecret settings only; explicit credential reuse is deferred. Omitted key keeps existing key; explicit clear removes it.
- Block deletion of assigned profiles until reassigned or secondary unset. Validate unique IDs and valid references. Define duplicate-name behavior (recommend allow with clear disambiguation or require unique names).
- Fetch models and test connection against the edited profile, including unsaved endpoint/key overrides, without changing active assignments. Redact errors and avoid accidental generation charges; disclose if test requires completion.
- Quick switching persists immediately on success, shows failure without changing displayed active selection, and does not reset conversation. Disable switching during generation initially for predictable behavior. Label main vs actual routed role accurately.

## 5. Acceptance and regression matrix

| Scenario | Expected result |
|---|---|
| Legacy main only / both roles / empty settings | Correct migration, no lost values, original recoverable |
| Restart after migration or profile edit | Profiles, assignments and global settings retained |
| Two models on one endpoint | Distinct model and sampler values sent correctly |
| Two endpoints with different keys | Correct credentials sent only to intended endpoint |
| Rename / duplicate / delete | Stable references, no unintended credential copy, assigned deletion blocked |
| Secondary configured / unset | Existing conditional routing and fallback behavior preserved |
| Test inactive or unsaved profile | Correct endpoint/key; active assignments unchanged |
| Switch during active scene | Next eligible request uses new profile; history, state and undo preserved |
| Busy request / timeout / cancellation | No cross-profile cancellation or mid-request reassignment |
| Background jobs, summaries, tools and retries | Existing routing semantics and endpoint concurrency preserved |
| Invalid settings / failed write / unavailable encryption | Actionable error, no silent loss or new plaintext downgrade |
| Renderer settings, logs and diagnostics | No stored API keys exposed |
| Existing saves, add-ons and packaged build | No regressions attributable to feature |

Use mocked endpoints for automated routing/credential assertions; manual smoke tests with local and hosted endpoints only with owner-approved credentials and costs. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and packaged `npm run build:win` at appropriate gates. Record baseline failures separately. No real keys in fixtures. Check all supported locales for missing keys.

## 6. Out of scope and later work

Profile import/export (secret-free by default), per-task model assignments, generalized fallback chains, shared credential vault, new API protocols and NPC prompt changes are deferred. Do not bundle unrelated security refactors; fix credential/persistence issues directly implicated by this feature. No arbitrary profile-count cap proposed.

## 7. Codex handoff

Read `ARCHITECTURE.md`, `IMPROVEMENT_PLAN.md`, `CONVERSATION_DESIGN.md`, this roadmap and repository guidance. Verify current source and branch. Start with F001.0 only; report baseline and exact affected files before implementation. Work in small reviewable changes, preserve compatibility, do not commit or push without authorization. At each gate report changes, tests, failures, risks and remaining work. After F001.6 and owner approval, begin Project 2 (F-002), following `DUAL_CALL_GENERATION_DESIGN.md`. Resume M2 only after Project 2 verification and approval.

Owner acceptance is recorded under D-023. Open decisions: separately approved rollout/next-feature scope. ACC-001 is repaired and rechecked under D-022. Activation and consumer integration are approved under
D-018; the management UI is implemented under D-019 and gameplay switching under D-020. Explicit credential reuse and session-only credentials are deferred. Version 2, UUIDs,
and unique trimmed/case-insensitive names were approved under D-016. This roadmap
originally performed no implementation; the F001.1 update below records subsequent local work.


## 8. Project 2 integration boundary

Stable profile IDs and a validated resolver are the interface for the future writer and manager assignments. Do not implement dual-call orchestration, role-specific writer/manager settings or general task routing in F-001. Keep the existing main/nsfw roles and fallback behavior until their actual semantics are verified. F-002 will extend assignments in its own reviewed change. Test deletion/reference integrity and snapshot behavior now so the later feature can reuse them. See CODEX_HANDOFF.md and DEVELOPMENT_STATUS.md for the current gate.

## 9. F001.1 checkpoint — 2026-11-24

`src/shared/llmConnections.ts` implements the credential-free model. `src/main/settings/migrate.ts` owns stored
credential fields and the pure converter. Existing ciphertext and its encrypted flag are copied unchanged; no
cipher, filesystem, network, UUID generator, or global localization state is needed by conversion. The caller
provides UUIDs and localized initial names. Unknown fields fail validation to avoid silently losing authored data.
Meaningful incomplete secondary drafts are retained, while unchanged empty defaults produce only a main profile.

Version-2 reloads validate without replacing IDs or names. Forty-six focused tests, typecheck, and the full suite
(1,151 passed, one skipped) pass; production build succeeds. Existing settings consumers and on-disk data are
unchanged at that checkpoint. D-017 subsequently approved F001.2 as recorded below. See DEVELOPMENT_STATUS.md
for current evidence and limitations.

## 10. F001.2 checkpoint — 2026-11-24

The separate `ConnectionStore`, atomic file helper, IPC registrar, and typed preload bridge are implemented and
tested. No app startup or existing consumer uses them yet. D-017 explicitly moves startup activation to F001.3,
when routing, response metadata, settings UI adapters, and other consumers can be updated together. Avoid two
writers with different formats on the same settings file.

Before migration, preserve exact original bytes in a unique exclusive same-directory backup. Write/flush/close
an exclusive temporary file, reject stale source bytes, then rename and publish memory. New keys require a cipher;
existing encrypted keys are retained without unnecessary decryption. Plaintext migration without encryption stops
with the original intact. Duplicate copies omit keys. Safe views contain `hasApiKey` and encryption availability;
IPC rejects unauthorized senders/invalid data and returns fixed localized errors. The registrar's caller must
authorize the owning window/main frame and trusted app URL at activation.

Validation: 32 new tests; typecheck and build passed; full suite 1,183 passed and one skipped. Real Electron secure
storage/hidden IPC windows passed migration, credentials, CRUD, authorization, and reload checks on disposable data.
Restoring encrypted settings needed the backed-up `Local State` as well. Full backups, live data, archived originals,
and all 74 findings are preserved. F001.3 requires its own plan/approval; no automatic rollout is authorized.

## 11. F001.3 checkpoint — 2026-11-24

D-018 approves and implements source startup activation, all consumer integration, snapshots, diagnostics, and
adaptation of existing forms. The old writer/IPC paths are gone. Startup migrates legacy settings with an exact
protected backup; corrupt input is retained with a recoverable error. Live data was not launched or migrated.

Each logical operation captures both roles and their UUIDs/parameters/credential outcomes, recall/news preferences,
and language instruction. Corrective retries, fallback, and summary batches reuse the snapshot. Unused locked keys
do not block the selected connection. Router responses distinguish UUID from main/nsfw role; App uses the latter
to keep scene routing. All original main-only/routed paths, overrides, and endpoint concurrency remain.

The two existing forms edit assigned profiles and save atomically through the new namespace. Unassigned drafts are
preserved for the F001.4 manager. Unsaved discovery/tests never save; changed endpoints require re-entered/cleared
keys. Test sends a direct capped completion and discloses potential charges. New IPC validates ownership/frame/URL.

Validation: 134 test files passed, 1,198 tests passed, one skipped; typecheck/build pass. Real app integration used
only isolated data and a mocked transport, verifying startup/backup, mid-request edits/fallback, cancellation,
metadata, diagnostics, language, save readability, restart idempotence, and corrupt-file recovery. The updated form
was visually checked in a mocked component preview. Full gameplay/hosted-provider/packaged acceptance is deferred.
F001.4 management UI requires its own plan and approval; F001.5 is still the gameplay switcher.

## 12. F001.4 checkpoint — 2026-11-24

D-019 implements Settings' named-profile library and single editor, including unassigned migrated drafts, all
parameters, creation/renaming/duplication/deletion, role assignment, unsaved tests, and refreshed model discovery.
Rename is Name plus Save. Duplication immediately saves a uniquely named unassigned copy without credentials.
Profile and global preferences use independent Save/Cancel transactions. Discard confirmations guard navigation;
assigned deletion stays blocked, and role selectors are disabled during scene generation. Failed writes retain
drafts and persisted selections. Optional-number/model widgets reset on editor selection/Cancel. Existing secure
key behavior, endpoint association, role routing, request snapshots, and settings format are unchanged.

Typecheck/build passed; 1,204 tests passed and one skipped across 135 files. Real rendered UI/IPC tests, desktop
and narrow visual checks, localization/draft checks, and whole-app restart checks passed on disposable data with
mocked LLM transport. Full gameplay, hosted providers, and packaged acceptance remain deferred. Live data, original
backups, archived audit bytes, and all 74 findings are preserved. F001.5 requires a new plan and approval.

## 13. F001.5 checkpoint — 2026-11-24

D-020 implements the compact Main LLM selector in the gameplay pause menu. Safe profiles and assignment refresh
when the menu opens; switching uses existing atomic assignment IPC. Pending writes retain the persisted display,
disable the control, and publish only on success. Failures retain the selection and offer Retry. Scene/foreground
and photo busy disable switching. The label denotes the main assignment; NSFW routing and in-flight snapshots
remain unchanged. No scene/history/undo/state callback is involved and no storage/routing/schema change was needed.

Typecheck/build and the existing 1,204 tests passed, with one skipped. Real selector/Settings UI and IPC checks,
mocked next-chat model/key/sampler/role assertions, NSFW/busy/failure cases, save hashes, desktop/narrow translated
visual checks, and full restart persistence passed on disposable data. Full gameplay, hosted endpoints, and
packaged Windows acceptance remain F001.6 decisions. All protected data/archives and 74 findings are preserved.

## 14. F001.6 checkpoint

D-021 final testing passed typecheck, 1,204 tests/one skipped, production/Windows directory build, and isolated
instrumented packaged profile/runtime checks. Native gameplay loaded a real save, switched main without changing
the autosave, sent a mocked reply using the selected model/key/sampler, and exercised busy controls. Packaged
restart/recovery/authorization/timeout checks passed. The unchanged original executable/ASAR and all built/content
resources were verified; no live data or archived evidence changed. No paid calls, commits, or pushes.

Unqualified acceptance is held: ACC-001 exposes an unchanged baseline App.start omission of saved undo records.
After loading six records and sending a new reply, only one was saved instead of seven. This was not caused by
switching. F001_ACCEPTANCE_REPORT.md preserves the failed assertion and proposes D-022's narrow repair, pending
owner approval. Do not mark F-001 fully accepted or begin F-002 before that decision and final sign-off.

## 15. D-022 resolution checkpoint — 2026-11-25

Owner-approved undo repair now forwards saved turns through App's load-to-session boundary, preserving records
for a valid resumed scene and clearing records belonging to a rejected/absent scene. Five regressions pass;
typecheck/full suite (1,209 passed, one skipped) and production/Windows build pass. Fresh instrumented packaged
native UI repeated load/switch/send: six original records stay unchanged and a seventh is saved, older history
is usable, and seven records persist across restart. Settings and credential checks remain intact. ACC-001 is
resolved; original failure evidence stays in F001_ACCEPTANCE_REPORT.md. F-001 awaits final owner acceptance;
live rollout, paid-provider testing, F-002, commits, and pushes remain separate decisions.

## 16. Owner acceptance checkpoint — 2026-11-25

D-023 accepts F-001 within the documented isolated-data/mocked-endpoint scope and closes F001.6, including the
verified ACC-001 repair. Historical checkpoints and acceptance limits remain intact. Live rollout, paid-provider
testing, release, commits/pushes, and F-002 implementation require separate authorization. Next: review a P2.0 plan.
