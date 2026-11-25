# F-001 acceptance report

Verification was executed under D-021. The owner subsequently approved the narrow repair under D-022, and
**ACC-001 is resolved and rechecked as of 2026-11-25**. Profile and repair checks passed within the isolated-data/
mocked-endpoint scope. **The owner accepted F-001 within this documented scope on 2026-11-25 (D-023).**
F-002 has not started. The original failure evidence below is preserved.

## Scope and provenance

- Branch: `codex/llm-connection-profiles`; baseline commit `c804387d9660f0ea055d9ea7326004aa43ee8ee3`.
- Source stages F001.1–F001.5 were already approved. Initial F001.6 testing changed working documentation and
  disposable harnesses only. The separately approved D-022 repair changes App's session handoff and a small pure
  resume helper, with regression tests. No game content, dependency declaration, save schema, or settings format changed.
- All runtime mutations used disposable copies. No real-provider/paid LLM calls, live migration, commits, or pushes.
- Initial verification: typecheck passed; 135 files, 1,204 tests passed, one pre-existing conditional skip.
- After D-022: typecheck passed; 136 files, 1,209 tests passed, one skipped. Production and Windows builds passed again.
- `npm run build:win` passed, including the production build. The initial sandbox run could not resolve GitHub;
  the approved retry downloaded the build tools successfully. Output is `dist/win-unpacked/`, as configured with
  Windows target `dir`; it is not an installer or ZIP. Authenticode status is `NotSigned`.
- Existing build warnings: Zod PURE annotations, Phaser mixed static/dynamic imports, and missing package author.

## Acceptance matrix

| Scenario | Result | Evidence and limits |
|---|---|---|
| Legacy main-only, both roles, empty settings, meaningful incomplete secondary | Pass | Converter/store tests cover fixtures; packaged startup converted a full original backup with an exact-byte protected backup. |
| Restart after migration, edits, and gameplay selection | Pass | Source and packaged restarts retained settings bytes, UUIDs, assignments, preferences, and backup count; encrypted keys remained usable with the mock. |
| Two models at one endpoint | Pass | Packaged requests used distinct model IDs, temperatures, top-K values, and fixture keys for Acceptance A/B. |
| Different endpoints and keys | Pass | Packaged main/secondary requests used the intended endpoint and credential; edited endpoints required explicit key entry or clear. |
| Create, edit, rename, duplicate, delete | Pass | Store tests, rendered manager checks, and packaged real IPC preserved IDs, omitted duplicate keys, and blocked assigned deletion. |
| Main/NSFW routing and refusal fallback | Pass | Router/snapshot tests plus source/packaged runtime checks; main switching preserved the secondary reference and existing routing roles. |
| Test inactive/unsaved profile and fetch models | Pass | Rendered manager and packaged diagnostics used edited parameters without settings writes or assignment changes; responses did not expose provider bodies or saved keys. |
| Switch during an actual loaded scene | Pass for switching | Native packaged menu changed B to A while the actual autosave remained byte-identical: scene, state, 13 messages, and six stored undo records. Loading the undo records themselves failed separately under ACC-001. |
| Next request after switching | Pass | Native gameplay Send used A's model, key, and sampler; the mocked reply rendered and autosaved. Conversation history grew from 13 to 15 messages. |
| Busy requests, cancellation, timeout | Pass | Native menu selector disabled during paused generation and re-enabled after completion. Packaged cancellation and a captured ten-second timeout worked; independent diagnostics and the next selected request were unaffected. |
| Background jobs, summaries, tools, retries, endpoint queues | Pass within tested scope | Consumer/source review, full regression suite, tool-round transport tests, endpoint queue tests, and snapshot/fallback/runtime checks. Not an exhaustive full-game soak test. |
| Invalid input, failed writes, unavailable encryption | Pass within tested scope | Store/IPC tests and rendered failure injection preserved bytes/drafts and refused new plaintext keys. Packaged corrupt startup reported recovery while preserving the original invalid file. Unavailable-encryption cases were unit/service tests, not an OS-security configuration change. |
| Renderer views and authorization | Pass | Safe-view/diagnostic/error-redaction tests; packaged file-origin owning-frame calls passed, and a separate unowned renderer was rejected without receiving settings. |
| Existing saves, add-ons, packaged resources | Pass for tested compatibility | All backed-up slots were readable; a backed-up mid-scene save loaded visually. Every built output file and content resource matched its source. A historical fixture-only custom add-on validation warning was pre-existing; its corrected current version is untouched. |
| Existing saved undo history after load and another reply | **Resolved/pass after D-022** | Initial run failed with six records becoming one. The approved fix/recheck retained all six unchanged, added a seventh, exposed older history in the native UI, and retained seven across restart. Original failure evidence is below. |
| English/Chinese UI and narrow layouts | Pass | Manager/menu previews were visually checked in both languages/narrow layouts; all feature labels exist in both locales. Actual packaged scene/menu/selector/send controls were also seen. |

