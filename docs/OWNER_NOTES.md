# Owner Notes

RaBiTool is the Chrome extension project for automating a Reclame Aqui export into an Excel Web mother sheet used by BI.

## Practical Workflow

- Load `project/` as an unpacked Chrome extension for testing.
- Use the popup buttons as the main workflow surface.
- Keep exact RA page steps and Excel placement rules documented as they become known.
- Keep real exports, workbook URLs, private screenshots, credentials, and customer data out of Git.
- Use fake data examples for documentation and tests.

## Current UI Baseline

- Popup: compact dark appearance with drag, gear, close, `Atualizar BI`, `RA`, `Excel`, and status text.
- Options: compact dark page with enable toggle, shortcut row, popup preview, workflow summary, hidden version scaffold, and support placeholders.
- Shortcut row: Chrome activation shortcut opens Chrome's shortcut page and refreshes the displayed key boxes after editing.
- Version: scaffolded but hidden until a remote/release source exists.
- Support: placeholders only; configure later.

## Current Workflow Alignment

- Source: Reclame Aqui web UI.
- Export: XLSX download.
- Destination: Excel Web mother sheet.
- First implementation style: browser UI automation.
- No API/OAuth path for the initial build.
- Expected destination behavior: replace rows or append rows, to be specified by the owner.

## Git Identity Alignment

- Allowed Git email for this project: `lorenzo.berto@eduzz.com`.
- The identity guard is enabled for this local repo.
- `.git-identity` is local/ignored and should contain the allowed email.
- `git config user.email` must match `.git-identity`.
- `git config core.hooksPath` must be `.githooks`.
- Initial branch: `main`.
- Remote setup: later.
- Support placeholders: later.

## Details Still Needed

- Exact RA URL and filters.
- Exact RA button sequence to export the XLSX.
- XLSX column layout using fake examples.
- Excel workbook URL.
- Excel worksheet/tab name.
- Target range/start cell.
- Whether the import should replace, clear/rebuild, or append.
- Row mapping rules.

## Owner Commands

memcheck

Ask for `memcheck` when the AI should thoroughly update long-term project memory/docs so future AIs or devices can continue with the same understanding.

gitcheck

Ask for `gitcheck` when the AI should do `memcheck` and then save the project to Git: inspect, run relevant checks, stage, commit, and push when a remote is configured unless told otherwise.

localrelease

Ask for `localrelease` when the AI should refresh the generated release folder from `project/`. The command should run `scripts/Export-LocalRelease.ps1` and should not create a zip unless a zip is explicitly requested.
