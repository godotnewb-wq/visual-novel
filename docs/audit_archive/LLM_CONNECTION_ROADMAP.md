# F-001 — LLM Connection Manager

Repository: `godotnewb-wq/rpg-game` | Status: approved feature priority; implementation pending

## 1. Objective

Save multiple named OpenAI-compatible connections, including different models at the same endpoint, and switch between them without re-entering credentials or losing the current scene. This is the first feature implementation after M1 baseline safeguards and before M2–M7 NPC work. No new provider protocol is required.

## 2. Existing architecture and constraints

`src/shared/settings.ts` currently defines fixed IDs `main` and `nsfw`, a reusable `LlmProfileSchema`, fixed settings/update/view schemas, `ListModelsRequestSchema`, and `pickProfileId()`. The secondary role is conditional scene routing, not necessarily a generic error fallback. Preserve existing routing and inspect `completeWithFallback` and every consumer before changing it. Existing fields include baseUrl, apiKey, model, temperature, maxTokens, timeoutSeconds, instructions, reasoning, reasoningStyle, topP, minP, topK, repetitionPenalty, frequencyPenalty, presencePenalty, providerOrder, providerIgnore, allowFallbacks and maxConcurrent. Language, memoryRecall and newsWebSearch remain global. `allowFallbacks` is provider routing, not a new application fallback chain.

Relevant source entry points: `src/shared/settings.ts`, `src/main/settings/store.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/main/ai/openai.ts`, `src/main/ai/queue.ts`, `src/renderer/src/App.tsx`. Locate actual settings UI, IPC contracts, localization and tests during implementation discovery; do not assume filenames. Audit findings M0-008, 009, 063–069 and 074 are relevant. Source schema was inspected in the feature discussion; full consumer inventory is pending.

## 3. Target design

Use stable opaque profile IDs, display names, a collection of profiles and role assignments (`main`, optional `nsfw`). Reuse existing profile fields and validation. Store keys only in main process; renderer receives hasApiKey. Resolve assigned profiles at request start; keep a snapshot for that request and its retries. Do not change an in-flight request when selection changes. Preserve endpoint-based concurrency semantics. Use atomic settings writes and retain a recoverable pre-migration backup. Never include secrets in logs or exported configurations. Warn when secure encryption is unavailable; do not silently downgrade new credentials to plaintext. Decide session-only behavior with owner before implementation.

Example (conceptual, not a drop-in settings file):

```json
{"settingsVersion":2,"profiles":[{"id":"local-a","name":"Local model A","baseUrl":"http://localhost:11434/v1","model":"model-a"}],"assignments":{"main":"local-a","nsfw":null}}
```

Schema version and ID format are proposals. Main must reference an existing profile when configured; allow a first-run unconfigured profile. Optional secondary must resolve or be explicitly unset. Preserve all existing settings and routing semantics. No game-save schema changes intended.

## 4. Implementation phases

| Phase | Deliverables | Exit gate |
|---|---|---|
| F001.0 Baseline | M1 branch, backups, exact commit, consumer inventory, existing tests/build | Baseline recorded; owner resolves conflicting repository guidance |
| F001.1 Data model | Dynamic IDs, named profiles, assignments, validation, legacy migration | Existing settings migrate without loss; repeat load is idempotent |
| F001.2 Persistence and IPC | Atomic writes, credential handling, safe views, CRUD and assignment operations | Keys remain private; failures preserve previous settings |
| F001.3 Routing | Resolve roles to profiles, update all request paths, model discovery and connection tests | Existing routing preserved; selected profile supplies correct parameters |
| F001.4 Settings UI | List, create, edit, rename, duplicate, delete, test, fetch models, assign roles | All operations usable without source edits; localized labels |
| F001.5 Gameplay switcher | Compact main-profile selector, current assignment display, busy-state handling | Next request uses selected profile; scene/history/state unchanged |
| F001.6 Verification | Unit, integration, manual and packaged Windows regression checks | Acceptance matrix passes; known limitations documented; owner sign-off |

### Migration and CRUD rules

- Convert legacy main and configured secondary to named profiles, preserve every sampler, instruction, credential and global preference. Retain an unconfigured secondary draft if it contains user-entered values; do not activate it unless valid. Preserve first-run behavior.
- Validate before writing; migration failure leaves original intact and reports a recoverable error. Backups containing secrets require same protection as settings. Do not overwrite a valid backup with failed migration output.
- Rename preserves ID. Duplicate copies nonsecret settings by default; user may explicitly reuse a saved credential through a main-process operation if approved. Omitted key keeps existing key; explicit clear removes it.
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

Read `ARCHITECTURE.md`, `IMPROVEMENT_PLAN.md`, `CONVERSATION_DESIGN.md`, this roadmap and repository guidance. Verify current source and branch. Start with F001.0 only; report baseline and exact affected files before implementation. Work in small reviewable changes, preserve compatibility, do not commit or push without authorization. At each gate report changes, tests, failures, risks and remaining work. After F001.6 and owner approval, resume M2 NPC dialogue work using saved profiles for controlled comparisons.

Open design decisions: duplicate-name policy, explicit credential reuse, encryption-unavailable UX, exact settings UI placement, and final schema version. These are not blockers for baseline discovery. No implementation, tests or repository changes performed by this roadmap.
