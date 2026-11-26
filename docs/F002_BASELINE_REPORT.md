# F-002 P2.0 baseline report

Date: 2026-11-25. Scope: owner-approved baseline, backup/restoration/isolation verification, and synthetic transition investigation.
Dual-call application implementation has not started. No live-provider generation was performed.

## Source and scope

- Branch: `writer-manager`, selected by the owner before P2.0.
- Commit: `6788dfb0c6ea979a60e7ef35fb0eaf19ef73771c` (`added connection profiles`).
- The working tree was initially clean. This commit contains the accepted F-001 implementation; older descriptions
  of its uncommitted working tree are historical checkpoints.
- Runtime application source, shipped content, settings schemas, prompts, and gameplay behavior were not changed.
- New comparison files: `src/main/ai/fixtures/transitionBaseline.json` and `src/main/ai/transitionBaseline.test.ts`.
  Temporary harnesses and private manifests are confined to Git-ignored `.dev-data/p20/`.

## Commands and actual results

| Check | Result |
|---|---|
| Initial `npm run typecheck` | Passed |
| Initial `npm test` | 136 files passed; 1,209 tests passed; one existing skip |
| `npm run build` | Passed; existing Zod PURE-annotation and Phaser mixed-import warnings |
| Focused comparison tests | Ten passed before the additional tools-rejection case was added |
| Typecheck after all eleven scenarios | Passed |
| Full suite after all eleven scenarios | 137 files passed; 1,220 tests passed; one existing skip |
| Hidden Electron/API smoke | Eleven scenarios passed through the unchanged built application; fifteen mocked completion requests |
| Protected-tree/application-source comparisons | Passed; details below |

The full suite ran with loopback mock-server and Windows junction permissions unavailable in the restrictive sandbox.
The hidden Electron process also required launch permission. No package build, visible gameplay acceptance,
real-provider quality evaluation, or provider latency/cost benchmark is claimed for P2.0.

## Backups, restoration, and isolation

Both original backup trees match the earlier F-001 SHA-256 manifests: 373 user-data files and twenty documentation
files. The five archived source documents match `docs/audit_archive/SHA256SUMS.txt`; the full archive including that
checksum file matches the historical manifest. All 74 original audit finding IDs remain present.

A fresh copy of the original user-data backup under `.dev-data/p20/restored-user-data/` matched every original file.
All thirteen saves parsed and loaded through `SaveStore`. Restored settings validated through the existing pure
conversion/schema path without writing or decrypting credentials. Restored content loaded in player add-on mode with
its one previously documented historical add-on issue. The restoration remained byte-identical after validation.

The actual runtime used separate `.dev-data/p20/runtime-user-data/` with synthetic, keyless version-2 settings and a
new state from shipped content. No private saved conversation or restored credential was used for generation. A
public destination was chosen from `sceneDestinations` for that state.

The hidden harness set `BREEDHAVEN_USER_DATA_DIR` and loaded unchanged `out/main/index.js`; the application's own
development-path logic selected the disposable path. Assertions checked actual Electron `userData`, `sessionData`,
Chromium storagePath, editor add-on path, and player add-on mode. The complete suite separately checks path overlap
and junction/symlink redirection. The harness intercepted a synthetic `.invalid` completion URL, rejected unexpected
main-process fetches, and blocked renderer HTTP/HTTPS requests. It sent fifteen mocked requests, attempted no
unexpected fetches, and made zero real-provider calls. No age-gate state was set or changed. The process closed.

All 376 current live user-data files were readable and SHA-256 identical before and after the checks: no missing,
extra, or changed files. Original backups, archive bytes, and pre-existing application source also remained unchanged.
Private detailed manifests are not copied into working documentation.

## BUG-001 clarification and comparison evidence

The owner clarified the original symptom during P2.0:

> They appeared by themselves at the end of the turn in the dialogue box within a pair of { } brackets. No actual scene transition took place.

This establishes the reported shape and outcome. Exact interior text, original raw provider output, model/provider,
tool support, and triggering state remain unknown. This is owner-reported history, not newly captured original output.

Constructed examples include `Come on, then.` followed on a separate line by either `{move_scene: shop}` or
`{"name":"move_scene","arguments":{"place":"shop"}}`. Both reproduce the symptom shape in the current pipeline:
the standalone trailing command survives in visible message text and no movement proposal is returned. `dialogueLines`,
used by `SceneView`, preserves it as a separate display beat. The dialogue box was not visually inspected in P2.0.

All eleven scenarios run against the fixture pack in tests and against shipped content through the hidden runtime,
substituting a valid public destination for `shop`. Expected legacy leaks are preserved for comparison; these are not
Dual-call success tests.

| Synthetic case | Command survives in display text | Validated movement proposal |
|---|---|---|
| Ordinary `[meet after class]` prose | No command; ordinary brackets preserved | None |
| Closed `[MOVE: shop]` / `[HOURS: 1]` | No | None |
| Full-width closed movement/time tags | No | None |
| Truncated `[MOVE: shop` | Yes | None |
| Curly-braced tool JSON in final prose | Yes | None |
| Curly-braced command in final prose | Yes | None |
| `move_scene(...)` in final prose | Yes | None |
| Provider rejects tools; retry returns curly command | Yes | None |
| Real tool call with intermediate command text; clean final prose | No | One |
| Real tool call followed by curly command in final prose | Yes | One |
| Invalid-destination tool call; clean final prose | No | None |

Observed source behavior:

1. `src/main/ai/openai.ts` executes the provider message's `tool_calls` entries. Tool names or JSON written inside
   `message.content` do not execute tools.
2. `parseDirectives` in `src/shared/game/scene.ts` removes recognized closed legacy movement/time tags without
   authorizing movement. Arbitrary curly-braced objects and an unfinished movement tag remain ordinary text.
3. A proper `moveTool` validates its destination and reports it through a callback. Intermediate text beside a real
   tool call is excluded from the final reply. Commands in final prose can still remain visible.
4. A synthetic HTTP 400 saying tools are unsupported causes a retry without the request's `tools` field. The system
   prompt still mentions `move_scene`; a scripted curly command then remains visible and causes no move. This is a
   demonstrated possible path, not proof that this provider condition caused the owner's original incident.

Tests cover the real router/client, movement tool, parser, display-beat conversion, unchanged input snapshots, and
pure movement application. The hidden runtime covers the real preload/chat IPC and main handler, checking returned
text, movement proposals, routing, time/closure fields, request counts, and tools-removal behavior. It does not invoke
the renderer's full `App.send` routine or visually verify scene transitions.

## Status and next gate

P2.0 baseline, restoration, isolation, and synthetic comparison work is complete within the approved local/mock scope.
BUG-001 remains open: the symptom shape has synthetic reproductions, but original exact output and cause remain
unconfirmed. No runtime fix was made, and M0-055 is not marked resolved. Passing Legacy baseline tests intentionally
include leaks and must not be cited as proof F-002 fixes them.

P2.1 contract review is next: complete the operation/side-effect inventory, Writer/Manager inputs and typed outputs,
preflight and ambiguity examples, commit ordering, ledger bounds, persistence, fallback, mode switching, and regeneration.
Later Dual-call implementation remains separately gated. Its regression criteria must distinguish visible leakage
from actual movement, preserve ordinary brackets, and cover provider capability failures and malformed controls.

No live settings/saves/add-ons/credentials, runtime source, shipped content, or archived originals changed. The agent
created no branch and performed no commit, push, paid request, or rollout.
