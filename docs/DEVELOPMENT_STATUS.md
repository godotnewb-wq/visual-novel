# Development status

Current gate: F-001 accepted (D-023, 2026-11-25) within the documented isolated-data/mocked-endpoint scope. ACC-001 is resolved. F-002 planning now records six owner-confirmed product choices (D-024); the comprehensive proposal is in DUAL_CALL_GENERATION_DESIGN.md sections 13–17. Next gate: review the detailed plan and separately authorize P2.0 execution; no live rollout or F-002 implementation authorized.

| Stage | Status | Next evidence |
|---|---|---|
| M0.1–M0.10 | Complete (static review only) | Preserve 74 findings; verify source drift as needed |
| M1/F001.0 | Preparation verified; owner approved proceeding to F001.1 | Dialogue evaluation remains deferred; no paid calls authorized |
| F001.1 | Implemented and tested; owner approved proceeding to F001.2 | Retain validated model/converter and fixtures |
| F001.2 | Implemented and tested; owner approved proceeding to F001.3 | Preserve storage/IPC tests and backup policy |
| F001.3 | Implemented and tested; owner approved proceeding to F001.4 | Retain activation/routing evidence |
| F001.4 | Implemented and tested; owner approved proceeding to F001.5 | Retain management-interface evidence |
| F001.5 | Implemented and tested; owner approved F001.6 | Retain gameplay-selector evidence |
| F001.6 | Complete; owner accepted documented isolated/mock scope (D-023) | Preserve evidence/limits; no live rollout authorized |
| P2.0–P2.6 (F-002) | Planning in progress; six product choices confirmed under D-024; implementation not started | Review DUAL_CALL_GENERATION_DESIGN.md sections 13–17; separate P2.0 execution approval |
| M2–M7 | Deferred | Re-baseline after F-002; individual gates |
| R reliability/security | Pending, risk-based | Gates in IMPROVEMENT_PLAN.md |

## Immediate checklist

- [x] Record local repository, source revision, branch, remote, and known working tree; see evidence below.
- [x] Read AGENTS.md and CLAUDE.md; owner resolved compatibility policy; identical rules are in both files (D-014).
- [x] Obtain owner approval and create `codex/llm-connection-profiles` without committing or discarding existing changes.
- [x] Verify userData, backup integrity, restoration, and actual runtime isolation before feature work.
- [x] Verify package scripts and Node/npm versions; owner reported successful `npm ci`; typecheck, full tests, and production build verified locally. Windows build and instrumented isolated packaged acceptance are now verified; see F001_ACCEPTANCE_REPORT.md.
- [x] Inventory profile consumers, IPC, credentials, routing, model discovery, UI, localization, and tests; see inventory below and the F001.0 chat report.
- [ ] Capture baseline dialogue and directive fixtures without secrets; no paid API calls without approval.
- [x] Present the F001.1 plan in the F001.0 chat report.
- [x] Obtain approval of F001.1 contract and implementation (D-016).
- [x] Obtain separate F001.2 scope/implementation approval (D-017).
- [x] Obtain F001.3 activation/consumer-integration approval (D-018).
- [x] Review F001.3 evidence and obtain F001.4 management-UI approval (D-019).
- [x] Review F001.4 evidence and obtain F001.5 gameplay-switcher approval (D-020).
- [x] Review F001.5 evidence and approve F001.6 final-acceptance scope (D-021).
- [x] Approve/implement/recheck D-022; resolve ACC-001 without changing the save format or live data.
- [x] Obtain final owner acceptance for F-001 in the documented isolated/mock scope (D-023).
- [ ] Separately scope and approve F-002/P2.0; keep live rollout/paid tests/commits/pushes separately authorized.

## Verified repository and baseline

