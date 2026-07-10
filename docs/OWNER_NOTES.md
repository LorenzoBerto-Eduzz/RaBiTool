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
- The tool handles two spreadsheet objects: a fresh incoming RA report and a large existing mother sheet.
- The sample workbook was only a structural teaching example: `Sheet1` showed the mother-sheet layout, and `Sheet2` showed a downloaded report layout.
- This is business-level data automation; the tool should stop when uncertain rather than risking mismatched rows.
- Current mother-sheet contract is exactly 9 columns, matching the downstream reader's current needs.
- The report is definitive for those 9 mapped columns, so blanks from the report also overwrite existing mother-sheet values.
- Both the report and mother sheet must be sorted oldest to newest by `Data Reclamação`; this is a required safety guard.
- If the report is fully newer than the mother sheet, append the normalized rows at the end.
- Once all validation guards pass, the owner wants the workflow to proceed automatically and quickly.
- Development should move toward the real RA report generation/download flow early, while still keeping parser/reconciliation modules clean and testable.

## Popup Direction

- Current visible popup should be a clean shell with drag, settings gear, close icon, separator, and empty body.
- Visual direction: white popup, gray icons and separator, icons hover green/light green.
- Workflow buttons and future shortcuts should be added after their behavior is aligned.
- Exact default corner placement still needs final clarification.

## Recommended Next Alignment

Start with the data/reconciliation rules before page-click automation:

1. Confirm required columns and validation rules.
2. `Id HugMe` is confirmed as the unique ticket/case key.
3. First replacement approach is to find the oldest incoming report ticket in the mother sheet, validate the overlap through the current mother-sheet tail, then replace from that row downward.
4. Define final edge cases: missing current latest mother-sheet ticket in the report, unexpected older report rows, optional blank fields, and whether a preview/confirmation is required.
5. Define what warnings/errors should block execution.
6. Then align RA page buttons and Excel Web write mechanics.

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
