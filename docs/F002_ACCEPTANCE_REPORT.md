# F-002 P2.6 — local and packaged acceptance

Verified 2026-11-25 on `writer-manager`, HEAD `6788dfb0c6ea979a60e7ef35fb0eaf19ef73771c`.
D-033 authorizes this acceptance pass. P2.0–P2.5 supply the implementation; no production source, content, or
product behavior changed during P2.6. This report records local/mock verification, not the owner's final acceptance.

## Result

Typecheck, the full test suite, production build, and Windows directory packaging pass. The final packaged API
matrix has 25 successful scenario/check records and 52 scripted completions. The final full-app gameplay run
has 15 scripted completions and seven visually inspected captures. Restart preserves exact save/settings bytes.
No real-provider requests, live-data launch/migration, staging, commit, push, installer installation, or release.

| Check | Observed result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | 148 files pass; 1,490 tests pass, one existing skip |
| `npm run build:win` | Pass; production build plus Windows `dir` target in `dist/win-unpacked` |
| Packaging recovery | Initial sandbox DNS failure; approved network-enabled retry completed |
| Signing | Generated executable reports `NotSigned`; no signing/installer acceptance claimed |
| Built artifacts | All 169 built files match the original packaged archive |
| Loose content | All 4,296 files match source, release artifact, and disposable test package |
| Executable/archive | Release executable/archive and disposable original copies stayed byte-identical through testing |
| Production source | All 581 pre-P2.6 source/script files unchanged |
| Protected data | Live settings/saves/add-ons/Local State, original backups, and archive unchanged; all 74 audit IDs retained |

The existing Zod annotation and Phaser mixed-import build warnings remain. No new unit tests were necessary:
the implementation did not change, and the existing suite covers the deterministic operation and recovery rules.
Additional acceptance harnesses, fixture state, captures, and detailed inventories remain in the ignored local area.

## Packaged isolation and actual UI

Tests ran a disposable copy of the Windows executable with `app.isPackaged === true`. An added bootstrap in that
copy redirects userData/sessionData before loading the unchanged original application archive. The original
main, preload, renderer, and content are retained. The development data override is deliberately ignored in this
packaged run; actual user/session/storage paths and player add-on mode were checked. The release artifact was
never launched against live data. This is an instrumented packaged test, not an uninstrumented release launch.

Mock fetch accepts only named fixture endpoints, with keyless profiles; other runtime HTTP/HTTPS access is blocked.
No real provider, API key, or user conversation was sent. Build downloads are separate from runtime model traffic.
The v2 fixture converts once to v3 with an exact original-byte backup. Later startup retains settings and backup count.

The unchanged production App root was used, without the P2.5 component preview or reduced-motion override. Its
normal age confirmation was completed outside the harness in the disposable profile. The harness observed the
gate and waited for the title; it contains no confirmation click or localStorage write. The agent did not submit
age confirmation. Subsequent UI runs reused that profile's existing confirmation.

The Windows computer-use helper listed the test window but could not activate it (`foreground window did not
report a process id`); the test window closed after a harness assertion before the refresh attempt. Application
capturePage images and the owning renderer's actual DOM/IPC driver supplied visual and interaction evidence.
No alternate desktop input or age-gate bypass was used.

Full-app checks passed:

- Settings displays independent Writer/Manager assignments using arbitrarily named profiles.
- Dual turns commit validated notes and preserve ordinary bracketed prose.
- Reading back and submitting a replacement invokes real renderer redo: the superseded player line and its note
  disappear together, while earlier history remains.
- Two failed Manager attempts leave Writer text unpublished and the last committed save intact; explicit Retry
  uses the same draft without another Writer call.
- Scene closure persists completion, opens the existing summary, and saves a user-edited memory after Continue.
  Summary/spending use Main; unchanged feelings and zero spending do not manufacture relationship/economy changes.
- Older unmarked saves remain Legacy under a Dual next-scene preference and send no Manager request.
- Pause selectors show Writer for Dual and Main for Legacy.

Settings, Dual/Legacy scenes, held-reply recovery, the editable summary, and both selectors were inspected in seven
final screenshots. Captures wait for the real transition overlay to finish; no transition code was altered.
Early harness failures involved Legacy tool expectations, JSON undefined fields, a lecture fixture's actor/import,
an expression alias, summary comparison formatting, and the nonexistent Resume button. Those expectations were
corrected privately. They did not require production fixes. Initial captures taken mid-transition were replaced.

