# F-002 P2.4 — complete-turn application

Implemented and verified within the local/mock scope below on 2026-11-25. Branch: `writer-manager`, HEAD `6788dfb`.
The owner's request to begin P2.4 is recorded as D-031. Previous phase work and staged files are retained.

## What now exists

The Writer/Manager result can cross the owning-frame IPC bridge, produce explicitly typed game effects, and become
one committed renderer session update. A pending turn holds preparation privately: the visible committed state,
scene, undo history, and saved completion remain unchanged until the result is accepted. Pending user text can be
shown in the dialogue view without becoming the saved conversation. No generic game-state patch is accepted.

The renderer now owns its state, scene, turns, and completion flags through one focused session hook/reducer.
Legacy still follows its existing `chat` and effect application path. The Dual branch uses the new staged path:

1. Capture the state after already committed player actions. Prepare due arrivals, meeting/stranger/present context,
   the submitted line, and its cue without publishing those changes. Gifts/plans already committed before Send are
   retained when the reply is cancelled.
2. Main captures connections/content, runs the existing two-role service, and validates Manager output. Shared code
   converts validated operations to the existing explicit effect families. Known material inconsistencies enter the
   bounded Manager retry/Regenerate recovery; failed output is never replaced by a no-change envelope.
3. A matching ready result applies birth-control changes and their core memory, then deduplicated conception rules,
   then movement/time, appointment acceptance, attendance, and deterministic contacts. Presentation and comfort use
   existing helpers, including pregnancy variants, moment suppression, group poses, reaction ownership, and skill floor.
4. Append dialogue, retain sticky NSFW routing, update proposals and conceived IDs, then apply departures/lead changes
   and behind markers. Departing characters hear the complete departure reply. Movement retains its established
   departure precedence regardless of Manager operation order.
5. Reconcile validated note changes, record the turn identity/ordinal and completion intent, and publish state, scene,
   undo, and completion together. Only an accepted commit publishes reply audio, catchphrases, achievements, notices,
   learned contacts, and debugging input. Sleep/shared-event settlement stays in the existing completion flows.

Independent updates use the exact existing `KEPT_ACROSS` field set. Commit begins with those current background
values and then applies turn effects, so background messages/posts and newly granted contacts both survive. Foreground
setters cannot change the pending checkpoint. Old video completion is deferred: cancellation/undo clears the old pose,
while a newly committed pose remains intact. Session/foreground/content identities and the pending turn ID reject
late or duplicate results. Undo restores completion and generation metadata together with state/scene.

## Recovery and ownership

The preload exposes narrow info/begin/retry/regenerate/cancel/invalidate/acknowledge calls. Main validates request
shapes and the existing trusted owning frame before accessing settings or generating text. Renderer input cannot
supply connection credentials, a Manager envelope, or a privileged owner identity. Main retains its private draft;
held results contain bounded diagnostics/actions rather than unpublished Writer text or raw Manager JSON.

Manager still gets at most two automatic attempts, including format downgrade; explicit Retry adds one Manager
attempt. Regenerate is accepted only for the appropriate held result, uses a new turn ID, and reruns both roles.
The renderer preserves the submitted input on cancellation/failure, guards duplicate recovery clicks, and keeps
foreground controls busy while a draft is held. Localized recovery dialogs use the existing Dialog/Button components.
Load/exit, renderer navigation/destruction, replacement sessions, content changes, and cancellation invalidate old work.
Acknowledgement releases the private candidate; losing an acknowledgement cannot make a duplicate commit valid.

## Saves and notes

`SceneSchema` has optional generation metadata using the reviewed contract. Old scenes without it remain Legacy.
The save version remains 1. Only committed scene identity, ordinal, last turn ID, completion intent, and the bounded
note ledger are saved; credentials, pending drafts, Manager JSON, and transport traces are not. Ledger receipts are
checked against actual saved message text/roles. Packed undo records validate optional generation metadata too.

Notes can be recorded, resolved, and superseded without mutating the prior undo snapshot. At capacity, resolved or
superseded entries go first, then optional entries; unresolved promises/plans are preserved. If nothing can be removed,
play continues and the saved ledger records limited tracking. Current source receipts retain exact UTF-16 message
offsets and their audience. Unknown historical audiences conservatively remain empty rather than gaining new witnesses.

This is the minimum working persistence/reconciliation foundation. P2.5 still owns the complete encounter-tracking
integration: richer historical witness reconstruction, reconciliation/deduplication evaluation across long encounters,
supporting context for the existing summaries/evaluations, and reviewed mode/profile controls. Existing summaries and
durable discoveries/meters retain their old authority; notes do not grant them directly.

