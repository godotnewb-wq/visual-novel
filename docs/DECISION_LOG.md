# Decision log

Current checkpoint: F-001 accepted; F-002 implementation through P2.5 and local/mock P2.6 checks pass. D-033 covers isolated packaged acceptance with no production changes. Final owner acceptance and any separately scoped real-provider evaluation remain pending; see F002_ACCEPTANCE_REPORT.md. Status labels: Approved direction = owner-selected priority/scope; Proposed = recommendation pending detailed review; Reported = observation awaiting reproduction. Implementation approval applies only where explicitly recorded.

| ID | Status | Decision / rationale | Source / gate |
|---|---|---|---|
| D-001 | Approved direction | Audit before implementation; preserve findings and defer builds/tests until audit closure. | CONVERSATION_DESIGN.md; M0 complete |
| D-002 | Approved direction | F-001 first: multiple named LLM profiles for switching providers/models without overwriting settings. | LLM_CONNECTION_ROADMAP.md |
| D-003 | Approved direction | Project 2/F-002 second: two calls, writer and information/gameplay manager; no separate third presentation call. | DUAL_CALL_GENERATION_DESIGN.md §11 |
| D-004 | Approved direction | Broader NPC improvements follow both features. | IMPROVEMENT_PLAN.md updated sequence |
| D-005 | Proposed | Separate feature branches, owner review before source edits/commits/pushes; preserve saves/add-ons. | F001.0; resolve AGENTS/CLAUDE conflict |
| D-006 | Proposed | Stable profile IDs, role references, legacy migration, atomic writes, no new plaintext downgrade. | F001.1–2 |
| D-007 | Proposed | Preserve main/nsfw routing, snapshot request settings, disable switching while busy initially. | F001.3–5 |
| D-008 | Proposed | Writer-first sequential calls, optional legacy mode, role-specific assignments, validated manager contract, atomic turn commit. | P2.1–4 |
| D-009 | Proposed | Transient bounded encounter ledger first; no wholesale memory redesign or new ordinary NPC mechanics. | P2.5 |
| D-010 | Proposed | Test natural stopping-point prompt before invasive NPC changes; no forced question quota. | M2 after F-002 |
| D-011 | Reported | BUG-001 transition commands appear in chat; cause and actual transition outcome unknown. | P2.0 reproduction |
| D-012 | Reported | Approx. 8/10 NPC replies end in questions across models; cause unmeasured. | M1 baseline, M2 comparison |
| D-013 | Proposed | Defer import/export, generalized fallback chains, broad task routing, TTS and video continuation. | Feature designs; separate approval |
| D-014 | Approved policy | Preserve settings, saves, add-ons, authored values, and credentials. Allow migrations required by an approved feature, including existing LLM settings for F-001. Supersedes AGENTS.md's former no-compatibility rule and resolves M0-001; does not authorize feature implementation. | Owner approval, 2026-11-24; identical rules now in AGENTS.md and CLAUDE.md |
| D-015 | Approved preparation scope | Create `codex/llm-connection-profiles`, add a development-only data-directory override, and restore backups into disposable data to verify isolation. No F001.1 implementation, commits, or pushes authorized. Implemented using `BREEDHAVEN_USER_DATA_DIR`, `npm run dev:isolated`, and Git-ignored `.dev-data/user-data/`. | Owner: "I approve the prep work," 2026-11-24; verification in DEVELOPMENT_STATUS.md |
| D-016 | Approved F001.1 implementation scope | Version 2 settings, named profiles with UUIDs, names unique after trimming and ignoring case, main/optional-NSFW references, and a pure legacy converter preserving parameters, globals, credentials, and secondary drafts. Add conversion/validation tests; keep startup migration inactive until F001.2 supplies protected backup and atomic persistence. No routing/UI changes, commits, or pushes authorized. | Owner: "I approve F001.1 as proposed," 2026-11-24; narrows the approved portion of D-006 |
| D-017 | Approved F001.2 implementation scope | Implement the separate store, atomic writes, protected migration backups, safe views, profile CRUD/assignment/preferences, and validated typed IPC/bridge. Refuse new persisted keys without encryption; allow keyless profiles; duplicate nonsecret parameters only; defer explicit key reuse and session-only keys. Test disposable data only. Keep application startup activation deferred to F001.3 so legacy consumers cannot overwrite the new format. | Owner: "Approve F001.2 with these recommendations, keeping startup activation deferred to F001.3," 2026-11-24; supersedes D-016's earlier activation boundary |
| D-018 | Approved F001.3 implementation scope | Activate the new store, replace every legacy writer/consumer, preserve refusal/NSFW routing, distinguish UUIDs from routing roles, snapshot each logical request and retries, adapt existing forms, and test unsaved connections without saving or implicitly forwarding saved keys to changed endpoints. Verification only on isolated data and mocked endpoints. Full library UI and gameplay switcher remain later stages. | Owner: "Approve F001.3 as proposed, with verification limited to isolated data and mocked endpoints," 2026-11-24; supersedes D-017's activation deferral |
| D-019 | Approved F001.4 implementation scope | Build the named-profile library and one editor in Settings: create/edit/rename/duplicate/delete, explicit Save/Cancel, discard confirmations, persisted main/optional-NSFW assignments disabled during scene generation, unsaved discovery/testing, hidden keys with replacement/clear and endpoint protection. Verify only isolated data/mocked endpoints; gameplay switcher remains F001.5. | Owner: "I approve F001.4 with this scope," 2026-11-24; implements the reviewed interface plan after D-018 |
| D-020 | Approved F001.5 implementation scope | Add the compact main-profile selector/current assignment display, persist successful choices, retain the old selection on failure, disable switching during foreground generation, and preserve scenes/history/state and NSFW routing. Retain isolated-data/mocked-endpoint verification. | Owner: "I approve the plan. Please proceed," 2026-11-24, continuing from F001.4 to the roadmap's F001.5 scope; pause-menu placement was stated before implementation |
| D-021 | Approved F001.6 testing scope | Run final unit/integration, Windows packaging, isolated packaged runtime and gameplay smoke/restart/recovery acceptance. Keep real providers, paid calls, live migration, release, commits, and pushes outside this authorization. | Owner: "Go ahead with final acceptance testing," followed by "Please continue the work" |
| D-022 | Approved repair; implemented and verified | Preserve saved undo records through the load-to-session entry point, clear them if the scene cannot resume, add regression coverage, and repeat relevant packaged acceptance. ACC-001 remains separate from the 74 original M0 findings. | Owner: "I approve the next step," 2026-11-25, following the undo-fix proposal and summary; no F-002/release/commit/push approval |

