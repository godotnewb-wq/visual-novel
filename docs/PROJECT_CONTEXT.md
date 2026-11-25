# Project context — Visual Novel

Updated 2026-11-24 | Historical repository: `godotnewb-wq/rpg-game`; verified local remote: `godotnewb-wq/visual-novel`. Baseline `c804387d9660f0ea055d9ea7326004aa43ee8ee3`, version 0.8.7; current branch `codex/llm-connection-profiles`, with uncommitted approved work and existing user changes.

## Purpose

Improve the existing Electron romance visual novel rather than rewrite it. The owner wants NPCs to behave as independent characters, with natural conversational rhythm, distinct voices, believable knowledge and emotional continuity. Preserve the beat-based visual presentation, player agency, schedules, game rules, saves, localization and custom content. The owner reported roughly eight in ten NPC replies ending in questions across models; this is informal, not measured. The owner also reported scene transition commands appearing in chat (BUG-001); reproduce before diagnosis.

## Development direction

M0 static audit is complete: ten stages and 74 findings. M1/F001.0 establishes a verified baseline. First functional feature F-001 stores multiple named LLM connections with independent parameters, secure credentials, CRUD, discovery/testing and quick switching. Second F-002 separates NPC writing from tracking and gameplay directives in two logical calls. Broader NPC work M2–M7 follows. See IMPROVEMENT_PLAN.md for the authoritative sequence and the two feature designs for gates. Do not treat a proposed schema or UI as existing code.

## Technical orientation

React renderer → preload → Electron main IPC → shared prompt/rules → OpenAI-compatible router/client → directive parsing → renderer state and display. Zod schemas, JSON content packs, local settings/saves and external ComfyUI are existing foundations. Read ARCHITECTURE.md for source map and CONVERSATION_DESIGN.md for evidence. Preserve deterministic game rules as authority over model proposals. Keep secrets in privileged storage, validate all model output and maintain undo semantics.

## Writing and evaluation principles

Natural statements, reactions, pauses and motivated questions; no arbitrary question quota. Distinct character voices and selective group participation, no fabricated player speech/actions/thoughts, no unwitnessed knowledge. Preserve individual emotional responses, including disagreement and unchanged/negative outcomes. Prefer existing character fields and targeted prompt experiments before new personality mechanics. Compare paired scenarios across models with settings and starting state controlled; record actual sample counts, raw/displayed output (redacted), latency, directive validity and failures. No behavioral improvement is proven yet.

## Workflow

ChatGPT planning and review; Codex local implementation, testing and documentation maintenance. Work in separate approved branches, small reviewable diffs, no commits or pushes without explicit permission. The owner resolved compatibility in D-014: preserve settings/saves/add-ons and allow migrations required by approved features. Full backups and isolated test data are verified; BREEDHAVEN_ADDONS=1 alone is not isolation. Keep audit_archive immutable. Current gate: F-001 accepted under D-023 (2026-11-25) within the documented isolated/mock scope. D-018–D-020 implement profiles/routing/management/switching; D-021 covers final testing. Owner-approved D-022 repairs the baseline undo-load omission, and regression/packaged rechecks pass on isolated data/mocked endpoints. ACC-001 is resolved and final feature acceptance is recorded. Live data is unchanged; rollout and F-002 implementation are not authorized. Next gate: a separately reviewed P2.0 plan. See F001_ACCEPTANCE_REPORT.md. See DEVELOPMENT_STATUS.md and DECISION_LOG.md.

## Document authority

Current source and actual test results establish implemented behavior. Owner-approved decisions establish scope. Historical audit evidence is preserved even when superseded. Proposed designs are hypotheses until reviewed and tested. If documents conflict, report the conflict rather than silently choosing. This package transfers project knowledge, not verbatim chat transcripts.
