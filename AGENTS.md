# Agent Boot Instructions

This is the first file an AI coding session should read in a project created from this template.

This repo is RaBiTool, a Chrome MV3 extension for automating a Reclame Aqui XLSX export into an Excel Web mother sheet. The actual extension source root is `project/`. The repo root is the AI/project frame and Git/workflow boundary.

## Boot Or Catch-Up Sequence

Use this when starting a new AI session, after `git pull`, or before significant edits.

1. Read `docs/AI_HANDOFF.md`.
2. Read `docs/AI_MEMORY_PROTOCOL.md`.
3. Read `docs/WORKFLOW_AND_STYLE.md`.
4. Read `docs/PROJECT_BRIEF.md`.
5. Read `docs/EXTENSION_ARCHITECTURE.md` before changing extension code.
6. Read `docs/TEMPLATE_USAGE.md` when adapting this template into a project.
7. Read `docs/NEW_PROJECT_CHECKLIST.md` when defining a new project.
8. Read `docs/COPYING_AND_GIT.md` before changing Git setup or repo identity.
9. Read `docs/RELEASE_PROCESS.md` before packaging or releasing.
10. Read `docs/OWNER_NOTES.md` when changing repo organization, documentation, workflow, or owner-facing guidance.
11. Check `git status --short --branch` when Git exists.
12. Review recent history with `git log --oneline --decorate --max-count=10` when Git history exists.
13. If Git identity guard is enabled, verify `.git-identity`, `git config user.email`, and `git config core.hooksPath`.
14. Inspect relevant source files in `project/` before editing.

## Key Template Facts

- Source root: `project/`.
- Extension manifest: `project/manifest.json`.
- Extension version: `0.1.0`.
- Stack: plain JavaScript, HTML, CSS, Chrome Manifest V3 APIs.
- Load unpacked from `project/`, not the repo root.
- The popup starts as a visual shell only: drag, gear, close icons, separator, and empty body.
- Product purpose: UI-based browser automation from Reclame Aqui to Excel Web for BI input.
- Future AIs should ask for the exact RA page steps, XLSX layout, Excel workbook/tab/range, and replace/append rules before implementing workflow details.

## Development Rules

- Do not create Git commits unless the user explicitly asks.
- Do not create releases or local release exports unless the user explicitly asks.
- Keep source files inside `project/`; root is for docs, repo tooling, and project memory.
- Keep generated/local artifacts ignored.
- Prefer modular helpers over large hidden timing assumptions.
- Do not commit real customer data, credentials, tokens, private screenshots, real IDs, real CPFs/CNPJs, or real emails.
- Keep UI and workflow code modular so future AIs can safely add project-specific behavior.

## Git Identity Guard

This template includes `.git-identity.example` and `.githooks/`. A copied project may opt into the guard:

```powershell
Copy-Item .git-identity.example .git-identity
git config core.hooksPath .githooks
```

The guard is email-based. `user.name` may vary by device.

## Root Layout

```text
RaBiTool/
  project/               Chrome extension source
  docs/                  durable project and AI memory
  notes/                 user scratch notes
  asset_staging/         syncable raw/reference assets
  local_assets/          ignored local-only assets after copying if created
  scripts/               helper scripts
  AGENTS.md              this AI boot file
  README.md              repo overview
```

## Git Setup Warning

Do not copy `.git/` into future projects. A new extension project should initialize its own Git repo after template adaptation.

## Owner Workflow Commands

- `memcheck`: thoroughly update durable project docs/meta memory so future AIs/devices can continue with the same understanding. Do not commit or push by default.
- `gitcheck`: perform `memcheck`, then inspect, run relevant checks, stage, commit, and push to the configured remote unless the owner says not to.
- `gitcheck` commit messages must start with the current extension version without brackets, for example `0.1.0 - Commit title`, followed by one or more `-` bullet points describing the completed changes. Do not bump/change the extension version unless the owner explicitly asks for a version change.
- `localrelease`: refresh the generated release folder from `project/` using `scripts/Export-LocalRelease.ps1`. Do not create a zip unless the owner explicitly asks for a zip.
- `remoterelease`: only when explicitly requested, create the zipped local release artifact and publish/upload it to GitHub Releases for the current extension version. Do not create or edit GitHub Releases unless the owner explicitly asks for `remoterelease` or gives a direct release instruction.