| D-023 | Owner accepted F-001 | Close the connection-profile milestone, including verified D-022 repair, within the documented isolated-data/mocked-endpoint scope. Preserve evidence and testing limits. This does not authorize live rollout, real-provider/paid tests, commits, pushes, or F-002 implementation. | Owner: "I accept F-001 as implemented and tested within the documented isolated-data and mocked-endpoint scope," 2026-11-25 |

| D-024 | Owner-confirmed F-002 design choices; implementation plan pending review | Publish replies only after both calls validate; retain opt-in Dual-call alongside Legacy for existing installations; persist validated encounter notes in saved scenes; give Writer and Manager independent saved-profile assignments; retry a failed Manager once with the same unpublished Writer output, then offer Retry/Cancel; retain existing encounter-completion routing/rules with validated notes as supporting context. These decisions authorize planning, not F-002 source changes or P2.0 execution. | Owner questionnaire answers and "Then yes let's go with that" confirming independent role assignments, 2026-11-25; DUAL_CALL_GENERATION_DESIGN.md sections 13–17 |

| D-025 | Approved P2.0 execution; baseline verified | Execute baseline typecheck/tests/build, backup/restoration/isolation verification, and local/mocked BUG-001 investigation with labeled comparison fixtures on the owner-selected `writer-manager` branch. Runtime behavior remains unchanged. Does not approve later Dual-call implementation, real-provider/paid calls, rollout, commits, or pushes. | Owner: "Let's begin," following the P2.0 scope explanation, 2026-11-25; F002_BASELINE_REPORT.md |
| D-026 | Reported BUG-001 clarification; synthetic symptom reproduced | Owner recalls a standalone trailing command inside curly braces and no transition. Exact interior text and original provider/state remain unknown. Synthetic curly-command/content cases survive parsing with no movement; provider-tools rejection is a demonstrated possible path, not the confirmed original cause. BUG-001 and M0-055 remain open. | Owner's P2.0 clarification, 2026-11-25; eleven synthetic fixtures and F002_BASELINE_REPORT.md |