- Workspace: repository root; source commit `c804387d9660f0ea055d9ea7326004aa43ee8ee3` ("social web pt 2").
- Remote: `https://github.com/godotnewb-wq/visual-novel.git`, differing from historical `rpg-game` references. No network synchronization was performed.
- Branch: `codex/llm-connection-profiles`, created from local `main` with owner approval. No commits or pushes.
- Version: package `0.8.7`; lockfile root still says `0.8.2`, but dependency declarations match. Node `v24.19.0`, npm `11.17.0`.
- Working tree already included approved AGENTS.md/CLAUDE.md policy changes, untracked handoff documents, and `package.json`'s `allowScripts` entries for esbuild. These were retained; preparation adds only the isolated-launch script to that manifest.
- Owner-reported pre-change baseline: `npm ci`, typecheck, and build successful; 122 test files passed, 1,100 tests passed, one skipped.
- Verified preparation: typecheck passes; 123 test files pass, 1,105 tests pass, one skipped; production build succeeds. Five new tests cover default/packaged behavior, invalid paths, live-directory overlap, separate data, and junction/symlink redirection.
- Tests use loopback mock servers; sandbox-only runs previously failed with `EACCES`. The complete suite passes with loopback access.
- The Electron npm package initially lacked its executable. Ran the locked package's `node node_modules/electron/install.js`; Electron `44.5.1` then launched successfully. Existing install-script permissions were not broadened.
- Build warnings concern dependency PURE annotations and Phaser's mixed static/dynamic imports. No fixes were bundled.

## Backups and isolated runtime

Live data uses the application's default `%APPDATA%\breedhaven-dating-sim` directory.
Complete user-data and documentation backups were kept outside the repository. Initial SHA-256 comparisons
verified every backed-up file with no missing or extra files. Detailed local inventories and manifests remain
in the Git-ignored verification area. Later working-document updates intentionally differ from the historical
documentation backup; the backup itself is unchanged.

Restored all user-data files into Git-ignored `.dev-data/user-data/`; initial restored hashes
matched the backup. All backed-up saved slots parsed and loaded through SaveStore and the running app's IPC. Settings
parsed, a temporary memory-recall edit was written/read/restored through IPC, and both profile credentials matched
their backed-up values after decryption. safeStorage encryption was available; no keys appeared in renderer views
or diagnostic output. No model discovery, generation, or paid requests were made.

`npm run dev:isolated` uses `.dev-data/user-data/`. Source runs can set the absolute `BREEDHAVEN_USER_DATA_DIR`
override. Before readiness, main sets both Electron `userData` and `sessionData` to that directory, and isolated
runs always use player add-on mode. Overlap with the live data tree, including through existing filesystem links,
is rejected; packaged builds ignore the override. Ordinary `npm run dev` keeps its original authoring behavior.

Actual runtime checks confirmed `userData`, `sessionData`, Chromium's storagePath, and the editor add-on directory
all used the restored tree. A localStorage marker exercised browser persistence. The app window was seen at the
age gate, which was not submitted; gameplay was not exercised. The isolated app was closed, and all live-data and
backup file hashes still matched their pre-launch manifests. The temporary inspector was loopback-only and closed
with the app. Standalone save/media scripts retain their original paths and do not honor this override.

A restored historical custom add-on produced a pre-existing validation warning; this was not a preparation
regression. Its current version was subsequently corrected and revalidated. The historical backup and disposable
restoration were not refreshed for that correction. Identifying add-on details remain only in local evidence.

## Confirmed F-001 baseline consumer inventory (before activation)

