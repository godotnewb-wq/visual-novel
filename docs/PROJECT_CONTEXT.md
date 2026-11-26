# Project context — Visual Novel

Updated 2026-11-25 | Historical repository: `godotnewb-wq/rpg-game`; verified local remote: `godotnewb-wq/visual-novel`. Current baseline `6788dfb0c6ea979a60e7ef35fb0eaf19ef73771c`, version 0.8.7; owner-selected branch `writer-manager`, initially clean before P2.0 baseline tests/documentation.

## Purpose

Improve the existing Electron romance visual novel rather than rewrite it. The owner wants NPCs to behave as independent characters, with natural conversational rhythm, distinct voices, believable knowledge and emotional continuity. Preserve the beat-based visual presentation, player agency, schedules, game rules, saves, localization and custom content. The owner reported roughly eight in ten NPC replies ending in questions across models; this is informal, not measured. The owner also reported scene transition commands appearing in chat (BUG-001); reproduce before diagnosis.

## Development direction

M0 static audit is complete: ten stages and 74 findings. M1/F001.0 establishes a verified baseline. First functional feature F-001 stores multiple named LLM connections with independent parameters, secure credentials, CRUD, discovery/testing and quick switching. Second F-002 separates NPC writing from tracking and gameplay directives in two logical calls. Broader NPC work M2–M7 follows. See IMPROVEMENT_PLAN.md for the authoritative sequence and the two feature designs for gates. Do not treat a proposed schema or UI as existing code.

## Technical orientation

React renderer → preload → Electron main IPC → shared prompt/rules → OpenAI-compatible router/client → directive parsing → renderer state and display. Zod schemas, JSON content packs, local settings/saves and external ComfyUI are existing foundations. Read ARCHITECTURE.md for source map and CONVERSATION_DESIGN.md for evidence. Preserve deterministic game rules as authority over model proposals. Keep secrets in privileged storage, validate all model output and maintain undo semantics.

## Writing and evaluation principles

Natural statements, reactions, pauses and motivated questions; no arbitrary question quota. Distinct character voices and selective group participation, no fabricated player speech/actions/thoughts, no unwitnessed knowledge. Preserve individual emotional responses, including disagreement and unchanged/negative outcomes. Prefer existing character fields and targeted prompt experiments before new personality mechanics. Compare paired scenarios across models with settings and starting state controlled; record actual sample counts, raw/displayed output (redacted), latency, directive validity and failures. No behavioral improvement is proven yet.

## Workflow

ChatGPT planning and review; Codex local implementation, testing and documentation maintenance. Work in separate approved branches, small reviewable diffs, no commits or pushes without explicit permission. D-014 preserves settings/saves/add-ons and allows migrations required by approved features. Full backups and actual isolated runtime paths are verified; BREEDHAVEN_ADDONS=1 alone is not isolation. Keep audit_archive immutable. F-001 is accepted under D-023 within the documented isolated/mock scope; ACC-001 is resolved. D-024 confirms six F-002 design choices, including independent Writer/Manager assignments and saved encounter notes. D-025 authorizes the now-verified P2.0 baseline on `writer-manager`: typecheck/build pass, 137 test files/1,220 tests pass with one skip, and eleven synthetic scenarios pass through a hidden isolated runtime. D-026 records the owner's curly-braced/no-transition symptom; its original exact cause is unconfirmed. Live data, original backups, and runtime application source remain unchanged. Next: P2.1 contract review; Dual-call implementation, paid-provider testing, rollout, and commits/pushes remain separately gated. See F002_BASELINE_REPORT.md, F001_ACCEPTANCE_REPORT.md, DEVELOPMENT_STATUS.md, and DECISION_LOG.md.

P2.1 update: the owner authorized contract work under D-027. F002_TURN_CONTRACT.md and F002_OPERATION_INVENTORY.md
now provide the concrete review package. D-028 confirms next-scene mode changes/next-turn profile changes, role-aware
gameplay selection, retained NSFW Writer routing with no Manager fallback, explicit full regeneration, and continued
play with bounded-note retention. Numeric caps and detailed mechanics were proposals at that checkpoint. P2.1 itself
implemented no application schemas, validators, prompts, migrations, IPC, or activation.