| D-027 | Approved P2.1 contract work; review artifacts produced | Inventory every current turn operation/side effect and define Writer/Manager inputs/output types, validation, evidence, preflight examples, commit/retry/undo/save behavior, and note retention. Documentation/contract review stage; runtime schemas, migration, IPC, and Dual-call activation are not implemented. | Owner: "Go ahead and begin p2.1," then "Can you go continue the work," 2026-11-25; F002_TURN_CONTRACT.md and F002_OPERATION_INVENTORY.md |
| D-028 | Owner-confirmed P2.1 product choices | Mode changes apply next scene, profile switches next turn; gameplay selector switches Main in Legacy and Writer in Dual-call, with Manager in Settings. Keep NSFW flagged/sticky scene routing and Writer refusal fallback; Manager remains on its assigned profile. Hold irreconcilable consequential prose for explicit Regenerate reply/Cancel; regenerate both roles. Continue play at the note cap, retain unresolved promises/plans, evict superseded/resolved notes first, skip new optional notes if needed, and record limited tracking. Numeric caps and detailed schema remain proposals for contract review. | Owner's four questionnaire answers, 2026-11-25; F002_TURN_CONTRACT.md sections 1, 2, 9, and 10 |

| D-029 | Approved P2.2 implementation; dormant modules verified | Implement the P2.1 contract as strict shared schemas and pure parsing/validation with adjacent mocked/regression tests; keep application imports, settings/save activation, IPC, prompts, and Dual-call routing dormant. Uses the reviewed contract/caps as its implementation basis; does not authorize later integration, live migration, paid calls, rollout, commits, or pushes. | Owner: "I approve the next step," following the P2.1 package/P2.2 handoff, 2026-11-25; F002_P22_VALIDATION_REPORT.md |
| D-030 | Approved P2.3 implementation; dormant service verified | Add protected opt-in settings conversion, independent Writer/Manager assignments and captured profiles, separate prompts/transport, sequential calls, bounded retry/regeneration/cancellation, and mocked verification. Normal startup remains version 2; gameplay mode activation stays unavailable pending P2.4/P2.5 foundations. Does not authorize live migration, paid/provider acceptance, rollout, commits, or pushes. | Owner: "I approve the next step," following the P2.2 handoff, 2026-11-25; F002_P23_ORCHESTRATION_REPORT.md |
| D-031 | Approved P2.4 implementation; local/mock integration verified | Connect typed effects and presentation to a staged atomic session commit, narrow authorized IPC/recovery, compatible optional scene metadata, save/undo, and background preservation. Keep default startup/mode activation gated for P2.5. Bounded consistency checks do not prove arbitrary prose meaning. UI controls are connected but not visually accepted; no live migration, paid-provider tests, rollout, commit, or push. | Owner's explicit request to begin P2.4, 2026-11-25; F002_P24_APPLICATION_REPORT.md |
| D-032 | Approved P2.5 implementation; local/mock tracking and controls verified | Complete bounded evidence-backed ledger reconciliation, witness filtering, private correction/resolution versions, save/undo/resume, and supporting context for existing summaries. Expose independently assigned Writer/Manager profiles and optional Dual-call mode through protected v3 startup conversion, retaining existing installations on Legacy. Mode changes apply next scene; profiles next turn. Verify with disposable data and neutral component previews; production-root/provider acceptance, release, commits, and pushes remain outside this step. | Owner: "Go ahead and start p2.5," then "Please continue the work," 2026-11-25; F002_P25_TRACKING_REPORT.md |
| D-033 | Approved P2.6 acceptance work; local/mock checks verified | Recheck the full suite/build, isolate an instrumented Windows package, and exercise neutral Legacy/Dual gameplay, broader API flows, recovery, persistence, restart, and actual-root UI. No production changes needed. Test storage, release artifacts, live data, and audit originals remain protected. This authorizes testing, not final acceptance on the owner's behalf, real-provider/paid requests, live rollout, release, commit, or push. | Owner: "Let's continue to P2.6," 2026-11-25; F002_ACCEPTANCE_REPORT.md |

