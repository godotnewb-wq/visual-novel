# Proposed AGENTS.md addendum — owner review required

Do not replace existing AGENTS.md or CLAUDE.md. Review and merge only approved instructions into the repository's actual agent guidance. Report conflicts, especially backward compatibility, before editing.

- Start with docs/CODEX_HANDOFF.md, DEVELOPMENT_STATUS.md and DECISION_LOG.md; read the active feature design, ARCHITECTURE.md and relevant CONVERSATION_DESIGN.md findings. Preserve docs/audit_archive unchanged.
- Current order: M1/F001.0 → F-001 → F-002 → M2–M7. Work only on the authorized milestone. Proposed designs are not implemented facts.
- Verify repository, branch, exact source and package scripts. Report plan and affected files before source changes. No commits, pushes, destructive resets or unrelated refactors without explicit approval.
- Preserve player agency, deterministic mechanics, localization, existing saves and add-ons; resolve compatibility conflicts with owner. Validate model outputs and keep internal directives out of chat. Keep secrets out of renderer views, logs, fixtures and Git.
- Use disposable data and verified backups; do not run paid or remote tests with private context without approval. Report actual test results and failures, not assumed success.
- Update DEVELOPMENT_STATUS.md and DECISION_LOG.md after approved changes; reference audit IDs and retain historical evidence. Stop at acceptance gates for owner review.

This file is documentation only; Codex will not necessarily load it automatically as agent instructions.