## Packaged runtime method

Packaged builds intentionally ignore the development data override. To keep the player profile untouched, testing
used `.dev-data/f0016-package/`, a disposable copy with a small alternate startup archive. That harness set both
`userData` and `sessionData` before requiring the **unchanged original application archive**, installed the mocked
transport, and opened a loopback-only inspector. `app.isPackaged` was true. The original executable and original
application ASAR were byte-identical to the build. Chromium storage, saves, add-ons, and settings used only the
disposable user-data directory. The original `dist/win-unpacked` artifact was not modified or launched directly
against live data.

The restored test fixture retained its existing age-gate state and reached the title screen naturally;
no verification was submitted and no confirmation flag was set or bypassed. Computer Use loaded the backed-up
scene, switched profiles in the actual menu, sent a neutral test reply through the actual Send control, and saw
the disabled/re-enabled selector and returned mock. The desktop initially obstructed the target; the user brought
the isolated game forward before native interaction resumed. No action was taken against the covering app.

Checks compared all 171 built output files and 4,296 content files. Initial failing-build hashes (historical; that disposable archive is retained):

| Artifact | SHA-256 |
|---|---|
| `Breedhaven Dating Sim.exe` | `778b92a5228f8fba77a4cfd30010314a34589499bbec93e40581531c78a4ee77` |
| Original `resources/app.asar` | `2b57b4b631c09bf4d1cdad6eadc2592edb0ae11f1a44ffb616faf9e17f6a9eda` |

## ACC-001 — saved undo records are dropped during load

This is a new acceptance observation, not a renumbering or deletion of any of the 74 archived findings.

Confirmed source behavior at the initial failing checkpoint (before D-022):

1. `src/renderer/src/App.tsx:312` destructures only `state` and `scene` from `SaveData` and creates session data
   without `turns`. Continue and load callbacks use this entry point.
2. `App.tsx:415` initializes undo from `initial.turns ?? []`, so the loaded session starts without the saved records.
3. The initial autosave is intentionally skipped (`App.tsx:497`), which leaves the old records on disk until a
   later state/scene change saves the session again. Thus a profile switch can preserve the existing file bytes
   even though loading already omitted undo in memory.
4. `git show HEAD:src/renderer/src/App.tsx` confirms the same loader omission in the original baseline commit.
   F001.1–F001.5 did not alter this loader or the undo initialization.

Packaged reproduction on disposable data:

- Before loading: 13 scene messages and six packed undo records.
- Continue loaded the scene. Native menu switching left the autosave byte-identical.
- A new mocked reply succeeded: 15 scene messages, but only one packed undo record remained.
- That record contains the new test input and points back to the original 13-message scene. The earlier six were
  not carried into the session. The test assertion requiring seven records failed and is retained as a real
  acceptance failure; it was not waived or rewritten as passing.

### Original repair proposal — subsequently approved as D-022

Carry `SaveData.turns` into session data whenever the saved scene survives existing content/cast validation. Clear
the associated undo records when that scene cannot be resumed. Keep state reconciliation, settings, credentials,
save format, and game mechanics unchanged. Add a regression at the load-to-session boundary verifying that six
saved records reach the session and become seven after one new turn; also verify that a rejected scene does not
retain unrelated undo records. Repeat typecheck, the full suite, production/Windows build, and the packaged load,
switch, reply, and restart smoke checks.