## Open decisions

- F001.0: paid dialogue/evaluation scope remains deferred. Baseline, branch, backup, restoration, and isolation are verified; owner approved proceeding to F001.1 (D-016). Compatibility is resolved by D-014; D-005's branch proposal is approved within D-015's scope.
- F-001 is accepted under D-023. F-002 implementation and P2.6 local/mock checks have scoped reports; D-033 adds specific actual-root packaged gameplay evidence. Final owner acceptance remains pending. Mock/package success is not provider quality/performance acceptance.
- Hosted-provider/paid validation and uninstrumented live rollout remain outside scope. Explicit key reuse and session-only credentials remain deferred.
- Strict schemas, validation, retention, state application, and persistence are integrated through P2.5. Mechanically eligible candidates still require consistency review; evidence does not prove consent/meaning. BUG-001's exact original cause remains unconfirmed; synthetic control guards do not establish its cause or a Legacy fix.
- P2.3–6: D-024/D-028 settle mode/profile timing, Legacy retention, no provisional display, saved notes, independent assignments, writer NSFW fallback, one automatic Manager retry, explicit full regeneration, and note-overflow behavior. Actual native-format capabilities and model latency/cost/quality targets still require scoped evaluation; short instruction supplements are not complete prompt benchmarks.
- M2–M7: baseline-derived evaluation thresholds, ordinary NPC memory expansion, directional attitudes, optional Continue and new character controls.

For future decisions record date, owner approval, alternatives, rationale, affected files and superseded decision IDs. Never rewrite historical evidence to make a later decision appear original.

## Preparation evidence — 2026-11-24

The owner reported successful dependency installation, typecheck, 1,100 passing tests with one skipped, and build.
The approved preparation adds five isolation tests; the suite now reports 123 passing files, 1,105 passing tests,
and one skipped. Typecheck and production build pass. Restored data and actual Electron paths were checked;
live data and the original backup remained byte-identical. At the preparation gate, F001.1's details were still
proposals. D-016 subsequently approves the model and conversion scope; remaining D-006 persistence and credential
behavior still requires review.

## F001.1 evidence — 2026-11-24

The dormant model and converter are implemented under D-016. Engineering choices: strict validation rejects unknown
fields rather than discarding user data; UUID spelling is normalized to lowercase; the caller supplies UUIDs and
localized migration names so conversion has no randomness, I/O, or locale dependency. The shared connection model
has no credential fields. The main-only stored model preserves existing key bytes and encryption flags without
decrypting, re-encrypting, or writing them. Preserving a legacy plaintext record in memory does not approve new
plaintext persistence. The existing settings store and request paths remain active and unchanged.

Validation: 46 focused tests passed; typecheck passed; full suite 125 files passed, 1,151 tests passed, one skipped;
production build succeeded with the existing dependency warnings. Protected live data, both backup folders, and
the archive were unchanged. All 74 findings remain. No F001.2 implementation or startup migration has occurred.

## F001.2 evidence — 2026-11-24

D-017 is implemented as a dormant `ConnectionStore`, file writer, IPC registrar, and typed preload bridge factory.
No new store/registrar/bridge is attached to application startup. Changes are tested only in temporary/disposable
directories; the running app still uses its fixed-profile settings store and IPC.