## Consistency boundary

All existing operation eligibility, actor/source/evidence, asset, and conflict checks still run. Manager is explicitly
instructed to compare consequential prose with the proposed effects/options and report disagreements. Independent
code checks additionally hold recognized unsupported travel/departure narration, explicit player-agency violations,
birth-control/nudity contradictions, closed intimacy gates, and unsupported exact meeting times. Exact meeting-time
checks require a supported preflight offer reference or captured pending proposal; human-readable preflight times
and schedule/status identifiers are provided to the roles. Lecture openings retain the existing token minimum using
the actual Writer/NSFW profile.

These are bounded checks, not proof of arbitrary natural-language meaning or consent. Manager remains the semantic
reader; exact quotations alone do not establish meaning. Varied wording, language/model quality, false positives,
and longer encounters need later provider/acceptance evaluation. No third model call, automatic Writer regeneration,
arbitrary state edits, new gameplay rule, or character tuning was introduced.

## Verification

| Check | Result |
|---|---|
| New focused tests | 56 pass across three files |
| `npm run typecheck` | Pass |
| Full `npm test` | 146 files pass; 1,465 tests pass; one existing skip |
| `npm run build` | Pass with existing Zod annotation/Phaser mixed-import warnings |
| Mocked complete-turn integration | Preload → authorized IPC → Writer/Manager → application → save parse/restart → undo passes |
| Actual serializer under mocked fetch | Correct role requests; no executable tools |
| SaveStore disk test | Pending work excluded; committed metadata/notes/completion/undo survive restart |
| Compiled Electron hidden API smoke | Fresh isolated user/session storage; v2 startup; Dual unavailable; optional metadata round-trip; zero network/provider requests |
| Original backup saves | All 13 still parse, read-only |
| Legacy prompt comparison | 122 sampled outputs exactly match the earlier builder |
| `git diff --check` | Pass |

Tests cover operation ordering, cards versus booked plans, movement departure precedence, conception deduplication,
lead changes, witnesses/offsets, transient poses, known prose conflicts, stale/duplicate/cancelled results, foreground
guards, background merging, reload/destruction/content changes, ownership, bounded retries, explicit regeneration,
completion restore, metadata corruption, note-cap continuity, and undo without resurrecting an ended video.

The hidden runtime test exercised actual compiled main/preload/renderer API registration and save storage. It did
not play a Dual scene or visually inspect the recovery controls. No age-gate flags were changed. Interface changes
have **not been seen in the running game**. There were no real-provider/paid calls, live migration, release, commit,
or push. Final visual/gameplay/provider acceptance is outstanding.

## Prompt measurements

The current builders were measured over the same 122 shipped-content cases across English/Chinese: 40 solo,
40 two-character, 40 NPC, and two class-opening cases. The synthetic neutral reply and new-game state do not model
a long encounter or populated note ledger. Counts include system/message strings and embedded Manager schema, but
exclude profile instructions, transport language suffixes, native-format serialization, and Legacy tool definitions.

| Language | Mean Legacy | Mean Writer | Mean Manager | Mean combined Dual |
|---|---:|---:|---:|---:|
| English | 13,146 | 13,645 | 19,692 | 33,337 |
| Chinese | 11,079 | 10,849 | 18,321 | 29,170 |

These are UTF-16 character counts, not tokens or bills. Combined Dual input remains larger in this sample. No cost,
latency, or writing-quality improvement is claimed. Local scripts and detailed rows remain in ignored development data.

## Data boundaries and next checkpoint

Live settings, saves, add-ons, and `Local State` retain their baseline hashes. The original 373-file user-data backup,
20-file document backup, six archived files, and all 74 historical finding IDs remain intact. Of the 554 prior
source/script/config files, thirteen intended files now differ across P2.3/P2.4; the other 541 are unchanged. Earlier
staged work and branch/HEAD are retained. Previous English/Chinese string values are intact; new feature strings and
the new Manager instruction are the only locale additions/adjustments. No catalogue, curriculum, or character tuning.

Normal startup still uses version-2 connection settings; no user-facing Dual mode switch or live v3 conversion has
been enabled. The new IPC path reports unavailable under that default. BUG-001's original Legacy cause remains
unconfirmed; these new guards are not a retrospective fix claim. Next: P2.5 tracking/completion context and reviewed
controls, followed by the remaining visual/gameplay/provider acceptance work.
