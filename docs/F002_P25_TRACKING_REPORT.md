# F-002 P2.5 — tracking, summary context, and controls

Verified 2026-11-25 on `writer-manager`, HEAD `6788dfb0c6ea979a60e7ef35fb0eaf19ef73771c`.
The owner requested this step under D-032. No staging, commit, push, release, live-data launch, or paid-provider call.

## Implemented behavior

Settings → LLMs now exposes Generation mode, Writer LLM, and Manager LLM. Assign any configured saved connection
to each role; their names are arbitrary and they may share one profile. Dual-call cannot be enabled until both
roles are configured. Main and NSFW assignments remain separate. Assigned profiles cannot be deleted, and Dual
roles cannot be cleared while Dual-call is selected. Changes use strict authorized IPC and atomic settings writes.

Normal application startup now opts into the existing protected version-3 converter. Older settings receive one
exact original-byte `settings.json.pre-v3-*.bak` before conversion. Existing profiles, role references, preferences,
and credential values are retained. Converted installations start in Legacy with Writer/Manager unassigned. The
compatibility connection API still returns its v2-shaped library view; its mutations preserve v3-only settings.
This implementation was exercised only with disposable data; the owner's live files have not been migrated.

Mode changes apply to the next scene. An open scene keeps its captured mode, including after save/reload/undo.
Older scenes lacking generation metadata resume in Legacy regardless of the global preference. New scenes capture
the preference and a fresh identity. The gameplay selector switches Main for Legacy and Writer for Dual; Manager
is assigned in Settings. Profile changes affect the next turn; retries retain their original profile snapshot.
An open Dual scene can finish after the next-scene preference changes back to Legacy. NSFW continues its approved
Writer-only routing/fallback role, with no Manager fallback across profiles.

The encounter ledger retains at most 128 validated entries. Corrections and resolutions append self-contained
versions with their own receipts and audience; they do not rewrite earlier claims. A character sees a version
only when she heard every supporting receipt. A private resolution therefore leaves an unaware listener's old
promise intact. Receipt message positions, original turn identity when known, turn ordinal, and game time are
engine-owned metadata. Manager wire output is unchanged.

Exact duplicates consume no slots. Repeated optional claims with the same claim, quoted speakers, and audience
can coalesce across repeated utterances; separate promises/plans retain their event identity. Retention prefers
fully superseded entries, then closed entries, then oldest optional claims. Unresolved promises/plans remain pinned.
Eviction must not expose a previously hidden older version in anyone's view. Remaining provenance links are
rewired around an evicted ancestor without changing claim text or audience. If no safe slot exists, the new
candidate is omitted, a dropped counter advances, and a compact tracking-limited status appears; play continues.

Historical witness ranges and beat audiences are recorded as bounded engine data. Arrivals hear subsequent lines;
departures close the range after the validated reply. Unknown old audiences are not reconstructed or assigned
retroactively. Witness/beat/turn records have 128-item bounds; witness/beat exhaustion marks limited tracking.
The last two actual comfort assessments per character are stored separately from disclosed information. These
fields are optional, so earlier Dual metadata remains readable. Save version stays 1. Invalid boundaries or note
receipts use the existing unreadable-save path; structurally valid notes about removed content stay stored and
are excluded from invalid prompt targets.

Writer history and scene beats carry audience labels and omit context nobody currently present heard. Each
character's Writer/summary note view is capped at eight entries and 4,096 serialized characters. Manager receives
up to twelve valid targets within 12,000 serialized characters, prioritizing unresolved commitments. These are
implementation bounds within the reviewed contract ceilings, not new gameplay mechanics or model overrides.

Existing completion summaries use that character's witnessed transcript and notes. Untracked global beat summaries
are omitted from Dual summary context. The existing 12,000-character transcript truncation, summary/evaluation
routing, discovery validation, memory editing/retry, and deterministic relationship rules remain. Notes grant no
immediate meters or discoveries. Spending still uses the authoritative player transcript; ordinary NPCs do not
gain the love-interest ledger or mechanics.

## Verification

| Check | Observed result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test` | 148 files pass; 1,490 tests pass, one existing skip |
| `npm run build` | Pass; existing Zod annotation and Phaser mixed-import warnings |
| New regression coverage | 15 ledger/witness/prompt/save tests, nine settings/IPC checks, one captured-mode IPC check |
| Contract parity | Reviewed Manager, note, generation, and optional Scene types match source bidirectionally |
| Original saves | All 13 original backup saves parse, read-only |
| Legacy prompt comparison | All 122 sampled complete Legacy prompts match the prior builder |
| Data boundaries | 574 prior source/script files checked; 26 intended modifications, 548 unchanged; no prior file removed |
| Protected originals | 373 backup files, 20 backup documents, six archive files unchanged; all 74 historical finding IDs retained |
| Live files | Settings, saves, add-ons, and `Local State` unchanged; save/add-on file membership unchanged |
| Localization | 12 new keys per locale in this step, 25 across F-002; existing English/Chinese values unchanged |

The production App root stopped at its existing age gate; no confirmation was submitted or flag changed. UI
verification therefore used a separate neutral component preview of the actual Settings, title, and Game
components, with the compiled main/preload and owning-frame IPC. A private build transform exposed Game in memory;
production source was not modified for the preview. Disposable settings/saves lived under the ignored test area.
All transport was mocked at a strict fixture endpoint, and other network access was blocked. Sixteen mocked
completions and zero real-provider requests were observed.

The preview verified exact startup backup, independent assignments with arbitrary connection names, enabling mode,
a committed Dual turn/note, unpublished Writer text during Manager failure, one automatic Manager retry, explicit
Retry reusing the draft, Cancel restoring input and last committed save, pinned open-scene mode, old saves using
Main/Legacy, new NPC scenes capturing Dual, NPC restrictions, and role-aware pause selectors. Settings, held-reply
dialog, both selectors, and neutral active love-interest/NPC scenes were visually inspected in six captures.
The hidden-window scene wipe did not finish reliably; the final preview invoked the existing reduced-motion path
to inspect the NPC scene. This is component/layout evidence, not production-root or transition-animation acceptance.
Early harness asset/version/stub failures were corrected privately; they were not production fixes.

## Prompt measurement and remaining acceptance

The same 122 neutral opening cases cover 40 solo, 40 group, 40 NPC, and two lecture cases across English/Chinese.
Measurements count UTF-16 characters in complete builder strings, excluding transport language/profile suffixes
and tools. Synthetic replies and empty opening ledgers are used; populated note budgets are pinned by unit tests.

| Language | Mean Legacy | Mean Writer | Mean Manager | Mean combined Dual |
|---|---:|---:|---:|---:|
| English | 13,146 | 13,902 | 19,723 | 33,626 |
| Chinese | 11,079 | 11,000 | 18,353 | 29,353 |

Combined inputs remain larger than Legacy in this sample. Character counts do not establish tokens, price,
latency, provider schema support, creative quality, or reliable interpretation of arbitrary prose. Existing
bounded consistency checks and explicit regeneration remain necessary; matching evidence is not proof of consent.
BUG-001's original curly-braced/no-transition cause remains unconfirmed, and this is no claim of a Legacy fix.

P2.5 is complete within the stated local/mock scope. P2.6 still needs broader gameplay/completion and group/lecture
acceptance, the unmodified production root after the user's normal age confirmation, and any separately agreed
real-provider compatibility/quality/latency/cost evaluation. No provider or release acceptance is claimed here.
Detailed private fixtures, screenshots, and hashes remain in the ignored local verification area.
