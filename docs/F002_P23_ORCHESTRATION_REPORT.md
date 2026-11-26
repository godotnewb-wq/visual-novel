# F-002 P2.3 — dormant assignments and two-call orchestration

Verified 2026-11-25 on the owner-selected `writer-manager` branch at `6788dfb`.
The owner's approval of the next step is recorded as D-030. Earlier phase work and staged files are retained.

## Implemented behavior

- Independent Writer and Manager references to the existing connection library, including shared-profile assignments.
  Main and NSFW remain independent. Existing role types and interface controls retain their Legacy meaning.
- An explicitly opted-in version-3 store extension with pure conversion from legacy/version-2 settings. Conversion
  keeps identities, names, parameters, instructions, preferences, and credential values; defaults to Legacy with
  unassigned Writer/Manager. Existing files get one exact, uniquely named pre-v3 backup before atomic replacement.
  Plaintext credentials require encryption before conversion can write. Existing encrypted values need no decryption
  for migration. Assignment writes retain stale-file checks and rollback behavior; assigned profiles cannot be deleted.
- Credential-free views and captured Writer/Manager/NSFW credentials, parameters, language, scene, and content.
  Changing a connection while Writer is running cannot change Manager or a held retry.
- A single-attempt transport without executable tools, implicit retry, or prose cleanup. It retains Manager JSON
  exactly, handles explicit provider refusal metadata, rejects tool output/truncation/empty results, redacts error
  details, enforces request timeout, and uses the existing endpoint concurrency queue.
- Separate localized prompts. Writer retains existing character knowledge, secrecy/agency constraints, scene context,
  comfort, and lecture behavior while game-generated tag/tool duties are omitted. User-authored instructions remain
  intact. Manager receives its schema, source registry, cast/rule/presentation identifiers, selected history/notes,
  and legal options rather than a copy of Writer's full system prompt. Media paths and credentials are excluded.
- Deterministic preflight of destinations and all thirteen existing delay values, schedule conflicts, shared next
  events, pending proposals, sleep eligibility, and group poses. Up to twelve meeting offers retain supplied offers
  first, then explicit request matches, then deterministic local alternatives using the existing meeting planner.
  None of this accepts an invitation or changes state. Later consistency review still owns exact-time prose claims.
- Sequential Writer then Manager execution. Flagged scenes and Writer refusals retain NSFW routing; Manager remains
  on its assigned connection. Ordinary Writer transport failures do not cause NSFW fallback.
- At most two automatic Manager attempts, including any native-format downgrade. Further explicit Retry Manager
  performs one attempt with the same unpublished Writer/context/snapshot. Writer failure or unresolved explicit
  prose/state conflict offers Regenerate/Cancel; regeneration uses a new turn identity and reruns both roles.
- Owner/session/token checks, cancellation during a running request, session invalidation, stale revision rejection,
  late-response rejection, guarded concurrent retries, and one-time acknowledgement of validated candidates.

Native schema output requires an explicitly verified capability bound to the captured profile ID, address, and model.
Unknown or changed capabilities use plain JSON. A specifically unsupported native format can downgrade within the
same Manager attempt budget. Both routes use the same strict parsing and mechanical validation. Actual provider
capabilities have **not** been measured or inferred from mock success.

Writer source records preserve raw canonical lines, speaker attribution, and offsets into the unpublished reply.
Teacher/extra voices remain distinct from unattributed narration, so a teacher's statement cannot authorize the
solo love interest's birth-control change or disclosure. Historical audiences are supplied by the engine; no current
cast is retroactively assigned as witnesses to an old line. Manager history is bounded to six complete sources and
12,000 characters without cutting an evidence source in half.

## Activation and application boundary

Normal application startup still creates the established version-2 store. Only explicit service/tests opt into the
version-3 extension; a version-3 file is never silently downgraded. This stage has no mode-enabling operation, and the
opt-in store refuses premature persisted Dual mode. The dormant service accepts a prepared Dual request for isolated
tests but is not instantiated by application startup or exposed through IPC/preload/renderer controls.