Engineering choices: exclusive same-directory migration backups with unique names and exact original bytes;
exclusive 0600 temporary files, file flush/close, then rename; publish memory only after replacement succeeds;
check original bytes before replacement to reject stale external edits. Windows permissions inherit from the
settings directory; POSIX modes are enforced where supported. This is not a cross-process lock or a guarantee
against every storage/power failure. Existing full user-data backups remain essential.

Existing encrypted keys remain opaque until a main-process request resolves them. Nonsecret edits can preserve
locked ciphertext. Plaintext legacy keys require encryption before migration/write; if encryption is unavailable,
the original remains intact. Newly supplied keys cannot be persisted without a cipher. Blank keys clear explicitly;
omitted keys are preserved. Errors crossing IPC use fixed localized messages and codes, without input/cipher/FS
diagnostics. The registrar requires an authorization predicate; real Electron testing checked owning-window and
main-frame identity. Existing unrelated IPC authorization remains outside this stage.

Typecheck and build passed. Full suite: 128 files passed, 1,183 tests passed, one skipped, including 32 new F001.2
tests. Real Electron safeStorage plus hidden sandboxed/context-isolated windows verified migration backup bytes,
credential preservation, all IPC operations, duplicate key exclusion, assigned deletion protection, invalid input,
unowned-window rejection, and reloading. The initial settings-only test copy lacked the original encryption context;
adding backed-up `Local State` made decryption succeed. No live data, original backups, or archive bytes changed;
all 74 findings remain. No paid calls, commits, or pushes.

## F001.3 evidence — 2026-11-24

D-018 activates `ConnectionStore` and the guarded `connections:*` bridge in application startup. The old
`SettingsStore` writer and old get/save/test/model IPC paths were removed; `settings/store.ts` now holds only
the shared cipher interface. Existing two-role forms save through one version-2 transaction. Unassigned library
profiles/drafts stay preserved but are not shown by those role forms; management UI is F001.4.

Engineering choices: capture both role identities, parameters, credential outcomes, global preferences, and language
instruction at logical-request entry; errors for unused locked keys are retained without blocking the selected
role. Every retry/summary witness uses that snapshot, while the next operation sees edits. Responses carry both
UUID `profileId` and `profileRole`; scene NSFW persistence uses the latter. Full-endpoint key association is checked
for both edits and unsaved diagnostics: changed addresses require explicit key entry or clear. Existing Test is
now unsaved, capped at 16 output tokens, and has a provider-charge tooltip. Diagnostic responses never echo provider
replies or raw errors. This does not establish hosted-model behavior or an exact cost bound.

Typecheck and build passed; full suite 134 files passed, 1,198 tests passed, one skipped. New tests cover snapshots,
fallback identity, concurrent edits, locked keys, diagnostics/credential destinations, atomic role forms, trusted
URL/window/frame ownership, transport retries/redaction, and independent cancellation. The six obsolete legacy
writer tests were replaced by two activation/recovery tests; detailed persistence/security coverage remains in
the new store's tests.

Actual app checks used a fresh full user-data copy and a preloaded mocked LLM transport. Startup created an exact
legacy backup; diagnostics did not write; pending chat retained its original fallback/key/model after edits;
responses reported correct role and UUID; cancellation and next-request settings worked; all backed-up saves remained
readable; language writes retained version 2. Restart preserved settings bytes/UUIDs and did not migrate again.
A corrupt-file startup check reported recovery without overwriting the file. The actual SettingsPanel was visually
checked in a separate mocked Vite preview; clicking Test recorded one test and zero saves. No age gate was submitted.
Live data, both original backups, archive bytes, and all 74 findings remain unchanged. No paid calls/commits/pushes.

## F001.4 evidence — 2026-11-24