P2.2 update (D-029): the owner approved the next step using that contract. Dormant shared schemas/pure validation
and 119 focused checks now exist; no application imports or activation. Typecheck, production build, and the full
139-file suite pass (1,339 tests, one existing skip). Previous source files, backups, and archived findings remain
unchanged. Validation supplies candidates requiring consistency review, not proof of consent or committed effects.
That P2.2 checkpoint is superseded by the P2.3 update below. Live migration, runtime activation, real-provider/paid
tests, commits, and pushes remain separately gated.

P2.3 update (D-030): dormant protected settings conversion/assignments, role snapshots, separate localized prompts,
tool-free transport, sequential calls, bounded recovery, and owner/session cancellation are implemented. Normal app
startup remains version 2; no IPC/UI/save activation. Typecheck/build pass; 143 files, 1,409 tests pass/one existing
skip. All 122 sampled Legacy prompts match their prior outputs. Combined Dual inputs are larger in this sample;
there is no provider/cost/quality acceptance claim. Live settings/saves/add-ons, original backups/archive, and 74
findings remain intact. This historical P2.3 checkpoint is superseded by the P2.4 update below.

P2.4 update (D-031): validated effects cross owning-frame IPC and commit through one focused session update with
dialogue, undo, and completion. Arrivals/input/presents are staged; cancellation/stale results cannot publish.
Optional metadata survives saves/restart/undo while pending work is excluded. Exact prior background fields are
preserved. Typecheck/build pass; 146 files, 1,465 tests pass/one skip. Hidden compiled startup/save API smoke uses
fresh isolated data and no network calls; all 13 original backup saves still parse. Live data/backups/archive remain
unchanged. Controls are connected but not visually checked; bounded consistency checks do not prove arbitrary prose
meaning. Normal startup stays v2/Legacy. Current gate: P2.5 tracking/completion context and reviewed controls; see
F002_P24_APPLICATION_REPORT.md. No paid/provider acceptance, live migration, commit, or push.

P2.5 update (D-032), superseding the earlier gates: witnessed ledger reconciliation, private note versions, safe
retention, summary context, optional metadata, and independent mode/profile controls are implemented. Startup now
uses protected v3 conversion while keeping existing installations Legacy until explicitly switched. Current scenes
keep their mode; new scenes capture the preference; assignments apply next turn. Typecheck/build pass; 148 files,
1,490 tests pass/one existing skip, including 25 new checks. All 122 sampled Legacy prompts match, and 13 original
saves parse. Isolated neutral component previews verify actual main/preload IPC with mocked transport, including
Settings, held replies, retry/cancel, selectors, old saves, and new NPC scenes. The production root's age gate was
left unchanged; component screenshots are not production-root acceptance. Live data, backups, archive, and 74
findings remain intact. No real-provider/paid calls, release, staging, commit, or push. Next: P2.6 acceptance; see
F002_P25_TRACKING_REPORT.md for evidence, data touches, prompt measurements, and limits.

P2.6 update (D-033): local/mock acceptance checks pass without production source changes. Typecheck, 148 files/
1,490 tests (one skip), production build, and Windows directory packaging pass. An isolated instrumented package
passes 25 API records, exact save/settings restart, and actual production-root neutral Dual/Legacy gameplay,
including redo, held retry, completion, and edited-memory persistence. Seven screenshots were inspected with real
transitions enabled; normal age confirmation occurred outside automation. All 581 pre-stage source/script files,
live data, original backups, archive, and 74 finding IDs remain intact. No real-provider requests, release, staging,
commit, or push. F002_ACCEPTANCE_REPORT.md records scope and limits. Final owner acceptance and any separately
agreed provider/quality/performance evaluation remain pending; mock timings establish no model improvement.

## Document authority

Current source and actual test results establish implemented behavior. Owner-approved decisions establish scope. Historical audit evidence is preserved even when superseded. Proposed designs are hypotheses until reviewed and tested. If documents conflict, report the conflict rather than silently choosing. This package transfers project knowledge, not verbatim chat transcripts.