## Packaged API matrix and rule coverage

The 25 records include sequential steps in shared flows, not 25 independent random trials or a statistical quality
sample. Final records cover:

| Flow | Evidence |
|---|---|
| Paired neutral Legacy/Dual | Same visible text, including ordinary brackets; Main versus Writer/Manager routing |
| Group note → departure → private correction | Old listener retains her witnessed claim; remaining listener gets correction |
| Group completion | Two per-person summaries plus one spending request, all Main; departed prompt excludes private text |
| Save/load/undo/restart | Ledger, departures, packed undo, completion, profile IDs, and settings retained; exact disk round-trip |
| Opening lecture | Valid opening with no manufactured player line or undo record |
| Ordinary NPC | Valid dialogue without love-interest ledger/mechanics |
| Presentation/comfort | Valid expression applies; actual assessment history retained |
| Scene closure | Completion survives save/resume |
| Movement | Legal destination applies through existing movement logic and appends a beat |
| Meeting proposal/acceptance | Proposal card first, then existing appointment acceptance; no duplicate commit |
| Invalid actor/control leakage/prose conflict | Turn held without committing invalid effects; leaked Writer control stops before Manager |
| Manager failure/manual retry | One automatic retry, then a single explicit retry; same Writer draft |
| Explicit full regeneration | A held prose conflict reruns both roles with a fresh turn ID |
| Cancelled late Manager response | Discarded after cancellation |
| Connection arrangements | Shared profile, separate profiles at one endpoint, separate endpoints |
| NSFW | Flagged Writer routing and refusal fallback; Manager remains assigned |
| Captured mode | Open Dual turn works after global next-scene preference becomes Legacy |

The full suite additionally retains operation checks for restricted destinations, shared-event walking, sleep
settlement boundaries, event attendance, conception/birth-control deduplication, state-affecting poses, NPC
restrictions, receipt validation, note overflow/private resolution, credential and write failures, strict authorized
IPC, timeouts, stale/duplicate work, and background changes through commit/undo. These are automated rule tests;
this pass did not visually play every adult, event, or overnight path in the packaged UI. All narrative fixtures
used here are neutral. Existing deterministic rules remain the authority over proposed model effects.

## Configurations and measurements

Fixture language is English. Keyless OpenAI-compatible profiles use sentinel model names `main`, `writer`,
`manager`, `shared`, and `nsfw`, at blocked `.invalid` fixture addresses. Each stores temperature 0.8, max reply
tokens 1,024, timeout 120 seconds, and no explicit concurrency limit. These are test settings, not model advice.
The Writer and Manager parameters are preserved rather than overridden. The same-endpoint case verifies request
identity/routing, not an actual local server or model-loading behavior.

| Final matrix role | Requests | Input UTF-16 characters | Scripted output characters |
|---|---:|---:|---:|
| Writer, including NSFW | 23 | 360,824 | 818 |
| Manager | 25 | 527,523 | 5,735 |
| Main, including summaries/spending | 4 | 30,703 | 444 |

Successful matrix bridge responses took 49–157 ms; applying the shared session and acknowledging the result took
57–173 ms from request start in this recorded run. These are mock-only harness timings, not visible-response,
provider, queue, cold-loading, or network latency benchmarks. No real token usage or price is reported. Earlier
harness-development runs made additional scripted calls; the counts above describe final retained runs only.

P2.5's 122-case complete prompt comparison remains the size baseline: sampled Legacy prompts match, while combined
Dual inputs are larger. This pass establishes no writing-quality, token/cost, latency, or failure-rate improvement.
Native structured-output support and server concurrency/loading require actual provider-specific evaluation.

## Acceptance still owned by the user

Local/mock P2.6 verification is ready for review. Final owner acceptance of F-002 remains pending; it cannot be
inferred from the request to begin testing. Any real-provider/paid evaluation needs an agreed provider/model,
sample set, and budget. No such requests were made here. Broader subjective gameplay and the remaining visually
unplayed paths can be included in that review; no numerical performance targets have been invented.

BUG-001's original curly-braced/no-transition cause remains unconfirmed. Synthetic guards and successful neutral
fixtures do not establish its original cause or a Legacy fix. Bounded prose checks do not prove arbitrary semantic
consistency or consent. P2.0–P2.5 reports remain historical evidence, including their earlier UI limitations; this
report supersedes the production-root visual limitation only within the specific packaged cases above.
