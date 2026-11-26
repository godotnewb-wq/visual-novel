# Development status

Current gate: F-001 accepted; F-002 implementation through P2.5 and local/mock P2.6 verification pass on `writer-manager` at `6788dfb`. D-033 covers acceptance testing, with no production source changes. Typecheck, 148 files/1,490 tests (one existing skip), production build, and Windows directory packaging pass. An isolated packaged API matrix has 25 passing records; the actual production App root passes neutral Dual/Legacy gameplay, redo, retry, completion, and edited-memory persistence. See F002_ACCEPTANCE_REPORT.md. Live data is unchanged. Final owner acceptance and any separately scoped real-provider evaluation remain pending. BUG-001's original cause remains unconfirmed.

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
| P2.0 (F-002 baseline) | Verified under D-025 within local/mock scope; original BUG-001 cause remains unconfirmed | Review F002_BASELINE_REPORT.md |
| P2.1 (F-002 contracts) | Produced under D-027/D-028; basis accepted for P2.2 under D-029 | Retain contract and semantic/evidence boundaries |
| P2.2 (F-002 validation) | Dormant schemas/pure validation implemented under D-029; 119 focused checks pass | Review F002_P22_VALIDATION_REPORT.md |
| P2.3 (F-002) | Dormant assignments/orchestration implemented and verified | 70 new focused checks; 1,409 full-suite passes/one skip; typecheck/build pass |
| P2.4 (F-002) | Application/IPC/save/undo integration verified in local/mock scope | 56 new focused checks; 1,465 full-suite passes/one skip; hidden isolated startup/save API smoke; controls not visually checked |
| P2.5 (F-002) | Tracking, completion context, and optional mode/profile controls implemented under D-032 | 25 new tests; 1,490 passes/one skip; isolated neutral component UI/mock checks; F002_P25_TRACKING_REPORT.md |
| P2.6 (F-002) | Local/mock and specific packaged gameplay checks pass under D-033; final owner acceptance pending | 25 API records, restart, seven actual-root UI captures; no real-provider quality/cost claim; F002_ACCEPTANCE_REPORT.md |
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
- [x] Scope, authorize, and execute F-002/P2.0 under D-025; preserve unresolved BUG-001 evidence and keep live rollout/paid tests/commits/pushes separately authorized.
- [x] Produce P2.1 contract/inventory artifacts and obtain the remaining mode/routing/recovery/overflow product choices (D-027/D-028).
- [x] Accept P2.1 as P2.2's basis; implement/verify dormant parsing and validation under D-029.
- [x] Implement and verify P2.3 dormant assignments/orchestration under D-030.
- [x] Implement/verify P2.4 complete-turn application under D-031; retain visual/provider limits.
- [x] Finish P2.5 witnessed tracking/completion context and optional mode/profile controls under D-032.
- [x] Execute P2.6 local/mock and isolated packaged checks under D-033; record exact visual/provider limits.
- [ ] Obtain final owner acceptance of F-002 within the documented scope; separately agree any real-provider evaluation.

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

## F-002 P2.0 baseline — 2026-11-25

The owner selected `writer-manager` and authorized the explained P2.0 scope with "Let's begin" (D-025).
Initial branch/commit: `writer-manager`, `6788dfb0c6ea979a60e7ef35fb0eaf19ef73771c` (`added connection profiles`);
initial working tree clean. This supersedes the earlier uncommitted-source checkpoint for current baseline purposes.

Initial typecheck and production build passed; the initial suite passed 136 files/1,209 tests with one skip. Eleven
synthetic transition cases now cover the real router/client, movement tool, parser, display-beat conversion, and pure
movement application. Typecheck passes; full suite: 137 files, 1,220 passing tests, one existing skip. Build warnings
remain the documented Zod annotation/Phaser import warnings. Existing runtime application source is unchanged.

Both original backups match historical hashes (373 user-data files, twenty documentation files). A fresh exact
restoration retained all bytes through validation, loaded thirteen saves, and retained its known historical add-on
warning. An actual hidden source Electron/API smoke used separate synthetic keyless settings, checked actual storage
and add-on paths, and passed all eleven scenarios/fifteen mocked requests. No age-gate state was changed and no visible
gameplay acceptance was performed. The process closed. All 376 current live user-data files, original backups,
archive bytes, and pre-existing application source remain unchanged; all 74 audit IDs remain present.