- `src/shared/settings.ts`: fixed main/nsfw IDs, profile/schema/update/view, configuration check, role selection; `src/shared/game/memory.ts` imports the global recall default.
- `src/main/settings/store.ts`: direct JSON writes, privileged keys, optional cipher/plaintext fallback, unreadable-data defaults, language persistence. Schema and store tests pin these behaviors.
- `src/main/ai/{router,openai,queue}.ts`: scene-role/refusal routing, transport/tool retries, profile-wide instructions, parameter overrides, endpoint queues; tests cover existing behavior. Refusal classification and tools are dependencies, not a new provider protocol.
- `src/main/index.ts` direct main calls: character/card drafting, major drafting, events, feed captions, web-search news. Routed calls: chat and corrective regeneration, courier, ordinary news, happenings, scene photos, selfies, outing plans, banter, moment/group lines, course picks, spending, and per-witness summaries.
- `src/shared/{ipc,types}.ts`, preload, and main handlers: settings CRUD boundary, model discovery, connection tests, and chat response identity. Connection tests currently save both forms before a completion; model discovery uses edited URLs with saved keys when omitted.
- `SettingsPanel.tsx`, `ModelField.tsx`, `modelName.ts`, `SceneView.tsx`, `PhonePanel.tsx`, `App.tsx`: fixed forms, endpoint discovery, predicted model names, busy state, and `response.profileId === 'nsfw'` scene routing. Dynamic profile identity must be distinct from routing role.
- Localization: global language API plus English namespaces and `content/zh-CN/strings`. Recall and news preferences remain global. No save-format change is planned for F-001.
- Preserve drafting/lecture/event/feed token floors, drafting timeouts, summary temperatures, and the news `:online` variant. Ordinary network/account errors do not invoke refusal fallback; OpenRouter `allowFallbacks` is a separate setting.
- Current content preparation includes `personalise`, `withSkinTone`, `withCanon`, and `withHousing`. Historical audit line references lack an exact original commit, so an exhaustive revision diff is unavailable.

## F001.1 implementation and verification

Approved by D-016 on 2026-11-24. Four source/test files were added:

- `src/shared/llmConnections.ts`: credential-free version-2 model reusing current parameters/global defaults; normalized UUIDs, trimmed names, case-insensitive name uniqueness, unique IDs, nonempty collection, and valid role references. First-run main may be unconfigured; secondary is an explicit reference or null.
- `src/main/settings/migrate.ts`: strict main-only stored schemas and a pure `migrateConnectionSettings(raw, identities)` converter. The caller supplies UUIDs and localized names. Legacy profile values and credential bytes/encryption flags are preserved; secondary drafts with nondefault values are kept but not assigned until configured. Re-reading version 2 preserves identities, names, and references.
- `src/shared/llmConnections.test.ts` and `src/main/settings/migrate.test.ts`: 46 focused tests for defaults, full parameter/global preservation, opaque encrypted keys, plaintext legacy keys, incomplete drafts, zero/false values, invalid/unknown data, identity/reference errors, idempotent JSON reloads, and input immutability.

No existing runtime entry point imports the new modules. The original `src/shared/settings.ts`, settings store,
preload/IPC contracts, routing, renderer, and save format are unchanged. No data was migrated on disk and no new
credential persistence policy was selected. Unknown fields and unsupported versions fail validation explicitly
instead of being silently discarded. F001.2 must handle such failures without overwriting originals.

Verification: typecheck passed; focused tests 46 passed; full suite 125 files passed, 1,151 tests passed, one skipped;
production build succeeded with the same dependency warnings. No new UI or runtime migration was exercised because
neither is connected yet. SHA-256 manifests taken at the start/end of this phase confirm live data, both backup
folders, and all archive files stayed unchanged; archive checksums match and all 74 audit IDs remain. No commits,
pushes, paid requests, or content edits. The live data baseline includes the owner's intervening age correction.

## Open issues and evidence gaps

BUG-001 remains unreproduced; exact raw output, display, and state result are unknown. Reproduce by P2.0. The reported
question-ending rate remains unmeasured. No paid dialogue baseline was captured. Full gameplay, packaged Windows
behavior, dependency vulnerabilities, exhaustive IPC/security, media cancellation, and save/content reconciliation
remain unverified beyond the specific restoration/isolation checks above. Do not treat this as a new full audit.

F001.3's activation/integration is approved by D-018 and verified below on isolated data only. The code now starts
with version-2 settings; live user data has not been launched or migrated in this workflow. Continue feature testing
with `npm run dev:isolated`. Old application binaries cannot be assumed to understand version-2 settings. Full
profile management UI, gameplay switching, hosted-provider behavior/cost, and packaged Windows acceptance remain
later gates. Explicit key reuse/session-only credentials and broader unrelated IPC authorization remain deferred.

## F001.2 implementation and verification

Approved by D-017 on 2026-11-24. The new service remains separate from application startup:

