# Start here — Codex handoff

## Installation

Copy the contents of this package's `docs/` into the local repository's `docs/` directory. Review collisions before overwriting existing files; preserve unrelated docs. The `audit_archive/` folder contains byte-for-byte copies of the five supplied originals and SHA256SUMS.txt. Do not overwrite repository AGENTS.md with the proposed addendum. No source files are included.

## Reading order

Current checkpoint, 2026-11-25: D-023 records the owner's acceptance of F-001 within the documented isolated-data/
mocked-endpoint scope. D-014–D-022 cover its preparation, implementation, testing, and verified undo-load repair;
ACC-001 is resolved. Read F001_ACCEPTANCE_REPORT.md for preserved evidence, hashes, acceptance, and limits.
The next gate is a separately reviewed F-002/P2.0 plan. Live rollout, paid tests, commits/pushes, and F-002
implementation have not been authorized. The initial prompt below records the original F001.0 gate. Use
DEVELOPMENT_STATUS.md and DECISION_LOG.md for current evidence/scope; preserve the original audit archive.

1. PROJECT_CONTEXT.md — purpose and constraints.
2. DEVELOPMENT_STATUS.md — current gate and immediate tasks.
3. DECISION_LOG.md — approvals, proposals and open questions; then F001_ACCEPTANCE_REPORT.md for current results and ACC-001.
4. IMPROVEMENT_PLAN.md — consolidated sequence and evaluation.
5. ARCHITECTURE.md — existing system map and future boundaries.
6. LLM_CONNECTION_ROADMAP.md — active F-001 design.
7. CONVERSATION_DESIGN.md — complete 74-finding historical audit; read relevant sections before edits.
8. DUAL_CALL_GENERATION_DESIGN.md — next feature; understand dependency but do not implement now.
9. AGENTS_ADDENDUM.md — proposed merge into actual repository instructions only after review.

## Initial Codex prompt

Read docs/CODEX_HANDOFF.md and the listed working documents, plus existing repository AGENTS.md and CLAUDE.md. We are at M1/F001.0 only. Inspect the repository and report branch, commit, remote, working tree, source drift, package scripts, compatibility conflicts, userData isolation and backup requirements, and every consumer of the current LLM profile architecture. Identify the baseline commands and any risks before executing writes or tests. Do not modify source, create branches, run paid API requests, commit or push without approval. Propose F001.1 implementation steps and wait for review. Preserve all 74 audit findings and the original archive. F-001 is first, F-002 second, NPC work afterward. Report blockers and distinguish observed source facts from proposed changes.

## Maintenance

Use DEVELOPMENT_STATUS.md for session handoff, DECISION_LOG.md for approved changes, feature designs for scoped requirements, and ARCHITECTURE.md for verified implementation updates. Do not silently rewrite CONVERSATION_DESIGN.md or archive files. When a finding is fixed, record evidence in status. The original package was based on five uploaded Markdown files, without verified baseline results. Subsequent approved implementation and local verification are recorded in DEVELOPMENT_STATUS.md and DECISION_LOG.md; this is not a full chat export.