The owner clarified that BUG-001 involved a standalone trailing command in curly braces and no transition (D-026).
Synthetic examples reproduce that shape with no movement proposal. A tools-rejection retry also keeps the tool-naming
prompt while removing the request's tools; scripted curly content then remains visible. This demonstrates a possible
path, not the original cause. BUG-001 and M0-055 remain open; no runtime fix was made. Details and limits are recorded
in F002_BASELINE_REPORT.md. Next: P2.1 contract review. No paid calls, live-data writes, commit, push, or rollout.

## F-002 P2.1 contract artifacts — 2026-11-25

Authorized by "Go ahead and begin p2.1" and continued at the owner's request (D-027). F002_OPERATION_INVENTORY.md
maps all 23 current ChatResponse fields and eleven proposed operation families, including presentation/event coupling,
birth-control core memory, source timing, witness cutoffs, closure settlement, existing unanswered-line save protection,
and background/undo semantics. F002_TURN_CONTRACT.md defines complete proposed output types, bounds/refinements, source
spans, agency/ambiguity rules, writer-first scheduling examples, recovery/commit order, note versions/retention/privacy,
optional saved metadata/completion intent, and the proposed settings-version path.

The owner selected next-scene mode changes, next-turn profile changes and role-aware selector behavior, existing NSFW
writer routing with no Manager profile fallback, explicit full regeneration for irreconcilable prose, and continued
play under the specified note-cap retention policy (D-028). Numeric caps and implementation mechanics remain proposals
for contract review. No application schemas, validators, prompts, migrations, IPC, or activation were implemented.

The two extracted TypeScript contract blocks compile standalone. The coverage check maps all 23 response fields and
eleven operation families. All 554 source/script/config files in the P2.0 manifest match their prior hashes; archived
originals and all 74 audit IDs are retained. The current shipped Tamsin opening prompt is 13,971 characters, approximately
3,493 tokens under prompt-size.ts's estimate. Proposed fixed instruction supplements are 423/502 characters; those are
not full prompts and prove no token/quality improvement. Existing repository typecheck/full-suite results are reported
at the end of the P2.1 work in the current chat. No provider/UI test or user-data write accompanies this documentation stage.

Next: owner review of the concrete contract, then separately scoped P2.2 dormant shared parsing/validation. Keep P2.0
comparison tests and all existing user changes; no commit, push, paid request, or runtime activation is authorized here.

## F-002 P2.2 dormant validation — 2026-11-25

The owner approved the next step after P2.1 (D-029). Four new shared files implement dormant strict schemas, pure
validation/Writer guarding, and adjacent tests. Settings/Scene/save schemas, routing, prompts, IPC, application
imports, and live data are unchanged. Earlier P2.0/P2.1 changes and staged files are retained.

119 focused checks pass. Typecheck passes; full suite: 139 files, 1,339 passing tests, one pre-existing skip. Production
build passes with existing Zod/Phaser warnings. Inferred schema types match P2.1 wire/note/scene types bidirectionally.
All 554 prior source/script/config hashes, both original backup trees, the full archive, and 74 finding IDs remain.
No app/provider/UI test, user-data migration/write, commit, push, or activation was performed in P2.2.

Validation returns mechanically eligible candidates with `requiresConsistencyReview: true`, not proof of consent or
narrative meaning, and performs no live effects. Note visibility intersects all quoted conversational audiences,
including historical sources; correction/resolution validation leaves old entries intact. Later stages still owe
effect application, retention, save/load/undo, retries/queues, and consistency checks. The dormant Writer guard holds
the synthetic leakage families; Legacy is unchanged and BUG-001 remains open. Details: F002_P22_VALIDATION_REPORT.md.
Next at that checkpoint: review P2.2 and scope P2.3; superseded by the P2.3 update below.

## F-002 P2.3 dormant assignments/orchestration — 2026-11-25

The owner approved the next step under D-030. Independent Writer/Manager references, protected opt-in v3 settings
conversion, captured profiles, localized separate prompts, tool-free transport, sequential calls, bounded recovery,
and owner/session cancellation now exist. Normal startup stays v2; no Dual IPC, controls, save fields, or gameplay
activation. P2.4 must apply and review candidate effects through the complete-turn boundary before publication.

Typecheck/build pass; full suite: 143 files, 1,409 tests pass, one existing skip. The four new test files add 70 checks.
All 122 sampled Legacy prompt outputs match the prior implementation; combined Dual prompt inputs are larger in
the measured new-game sample. There is no provider latency/cost/quality or visual acceptance claim. Only isolated
settings files and mocked completions were used; live settings/saves/add-ons, backups, archives, and 74 findings are
intact. The five intended prior source changes leave the other 549 baseline files unchanged. No staging, commit,
push, real-provider request, or live migration. See F002_P23_ORCHESTRATION_REPORT.md for full evidence and limits.

