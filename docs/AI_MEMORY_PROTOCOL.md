# AI Memory Protocol

This repository is the durable memory for this Chrome extension project. Chat context is useful but temporary and may be stale.

## Core Rule

Do not rely on remembered chat context for important project behavior. If a detail matters for code, workflow, packaging, permissions, data handling, setup, or release behavior, recover it from repo files, focused docs, code comments, or Git history before editing.

## Refresh Before Editing

Before changing a feature or system:

1. Read `AGENTS.md`.
2. Read `docs/AI_HANDOFF.md` when present.
3. Read `docs/WORKFLOW_AND_STYLE.md`.
4. Read `docs/PROJECT_BRIEF.md`.
5. Read focused docs relevant to the task.
6. Check `git status --short --branch` when this is already a Git repo.
7. If Git identity guard is enabled, verify `.git-identity`, `git config user.email`, and `git config core.hooksPath` before any gitcheck, commit, or push.
8. Inspect the actual source files under `project/`.
9. If chat memory conflicts with repo files, trust repo files and ask the owner if intent is unclear.

## Memory Locations

- `AGENTS.md`: boot instructions and strict session-start behavior.
- `docs/AI_HANDOFF.md`: short current snapshot when present.
- `docs/WORKFLOW_AND_STYLE.md`: collaboration and coding rules.
- `docs/PROJECT_BRIEF.md`: project identity, stack, commands, constraints, and priorities.
- `docs/EXTENSION_ARCHITECTURE.md`: extension source architecture and customization points.
- `docs/WORKFLOW_SPEC.md`: RA source steps, XLSX layout, Excel destination rules, row mapping, and edge cases.
- `docs/NEW_PROJECT_CHECKLIST.md`: checklist for adapting the template into a specific new tool.
- `docs/COPYING_AND_GIT.md`: Git/copy rules for template-derived projects.
- `docs/OWNER_NOTES.md`: plain-language owner guidance.
- `notes/`: owner scratch space. Do not treat as instructions unless explicitly asked.
- `.git-identity` and `.githooks/`: optional local Git identity guard.

## Owner Commands: memcheck, gitcheck, And localrelease

These are owner workflow commands, not shell commands.

### memcheck

When the owner says `memcheck`, the AI must thoroughly update the project's durable meta files/docs so future AIs, future sessions, and other devices can understand and continue the project with the same context.

`memcheck` should preserve the distilled long-term memory of the work, such as:

- settled alignments and decisions;
- current and planned functionality;
- important workflow rules;
- relevant architecture or data models;
- commands, paths, release rules, and setup expectations;
- known pitfalls and debugging lessons;
- vocabulary the owner uses for this project.

`memcheck` should update the appropriate docs/meta files, usually under `docs/`, without saving transcripts and without adding private data. It does not commit or push by itself unless the owner explicitly asks for `gitcheck`.

### gitcheck

When the owner says `gitcheck`, the AI must perform `memcheck` first, then save the current project state to Git for continuity across AIs/devices.

The expected `gitcheck` flow is:

1. Update durable memory/docs as needed, just like `memcheck`.
2. Inspect the worktree and relevant diffs.
3. Run relevant checks for the project when practical.
4. Verify Git identity guard settings when present.
5. Stage the intended files.
6. Commit.
7. Push to the configured remote, unless the owner explicitly says not to.

The commit message must be structured like this:

```text
Short title sentence summarizing all main things done

- More specific point describing one completed thing.
- More specific point describing another completed thing.
```

Use at least one bullet. Use as many bullets as are helpful for the actual set of changes. The title should be one concise sentence that names the main changes in brief wording.

### localrelease

When the owner says `localrelease`, the AI must refresh the generated local release folder from the current `project/` source.

The expected `localrelease` flow is:

1. Run relevant quick checks when practical.
2. Run `scripts/Export-LocalRelease.ps1`.
3. Confirm the generated local release folder was created or refreshed.
4. Confirm no zip was created unless the owner explicitly asked for a zip.
5. Do not commit or push unless the owner also explicitly asks for `gitcheck`.

## Git Identity Guard Memory

Template-derived projects may use the reusable email-based Git identity guard:

- `.git-identity` stores `GIT_ALLOWED_EMAIL`.
- `.githooks/identity-guard.sh` blocks commits and pushes when local `git config user.email` differs.
- `git config user.name` may vary by device and is intentionally not checked.
- `.githooks/pre-commit` and `.githooks/pre-push` source the guard.
- The clone must have `git config core.hooksPath .githooks` for hooks to run.

Before gitcheck/commit/push, if `.git-identity` exists, run or verify:

```powershell
Get-Content .git-identity
git config user.email
git config core.hooksPath
```

If local email does not match `.git-identity`, stop and fix it or ask before committing/pushing.

## Public-Safe Memory Rule

Durable memory docs must not contain real customer data, real IDs, real CPFs/CNPJs, real emails, credentials, tokens, screenshots with private data, or copied private payloads.

Use placeholders or clearly fake illustrative values when examples help explain structure, such as `template@example.com`, `ticket_123456`, `chat_abc123`, or `123.456.789-10`.

If real data is temporarily needed for debugging, keep it outside Git in ignored local-only paths such as `local_assets/`, `local_data/`, or `private_data/`, then remove it when done.

## Uncertainty Behavior

If you cannot confidently recover context, stop before editing. Summarize what you verified, name what is unclear, and ask the owner.