The owner approved this narrow repair on 2026-11-25. The initial hold is resolved by the implementation and
recheck below. Final feature acceptance was subsequently recorded under D-023; rollout/F-002 scope still require
the owner's separate decision.

## Preservation and remaining limits

Final hash checks confirmed that live user data, both original backup folders, the immutable audit archive, and all
74 findings are unchanged. Tests changed only disposable copies; no original backup was refreshed from modified
test data. Test windows and inspectors were closed. Stage-specific summaries are in Git-ignored `.dev-data/`;
they contain pass/fail metadata rather than exported keys or conversation text. Original user-data copies and
migration backups there remain private local fixtures, not release artifacts.

Hosted-provider behavior, real generation cost, dialogue quality, unsigned-distribution trust prompts, and a broad
playthrough of unrelated mechanics were not validated. Runtime acceptance used an instrumented packaged copy,
not an uninstrumented release against the live player profile. No provider credentials/cost approval, release
authorization, commits, pushes, or F-002 implementation is implied by this testing approval.

## D-022 resolution and acceptance recheck — 2026-11-25

`src/shared/game/resume.ts` now returns reconciled state, the scene surviving the original cast validation, and
that scene's saved packed turns. `App.start` forwards the complete SaveData into this helper; it no longer drops
the turns. If the scene is absent/rejected, its undo records are cleared. There is no save migration or new format;
existing valid saves and saves without turns remain supported. The fix preserves records that still exist; it
cannot reconstruct records already lost in an older save.

Five new tests exercise the load-to-session boundary and actual pack/unpack/rewind functions. Six records survive
loading, a seventh turn, serialization, and resumed loading; earlier decoded snapshots and input data stay intact.
Missing primary/companion scenes, orphan records, and older scenes without undo are covered. Full suite: 136 files,
1,209 passing tests and one skipped; typecheck, production build, and Windows directory build pass.

Fresh `.dev-data/acc001-user-data/` and `acc001-package/` copies repeated the packaged failure scenario with the same
isolating harness and mocked transport. Native UI loaded the original 13-message/six-record scene, switched B to A,
and sent a neutral test reply. The reply used A's model/key/top-K, with the busy selector disabled/re-enabled.
The resulting autosave contained 15 messages and **seven undo records**. Its first six packed records exactly
equaled the original six. Native history browsing reached "2 turns back," proving an older saved turn was usable
without rewriting it. Whole-app restart retained seven records, exact settings/save bytes, assignments, migration
backup count, and usable encrypted fixture credentials. Test app/inspector were closed.

The rebuilt artifact and disposable original executable/ASAR remained byte-identical; 171 output files and 4,296
content files match. Rechecked build hashes:

| Artifact | SHA-256 |
|---|---|
| `Breedhaven Dating Sim.exe` | `d28432737a978ccfb71599bdd1bcf699331aef3579cdece4ad9a2c81910a4097` |
| Original `resources/app.asar` | `86656894f3332aad2727d6545ee7e39c253d2cc57139cee429c84c378c60ff4a` |

Live data, both original backup folders, audit archive hashes, and all 74 original findings are unchanged. ACC-001
is resolved in source and verified on isolated data; original failure evidence remains above. No remaining
identified blocker prevents owner acceptance within the approved mocked/isolated scope. Hosted-provider/paid
validation, uninstrumented live rollout, broad game soak testing, releases, commits, pushes, and F-002 remain outside
this approval. The owner subsequently signed off this documented scope under D-023.

## Owner acceptance — 2026-11-25

> I accept F-001 as implemented and tested within the documented isolated-data and mocked-endpoint scope.

Recorded as D-023. F-001/F001.6 is accepted and closed within that scope, including the verified ACC-001 repair.
The documented test limits remain attached. This acceptance does not authorize live-data rollout, real-provider/
paid tests, release, commits, pushes, or F-002 implementation. No source or user-data change accompanies this record.