- `src/main/settings/connectionStore.ts`: first-run version-2 persistence; strict migration/reload; profile create/edit/rename/duplicate/delete, role assignment, and global preferences; main-only credential resolution; detached safe views. Duplicates never copy keys, and assigned profiles cannot be deleted.
- `connectionFiles.ts`: exclusive 0600 backup/temp creation (POSIX mode; Windows inherits parent ACLs), write/flush/close, then same-directory rename. Failed writes preserve memory and the original file. Unique migration backups are exact originals and never overwritten. Incomplete temporary writes are cleaned up where possible.
- Before replacing a file, compare its bytes with the loaded snapshot. A stale store reports `settings-changed`; this protects sequential external edits but is not a cross-process locking protocol.
- Existing encrypted credentials remain intact if unavailable; resolving them fails explicitly instead of clearing them. New keys require encryption. Plaintext legacy migration and any write retaining plaintext require an available cipher, otherwise the original remains untouched. Keyless connections work without a cipher; explicit empty keys clear, omissions preserve.
- `connectionIpc.ts`, `connectionErrors.ts`, additions to `src/shared/llmConnections.ts` and `ipc.ts`, and `src/preload/connections.ts`: validated typed operations and replies, safe `hasApiKey`/encryption status, fixed localized error codes/messages, required sender authorization. Partial edits remove schema defaults so omitted fields do not reset. The bridge factory and registrar are not called by the normal app/preload.
- English and Simplified Chinese error messages were added. No character, gameplay, router, save-schema, or existing settings-store behavior changed.

Thirty-two new tests cover real temp-file persistence/reloads; exact backups; legacy plaintext/encrypted migration;
missing encryption and failed decryption; immutable views/snapshots; omitted fields/keys and explicit clears;
duplicate/assignment/reference rules; malformed input; backup failure; partial write/open/flush/close/rename errors;
stale writers; preservation on retries; exclusive backup collision; and typed bridge/sender/error-redaction checks.
Typecheck passed; full suite 128 files passed, 1,183 tests passed, one skipped; production build succeeded with the
same dependency warnings.

A separate Electron test used copied settings plus backed-up `Local State`, real safeStorage, and hidden sandboxed,
context-isolated windows with the new preload bridge. It verified exact migration backup, decrypted key preservation,
all CRUD/preference/assignment operations, safe views, refusal to delete assigned profiles, malformed-input errors,
no duplicated keys, rejection of an unowned window, and reloading. All checks passed. A settings-only restore failed
to decrypt before `Local State` was included; retain full user-data backups for credential recovery. Migration
backups contain original settings only and remain dependent on their original OS/account/encryption context.

This verifies the standalone service/IPC, not game startup migration or a new profile UI. Protected live data,
both original backup folders, and the audit archive stayed byte-identical during this phase. All 74 findings remain.
No live migration, paid requests, commits, or pushes. Activation remains explicitly deferred to F001.3.

## F001.3 implementation and verification

Approved by D-018 on 2026-11-24. `src/main/index.ts` now constructs ConnectionStore with recovery handling, uses
version-2 preference writes, and registers the new store/diagnostics IPC with owning-window/main-frame/exact-app-URL
authorization (hash navigation allowed). Corrupt settings stop startup with a fixed recoverable error; originals
are kept. `src/preload/index.ts` exposes the typed `connections` namespace. The old fixed-format IPC/writer was
removed; `settings/store.ts` contains only KeyCipher. Required legacy conversion schemas remain for migration.

Every chat/corrective retry, summary/spending batch, courier, news/search fallback, feed, drafting, event, photo,
selfie, outing, banter, moment/group, and course-selection path uses a captured connection snapshot. Main-only
paths remain main-only; normal/NSFW/refusal routing and non-refusal error behavior are preserved. Existing token
floors, summary temperatures, news suffix, tools, and endpoint queues remain. Transport copies parameters for tool
rounds and redacts known credentials from errors. A locked unused connection does not prevent a working selected
role. Snapshots retain role UUIDs, credentials or credential errors, parameters, recall/news preferences, and the
language instruction. New operations see later edits. ChatResponse includes `profileId` plus `profileRole`, and
App's persistent NSFW routing uses `profileRole`.