Next: P2.4 complete-turn application, minimal compatible persistence, recovery, save/undo, and background merges.

## F-002 P2.4 complete-turn application — 2026-11-25

The owner's request to begin P2.4 (D-031) now has an implemented shared effect/application path, a focused renderer
session commit, owning-frame IPC/recovery, optional scene metadata, save/restart/undo, and background preservation.
Pending preparation remains private; a duplicate, stale, or cancelled result cannot publish. Known prose conflicts
use bounded recovery, with explicit semantic limitations. Basic bounded note reconciliation supports persistence;
finished witness/summary tracking and mode/profile controls remain P2.5.

Typecheck/build pass; full suite: 146 files, 1,465 tests pass/one existing skip. The new three files add 56 checks.
The compiled hidden API smoke verifies isolated v2 startup and optional metadata round-trip with zero network calls.
All 13 original backup saves still parse; all 122 sampled Legacy prompts match. Live settings/saves/add-ons and
original backups/archive remain intact; the other 541 prior source files are unchanged outside the thirteen intended
P2.3/P2.4 modifications. Controls have not been visually checked. No live migration, provider/paid call, staging,
commit, or push. Full evidence: F002_P24_APPLICATION_REPORT.md. Next: P2.5 tracking/completion context and controls.

## F-002 P2.5 tracking and controls — 2026-11-25

D-032 implements bounded witnessed encounter notes with private correction/resolution versions, safe retention,
deduplication, and supporting context for existing completion summaries. Optional metadata retains witnesses,
turn identity, and two comfort assessments through save/resume/undo. Older unmarked scenes remain Legacy; new
scenes capture the selected mode. Protected v3 startup conversion retains existing connections/credentials and
defaults to Legacy. Settings exposes independent Writer/Manager assignments and optional Dual-call; mode changes
apply next scene and profile changes next turn. See F002_P25_TRACKING_REPORT.md for exact behavior/data touches.

Typecheck/build pass; 148 files/1,490 tests pass with one existing skip, including 25 new checks. All 122 sampled
Legacy prompts match. Thirteen original saves parse; live settings/saves/add-ons/Local State, backups/archive, and
all 74 finding IDs remain intact. Neutral component previews exercise actual main/preload IPC with 16 mocked
completions and no real-provider calls. Settings/recovery/selectors and neutral scenes were visually inspected;
the preview used reduced motion for the final NPC scene. The production root's existing age gate was left untouched.
This is not production-root or transition-animation acceptance. No staging, commit, push, release, or live launch.
Next: P2.6 broader gameplay/completion acceptance and any explicitly scoped provider evaluation.

## F-002 P2.6 local and packaged acceptance — 2026-11-25

The owner requested P2.6 under D-033. No production source/content change was needed: all 581 pre-stage files
retain their hashes. Typecheck and the full suite pass (148 files, 1,490 tests/one skip). Production/Windows directory
build passes after the approved retry of a sandbox DNS failure. Executable is unsigned. All 169 built files and
4,296 loose content files match the packaged originals; the release executable/archive stayed unchanged by tests.

A disposable packaged bootstrap redirects actual user/session storage and mocks only fixture endpoints. Twenty-five
final API records pass with 52 scripted completions, including group privacy/summaries, lecture/NPC, movement,
meetings, presentation, closure, held output, retry/regenerate/cancel, connection arrangements, and NSFW routing.
Restart preserves exact save/settings bytes and backup count. The unchanged production App root also passes neutral
Dual/Legacy turns, real redo, held-draft retry, saved completion, and edited summary memory: 15 scripted completions
and seven inspected screenshots, with real transitions enabled. Normal age confirmation occurred outside automation;
the harness neither submitted it nor wrote its flag. The test app closed after verification.

Live settings/saves/add-ons/Local State, backups, archive, and all 74 finding IDs remain unchanged. No real-provider
requests, paid tests, staging, commits, pushes, or release. Specific adult/event/overnight paths retain automated
rule coverage but were not all visually played. Full methodology, mock measurements, failure corrections, and limits:
F002_ACCEPTANCE_REPORT.md. Final owner acceptance and any agreed provider/quality/latency/cost evaluation remain.
