# Commit privacy

Working documents use portable paths instead of an individual computer's account or backup locations. Detailed
private verification records and pre-cleanup document copies stay in `.dev-data/`, which is ignored by Git.
The original audit archive remains byte-for-byte intact. Public repository identifiers and necessary regression
message/undo counts remain in the working documents; private installation inventories were generalized.

## Files and staging

Before committing, review the staged file list and diff:

```powershell
git diff --cached --name-only
git diff --cached
```

The ignore rules exclude local verification data, `.env` files, signing configuration, logs, generated output,
and common accidental copies of app data at the repository root. `content/default/` remains the shipped game
content. These rules do not remove already tracked files or erase earlier history; do not force-add private data.
Keep original settings, saves, add-ons, encrypted credentials, full backups, and encryption context files out of
the repository. Encrypted settings/backups are still private files.

## Author identity

This cleanup does not change Git author/committer identity or rewrite history. Review your configured identity
before committing. If you want email privacy, use the exact GitHub-provided no-reply address from your account's
email settings; do not guess it. A repository-local configuration affects this repository only:

```powershell
git config --local user.email "YOUR_GITHUB_PROVIDED_NOREPLY_EMAIL"
```

Replace the placeholder before running that command. A GitHub email-privacy setting by itself does not change
the local Git configuration. Changing future identity does not change the email on earlier commits. See
[GitHub's commit-email instructions](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address).

## Review limits

The cleanup reviewed pending text changes, credential-like assignments, local paths, ignore/tracking rules, and
the unchanged audit archive. No real credential was identified in those pending files; test credentials are
fixtures. This is not an exhaustive historical or binary-metadata audit and is not a guarantee that every kind
of private information can be detected automatically. Nothing was staged, committed, or pushed by this cleanup.