The existing settings role forms map assignment UUIDs to editable parameters; one `saveRoles` transaction writes
both forms/preferences. Shared-profile forms stay synchronized; stale assignments/conflicting shared edits fail.
A secondary can be created from the existing optional form, and unconfigured secondary references still fall back
to main. Unassigned library profiles, including migrated incomplete drafts, remain preserved for F001.4's manager
and are not selected arbitrarily for these two forms. No full profile list/CRUD screen or gameplay selector was added.

Discovery and Test use edited values without saving or changing assignments. Stored keys are used only for matching
full endpoints; URL edits with a saved key require an explicitly supplied or cleared key, including at save time.
Testing sends a direct completion capped at 16 output tokens and temperature 0; its button discloses possible provider
charges in a title. Provider reply/error bodies are not echoed by diagnostics. English/Chinese labels are present.

Verification: typecheck passed; full suite 134 files passed, 1,198 tests passed, one skipped; production build
succeeded with the same dependency warnings. Six new test files exercise request snapshots/locked keys, routing
identity, unsaved diagnostics, endpoint consent, atomic role forms, UI mappings, sender/frame/URL policy, transport
tool rounds/error redaction, and independent cancellation. Legacy writer tests were replaced by startup-format
conversion/recovery tests; new-store security/persistence coverage remains.

A fresh full backup copy in `.dev-data/f0013-user-data/` was used for actual application verification. A test-only
Node preload mocked every LLM fetch before application code loaded; no external LLM requests were allowed. Checks
passed for exact startup backup/version 2, old bridge removal, diagnostics leaving file bytes unchanged, correct
unsaved-model request parameters, changed-endpoint protection, pending chat falling back with its original model/key
after edits/unassignment, role/UUID metadata, cancellation, next-request edits, all backed-up saves readable, safe views, and
version-2 language persistence. Restart kept settings bytes/UUIDs and backup count unchanged, and credentials remained
usable with the mock. A separate actual-startup corrupt-file test showed the recovery error and kept original bytes.

The actual SettingsPanel was seen in a separate Vite-served, network-mocked component preview. Test displayed
Connected and the fixture recorded test=1/save=0. The main app stayed at its age gate; no age verification was
submitted and no broad manual gameplay or packaged build was tested. Test windows/processes were closed. Protected
live data, both original backup folders, all archived originals, and all 74 findings remain byte-identical during
this phase. No paid calls, commits, or pushes. F001.4 requires a new approved plan.

## F001.4 implementation and verification

Approved by D-019 on 2026-11-24. Settings → LLMs now lists every saved connection, including preserved unassigned
secondary drafts, with Main/NSFW indicators. `ConnectionManager.tsx` uses existing CRUD, assignment, preferences,
and diagnostics APIs. `ConnectionProfileFields.tsx` retains every connection parameter; `connectionLibrary.ts`
handles safe draft mapping, dirty detection, unique default names, and preference isolation. `SettingsPanel.tsx`
guards profile/tab/Close/overlay/Escape navigation with the existing confirmation dialog. App passes its generation
busy state to disable both role selectors. No quick gameplay selector was added.

New drafts save without being assigned. Name plus Save renames while preserving UUID; Duplicate creates a saved,
unassigned copy with an available localized name and no key. Assigned deletion is disabled and main still rejects
it; unassigned deletion confirms. Assignment success updates the displayed selection; failures retain the old
selection. Profile edits survive assignment/preference operations. Profile and global preferences have independent
Save/Cancel controls, each backed by one existing atomic operation. Failed saves retain inputs. Switching editor
identity or Cancel remounts local model/optional-number widgets to prevent stale displayed values. English/Chinese
labels, explicit Fetch Models, credential replacement/clear, and unsaved Test are included. No storage-format,
save-schema, game-content, credential policy, or request-routing change was required.

Validation: typecheck/build passed; 135 files passed, 1,204 tests passed, one skipped. Six new tests exercise the
renderer draft payloads against the real store and disposable files, including keys, zero/false sampler values,
failed edits, renaming, duplication, assignment/deletion integrity, incomplete drafts, and restart persistence.