D-019 implements the full library in Settings → LLMs using existing validated CRUD/assignment/diagnostic IPC.
`ConnectionManager.tsx` owns the library, one editor, role selectors, separate preferences form, and operation state.
`ConnectionProfileFields.tsx` retains all existing parameters; `connectionLibrary.ts` maps safe views/drafts and
generates unique names. Settings guards profile/tab/overlay/Escape/Close navigation with `useConfirm`; deletion
also confirms. Unsaved creation is unassigned until saved and explicitly selected for a role. Rename preserves UUID.

Implementation choices within the approved scope: rename is the editor's Name field plus Save; Duplicate immediately
saves a copy under an available localized name and selects it for editing, without copying a key or activating it.
Profile and global preferences have separate Save/Cancel controls using existing atomic operations, so there is no
partially successful combined save. Assignments persist immediately on success, preserve editor drafts, and are
disabled during scene generation. Assigned deletion is disabled with a tooltip and remains blocked by main.
An editor remount resets optional-number/model widgets on selection or Cancel. Blank omitted keys remain saved;
explicit replacement/clear and changed-endpoint protection are retained. No storage-format or routing change.

Typecheck/build passed; 135 test files passed, 1,204 tests passed, one skipped. Six new library/store integration tests
cover preserved unassigned drafts, stable names/IDs/samplers/keys, rejected edits retaining bytes, keyless creation,
duplicate/deletion rules, and independent preferences. The real SettingsPanel in a disposable Electron preview
proxied calls through the owning renderer's real IPC; all LLM transport was mocked. Checks passed CRUD, unsaved Test
without writes, failed saves/assignments, discard cancellation/confirmation, deletion, busy role controls, preferences,
endpoint/key decisions, sampler selection, and language changes retaining drafts. Desktop/narrow layouts were seen;
narrow layout had one column and no horizontal overflow. Restart retained exact settings bytes, profiles, assignments,
preferences, backup count, and usable credentials with the mock. No age verification or full gameplay was performed.

Live data, original backups, the immutable archive, and all 74 findings remain preserved. No paid calls, commits,
or pushes. F001.5 is not implemented and requires its own reviewed plan and approval.

## F001.5 evidence — 2026-11-24

D-020 implements `MainConnectionSelector.tsx` at the top of the gameplay pause menu, alongside Settings. This
placement is an implementation choice stated before edits. It reads the existing safe view on each mount and
calls only the existing main-role assignment API. Selection publishes after persistence succeeds; pending writes
disable the control, and failures retain the old assignment with Retry. Reopening the menu refreshes profiles,
names, and assignments changed in Settings. App passes scene/foreground busy plus photo busy. Background operations
retain F001.3 snapshots; the switcher does not cancel or alter those requests. Label/tooltip identify the main
assignment rather than claiming the connection that will actually answer an NSFW/refused request.

No game-state, scene, history, undo, routing, schema, store, or IPC changes were needed. Typecheck/full suite/build
passed; 135 files, 1,204 passing tests and one skipped. Real rendered selector tests in a separate Electron preview
used the owning renderer's actual IPC and only mocked LLM transport. Initial-load Retry, busy guards, failed and
pending assignments, same-endpoint model/key/sampler switching, unchanged NSFW routing/assignment, Settings rename
and reassignment refresh, safe views, fixture state/history, and unchanged disposable save files all passed. Desktop
and translated narrow menus were seen; no horizontal overflow at 420px. Whole-app restart retained exact settings
bytes, selection, backup count, and usable selected credentials with the mock. No age gate was submitted or full
gameplay/packaged/hosted acceptance performed. Test windows were closed. Live data, original backups, audit hashes,
and all 74 findings remain preserved. No paid calls, commits, or pushes. F001.6 remains a separate approval gate.

## F001.6 evidence

D-021 tests passed typecheck, the full 1,204-test suite (one skipped), production build, and `npm run build:win`.
The initial packaging sandbox DNS failure was resolved by the approved network-enabled retry. Windows output is
`dist/win-unpacked`, target `dir`, unsigned. An isolated packaged copy used an alternate startup harness to set
user/session paths and mocked transport before loading unchanged application code. The native executable/original
ASAR stayed byte-identical; all 171 built files and 4,296 content files matched. The original release artifact was
not launched against live data. Packaged migration/credentials/CRUD/diagnostics/routing/snapshots/cancellation,
ten-second timeout, restart, corruption recovery, and unowned-renderer rejection passed.