A `validated` service result is privileged candidate data with `requiresConsistencyReview: true`. It is **not** a
permission to publish dialogue or commit effects. No failed Manager response is replaced by a no-change envelope.
P2.4 still owes material prose/state consistency, all effect application and ordering, exactly-once turn commit,
background merges, input recovery, last-committed saving, undo, and minimal compatible scene metadata. P2.5 owes
finished note retention/witness integration, save/resume, completion context, and reviewed localized controls.

Engineering choices within the approved contract: explicit dormant store opt-in; a separate tool-free transport;
plain JSON until a bound native capability is verified; deterministic shortlist ordering. No new gameplay mechanic
or character/content tuning was chosen in this stage.

## Verification

| Check | Result |
|---|---|
| `npm run typecheck` | Pass, including tests and scripts |
| New focused tests | 70 pass across four files |
| Full `npm test` | 143 files pass; 1,409 tests pass; one pre-existing skip |
| `npm run build` | Pass; existing Zod annotation and Phaser mixed-import warnings |
| Actual transport with mocked fetch | Writer/Manager request serialization, roles, no tools, and usage pass |
| Legacy prompt comparison | All 122 sampled builder outputs exactly match the previous implementation |
| `git diff --check` | Pass |

Focused tests cover pure conversion, exact backups, encryption, credential-free views, role references, profile CRUD,
frozen snapshots, failed/stale writes, protected startup, transport error/refusal/format handling, queue cancellation,
timeout, role routing, retained Writer retry, regeneration, concurrent retry rejection, owner/session/token isolation,
stale/late results, prompt separation/localization, preflight, source offsets, and teacher attribution.

The complete suite ran with local mock-server/Windows filesystem access. No real provider, paid request, app UI,
packaged gameplay, live migration, release, commit, or push was used. This is not visual or provider acceptance.

## Complete prompt measurements

The local measurement uses shipped English and Chinese content/strings, current game builders, a new-game state,
and a synthetic neutral Writer reply. Its 122 cases include 40 solo, 40 two-character, 40 NPC, and two class-opening
cases across both languages. Legacy and Writer include their message history; Manager includes the full embedded
schema and projected context. Counts are UTF-16 characters, not tokenizer measurements or bills. Profile-specific
instructions, transport language suffixes, native-format serialization, and Legacy tool definitions are excluded.

| Language | Mean Legacy | Mean Writer | Mean Manager | Mean combined Dual |
|---|---:|---:|---:|---:|
| English | 13,146 | 13,070 | 16,967 | 30,037 |
| Chinese | 11,079 | 10,415 | 16,172 | 26,587 |

Combined Dual inputs are larger in this sample. Removing control duties does not establish an overall cost saving,
latency improvement, or writing-quality improvement. Long encounters, populated note ledgers, and real providers
still require later evaluation. Detailed rows and comparison scripts remain in ignored local development evidence.

## Data and change boundaries

Of the 554 prior source/script/config files in the P2.0 manifest, exactly five changed: the connection store,
snapshot types, prompt builder, intimacy description helper, and English scene strings. The other 549 match their
previous hashes. New dormant modules and tests are additional files. Chinese scene strings add the same seven keys;
all previous English/Chinese string values are unchanged. No character, economy, catalogue, or curriculum tuning.

Live settings, saves, add-ons, and `Local State` match the baseline. Original user-data/doc backups (373/20 files),
all six archive files, and all 74 historical finding IDs remain intact. Main startup, IPC, preload, renderer, and
save schemas remain unchanged. Branch/HEAD and the previously staged work are retained. BUG-001 remains open:
dormant Dual guarding is not evidence of a fix to the unidentified original Legacy failure.

Next checkpoint: P2.4 complete-turn application using these privileged candidates and captured identities.