Actual interface tests used `.dev-data/f0014-user-data/`, a fresh complete backup copy. A separate SettingsPanel
preview forwarded its API calls through the owning renderer's actual validated bridge. The test-only transport
preload mocked all LLM requests. CRUD, names/IDs, unsaved diagnostics/no writes, injected save/assignment failures,
discard confirmations/cancellation, role busy state, deletion, independent preferences, endpoint/key protection,
optional sampler values across selections, and language changes preserving drafts all passed. Desktop and narrow
layouts were visually checked; at 640px the layout had one column and no horizontal overflow. A whole-app restart
retained the safe view, exact settings bytes, assignments/preferences, migration-backup count, and usable encrypted
credentials with the mocked completion. No hosted-provider, packaged, age-gate, or full-gameplay acceptance.

Test windows were closed. Live data, original backup folders, immutable audit files, and all 74 findings were
preserved. No paid calls, commits, or pushes. F001.5 needs a separate plan and approval.

## F001.5 implementation and verification

Approved by D-020 on 2026-11-24. `MainConnectionSelector.tsx` is mounted at the top of the gameplay pause menu.
It reads safe profile names/assignments on opening and uses only `connections.assign({ role: 'main', profileId })`.
The current persisted selection remains displayed until success; pending writes and scene/foreground/photo busy
disable it. Failures display the fixed error with Retry and retain the prior selection. Reopening after Settings
refreshes names/profiles/assignments. English/Chinese tooltip text distinguishes the main assignment from NSFW
routing. Selecting another main profile does not reset sticky NSFW scenes or change the secondary reference.

No new format, main-process API, game-state setter, scene/history/undo callback, or routing behavior was added.
Existing request snapshots protect in-flight background work; foreground busy state gates this control. Broader
background-job coordination is not a new feature of this stage.

Typecheck/build passed; full regression suite remained 135 files, 1,204 passed and one skipped. Rendered-interface
checks used fresh `.dev-data/f0015-user-data/` and a separate menu/Settings component preview forwarding through
the owning renderer's real IPC. All LLM fetches were mocked. Initial-load recovery, busy selection rejection,
pending-write display/disable, failure retaining assignment/file bytes, same-endpoint different model/key/sampler
requests, next-request UUID/role, preserved NSFW routing/assignment, and Settings rename/reassignment refresh passed.
The request fixture's scene/history/state and every disposable save-file hash were unchanged. Safe views contained
no stored keys. Desktop and translated narrow menus were visually checked, with no horizontal overflow at 420px.

A full app restart retained exact settings bytes, profile references, and migration backup count; the selected
model/key worked through mocked diagnostics. The main app stayed at its age gate; full gameplay, hosted endpoints,
and packaged Windows acceptance remain deferred. Test windows were closed. Protected live data, original backups,
archive hashes, and all 74 findings remain unchanged. No paid calls, commits, or pushes. F001.6 needs its own plan
and approval before final acceptance or rollout.

## F001.6 acceptance results

D-021 authorized final testing. Typecheck and the full suite passed: 135 files, 1,204 tests, one pre-existing skip.
`npm run build:win` passed after a sandbox DNS failure was retried with network approval. The production build is
included; output is an unsigned `dist/win-unpacked/` directory, not an installer/ZIP. Existing dependency warnings
and the missing package-author warning remain. No production source or game content changed during this stage.

Because packaged mode ignores development overrides, a disposable copy used an alternate startup harness that
set userData/sessionData before loading the unchanged original application ASAR, mocked LLM transport, and opened
a loopback inspector. Native executable and original ASAR hashes remained unchanged; all 171 build outputs and
4,296 content resources matched. The build artifact itself was not altered or launched against live data.
Packaged file-origin IPC, exact migration backup, original credentials, all backed-up saves readable, CRUD/reference integrity,
diagnostics without writes, endpoint/key protection, routing, snapshots, cancellation, timeout/independent requests,
restart stability, corrupt-file preservation, and unowned-renderer rejection passed.

The restored packaged profile already held an age confirmation. No verification was submitted or flag set/bypassed.
Native UI loaded its real scene and changed B to A in the menu without changing any autosave bytes: state, scene,
13 messages, and six stored undo records were identical. Native Send then used A's model/key/sampler with mocked
transport; the selector disabled/re-enabled correctly, and the reply rendered/autosaved. History grew to 15 messages.