The restored profile retained its previous age confirmation; no verification was submitted or flag bypassed.
Native UI loaded a real mid-scene save, switched B to A without changing any autosave bytes, sent a neutral mocked
reply, and showed the selector disabled during generation then re-enabled. Thirteen messages grew to fifteen.
The initial desktop obstruction was resolved by the owner bringing the test game forward.

Acceptance exposed ACC-001: App.start omits SaveData.turns, unchanged in baseline HEAD. Six saved undo records were
not handed to Game; after the next reply only the new record was saved. The corresponding seven-record assertion
failed. This is not a profile-switch regression and was not silently fixed. D-022 proposes the narrow repair;
unqualified acceptance and F-002 remain held. No production source changed during F001.6. Protected live data,
original backups, audit bytes and all 74 findings remain intact. Test processes/inspectors were closed. No paid
calls, live migration, release, commits, or pushes. Full evidence/limits are in F001_ACCEPTANCE_REPORT.md.

## D-022 repair and recheck — 2026-11-25

The owner approved the next step after the undo-fix proposal and summary. `resumeSavedGame` in shared/game/resume.ts
now owns the existing load-time state reconciliation/cast check and preserves saved turns only when the scene
survives it. App.start passes the complete SaveData through this helper. Game's existing unpack/pack/undo behavior
and save version are unchanged. No migration, profile/credential change, content change, or live-data rewrite.

Five new regression cases cover six saved records becoming seven after a new turn and round-trip/restart, older
scenes without turns, missing primary/companion rejection, and orphan records without a scene. Typecheck/full suite
passed: 136 files, 1,209 tests, one skipped. The first typecheck caught an incorrect money path in the new fixture;
it was corrected to player.money before validation. Production/Windows directory build passed with prior warnings.

A fresh instrumented packaged copy loaded the original six-record/13-message backup, switched main profiles through
the native menu, and sent a neutral mocked reply. The save then held seven records/15 messages; the earlier six
packed records were exactly unchanged. Native browsing reached a turn older than the new reply. Busy controls,
model/key/sampler selection, and re-enabling passed. Whole-app restart retained seven records, exact save/settings
bytes, assignments, backup count, and usable encrypted fixture credentials. All 171 built outputs/4,296 content
files matched; original test executable/ASAR were unchanged relative to the rebuilt artifact. ACC-001 is resolved;
the initial failure evidence is retained in F001_ACCEPTANCE_REPORT.md. Final owner acceptance remains pending.
Live data, original backups, archive hashes, and all 74 findings are intact. Test processes were closed. No paid
calls, live migration, releases, commits, pushes, or F-002 implementation.

## F-001 owner acceptance — 2026-11-25

The owner explicitly accepted F-001 as implemented and tested within the documented isolated-data and
mocked-endpoint scope (D-023). This closes F001.6's owner gate, including the repaired/rechecked ACC-001 defect.
The implementation, tests, original failure evidence, artifact hashes, and remaining validation limits are retained.
This update changes working documentation only. No release/live migration, real-provider/paid verification,
commits, pushes, new branch, or F-002 implementation is authorized. The next development gate is a separate P2.0
plan and approval under the existing dual-call roadmap.

## Privacy cleanup before publication — 2026-11-25

The owner requested privacy cleanup before making a local commit/push. Working status/acceptance documents now use
portable paths and generic backup/custom-add-on descriptions; detailed originals remain in the ignored local
verification area. The original audit archives and their hashes are unchanged. Root ignore rules also cover
accidental app-data/backup copies. docs/PRIVACY.md records the review scope and the separate author-email decision.
The Git index, configured identity, history, source implementation, and unrelated F-002 planning were left intact.
No staging, commit, push, Git identity change, archive rewrite, or user-data modification was performed.