**ACC-001 prevents unqualified acceptance:** `App.tsx:312` omits saved `turns` when creating the loaded session,
so Game initializes an empty undo list. The same omission exists at baseline HEAD. After the new reply, only one
undo record was saved instead of the expected seven. The earlier menu switch did not cause this loss. D-022 is
a proposed, unapproved narrow fix; no source fix was bundled. Preserve the original 74 audit findings/IDs and
track this acceptance discovery separately. Full reproduction, matrix, artifact hashes, limits, and repair scope:
`F001_ACCEPTANCE_REPORT.md`.

Test windows/inspectors were closed. Live data, both original backups, archive hashes, and all 74 findings remain
unchanged. No paid-provider verification, live migration, release, commits, pushes, or F-002 work occurred.

## D-022 repair and recheck — 2026-11-25

The owner approved the undo-loading fix after the acceptance report/summary. App.start now passes full SaveData
through `resumeSavedGame` in shared/game/resume.ts, preserving turns when the original scene/cast validation succeeds
and clearing them if it fails or no scene exists. State reconciliation, Game's pack/unpack/rewind behavior, and save
version remain unchanged. The helper is exported from shared/game/index.ts; five regression cases were added.

Typecheck and all 136 test files pass: 1,209 tests passed and one skipped. Production/Windows directory build passed
again with prior warnings. A fresh isolated packaged copy loaded the original six-record/13-message save, switched
main profiles through the native menu, and sent a mocked reply using the selected model/key/sampler. The save grew
to seven records/15 messages; the original six packed records were exactly unchanged. Native browsing reached an
older saved turn. Foreground busy controls and re-enabling passed. Packaged restart retained seven records, exact
save/settings bytes, assignments, backup count, and usable fixture credentials. All 171 built outputs/4,296 content
resources matched; test binary/original ASAR were unchanged relative to the rebuilt artifact.

ACC-001 is resolved. Its initial baseline failure evidence is preserved in F001_ACCEPTANCE_REPORT.md rather than
rewritten as passing. Only this approved repair changed production source; settings/credentials/game content and
save format are unchanged. Protected live data, both original backups, audit hashes, and all 74 findings are intact.
Test processes were closed. No paid calls, live migration, releases, commits, pushes, or F-002 work. F-001 is ready
for the owner's final acceptance within the documented isolated/mock scope; broader rollout remains separate.

## Audit resolution tracker

All M0-001–M0-074 remain preserved historical findings, not automatically open defects. All five original archive
hashes still match SHA256SUMS.txt. Do not delete or renumber findings; append resolution evidence here.

| ID | Classification / status | Evidence and remaining limits |
|---|---|---|
| M0-001 | Instruction conflict resolved | Owner-approved D-014; identical compatibility rules in AGENTS.md and CLAUDE.md. Uncommitted; feature implementation remains approval-gated. |
| M0-069 | Development risk mitigated for isolated launches | Approved D-015; path/junction tests and actual Electron/IPC checks verified separation; live data unchanged. Normal source authoring and standalone scripts retain existing behavior. No claim of broader remediation. |
| M0-064, M0-068 | LLM settings protections active in source; isolated verification only | D-018 activates the new store and removes the old writer. Atomic writes/backups and encryption refusal pass tests. Live data and unrelated content/Civitai stores remain untouched; no claim of full finding resolution. |

## Session update template

Date / branch / commit / milestone / approved scope / files changed / commands and actual results / audit IDs addressed / decisions / blockers / compatibility and rollback / next action / owner approval. Update after each reviewed milestone.

## F-001 acceptance — 2026-11-25

The owner accepted F-001 within the documented isolated-data/mocked-endpoint scope (D-023). F001.6 is complete;
the original failure and successful D-022 repair/recheck remain in F001_ACCEPTANCE_REPORT.md. Acceptance is not
live rollout, real-provider verification, release, commit/push, or F-002 implementation authorization. Only working
documents changed while recording this decision. The next development step is a separately reviewed P2.0 plan.
