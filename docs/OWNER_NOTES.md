# Owner Notes

RaBiTool is the Chrome extension project for automating a Reclame Aqui export into an Excel Web mother sheet used by BI.

## Practical Workflow

- Load `project/` as an unpacked Chrome extension for testing.
- Use the popup buttons as the main workflow surface.
- Keep exact RA page steps and Excel placement rules documented as they become known.
- Keep real exports, workbook URLs, private screenshots, credentials, and customer data out of Git.
- Use fake data examples for documentation and tests.

## Current UI Baseline

- Popup: compact white top-right surface with drag, gear, close, outline `HugMe`/`Planilha` tracked-tab buttons, `RA > BI`, loading/current-process line, and stacked warning/result notices.
- HugMe/Planilha buttons use green/check for ready, blue/spinner for checking, and red/X for blocked/login/permisson states.
- Options: compact page with enable toggle/header, shortcut row, auto-run controls, release/version section, support section, and popup preview.
- Shortcut key boxes/buttons in options use the same green as selected auto-run day squares.
- Options also includes `Execução Automática`: off-by-default `Auto Run RA>BI`, local 24-hour time displayed as `16:00h`, and day buttons `D S T Q Q S S` defaulting to Monday-Friday.
- Shortcut row: Chrome activation shortcut opens Chrome's shortcut page and refreshes the displayed key boxes after editing.
- Version: visible options section. It checks GitHub Releases for `LorenzoBerto-Eduzz/RaBiTool`, compares with the installed manifest version, and downloads `RaBiTool.zip` when a newer release asset exists.
- Support: visible options section with GitHub `https://github.com/LorenzoBerto-Eduzz/RaBiTool` and email `lorenzo.berto@eduzz.com`.

## Current Workflow Alignment

- Source: Reclame Aqui web UI.
- Export: XLSX download.
- Destination: Excel Web mother sheet.
- First implementation style: browser UI automation.
- No API/OAuth path for the initial build.
- Activation prepares reserved HugMe export and Planilha/mother-sheet tabs inactive to the side and tracks their tab IDs.
- RaBiTool groups its assigned tabs as `RaBiTool` when Chrome allows it. Chrome only supports named tab-group colors, so the group uses Chrome's `green` color as the closest match to the `RA > BI` button.
- RaBiTool reuses only the tab/group IDs it recorded for the current extension load. It does not attach to random already-open HugMe/Planilha tabs, and it ignores old groups that happen to be named `RaBiTool` after an extension reload/install.
- Tracked tabs should stay smart: if login/auth appears, show blocked; after login succeeds and lands elsewhere, send the same tab back to the target HugMe/Planilha URL automatically.
- If either reserved tab is missing when `RA > BI` starts, the tool should recreate/reassign it, wait for readiness, and then proceed. If it still cannot prepare required tabs, it should stop with `Abas reservadas do HugMe e Planilha Mãe não preparadas` or with a more specific HugMe/Planilha readiness warning.
- Toggling RaBiTool off is a hard shutdown, not just hiding the popup. Toolbar/shortcut toggle-off, popup close, and options toggle-off cancel any active RA > BI run, close the tracked HugMe/Planilha tabs, clear workspace tracking, and disable the extension. This also applies to auto-run.
- If a tab exists but required elements are still loading, wait briefly; if still missing, stop with a clear error.
- Current destination behavior: find the oldest incoming report ticket in the mother sheet, verify that Excel selected that exact anchor, then paste the normalized report rows from that row downward.
- The tool handles two spreadsheet objects: a fresh incoming RA report and a large existing mother sheet.
- The sample workbook was only a structural teaching example: `Sheet1` showed the mother-sheet layout, and `Sheet2` showed a downloaded report layout.
- This is business-level data automation; the tool should stop when uncertain rather than risking mismatched rows.
- Current mother-sheet contract is exactly 9 columns, matching the downstream reader's current needs.
- The report is definitive for those 9 mapped columns, so blanks from the report also overwrite existing mother-sheet values.
- The report must be sorted oldest to newest by `Data Reclamação`; this is a required safety guard. The mother sheet is expected to stay in the same order, but the current UI-only Excel path cannot fully inspect global sheet sorting.
- Append fallback is not active in the current release path. If the oldest incoming report ID cannot be found and verified in the mother sheet, the tool blocks instead of guessing a destination.
- Once all validation guards pass, the owner wants the workflow to proceed automatically and quickly.
- Development should move toward the real RA report generation/download flow early, while still keeping parser/reconciliation modules clean and testable.
- RA report setup uses `Data Reclamação` with order type `ascendente`, so latest rows are at the bottom like the mother sheet.
- RA processing is watched inside the HugMe page up to every 1 second and blocked after 420 seconds if the report is not downloadable.
- Current build continues through download, XLSX validation, guarded Excel Web worksheet confirmation, keyboard-based anchor verification, TSV preparation, clipboard copy, and one-block paste when safe.
- Excel Web phase currently must focus/activate the Planilha tab because Excel Find, selection, copy, clipboard read, and paste are tied to the active workbook surface. This is acceptable for now as long as the popup makes the step clear, for example `Validando Planilha Mãe...` followed by an explicit focus/paste status.
- Before writing, the tool checks that the active Excel worksheet is the configured destination, currently `Relatório de Tickets`; if not, it blocks before search/paste. It then opens Excel Find, confirms the Find input is ready, searches the oldest report ID, confirms the selected cell, pastes there, and does not press Enter after paste. The Find/anchor proof retries up to six increasingly patient attempts for slower machines.
- During the Excel phase, other Chrome extensions can interfere if they inject visible `chrome-extension://` overlays/frames into the Planilha or try to control the same tab. RaBiTool blocks non-destructively in that case: it does not remove or alter the other extension. The warning is short, includes the detected extension ID prefix, and can be clicked to open that extension's Chrome details page so the user can disable or adjust it manually.
- Before opening Excel Find, RaBiTool now stabilizes the workbook against accidental user clicks/drags by releasing pointer/modifier state, sending Escape, refocusing the workbook surface, and collapsing accidental multi-cell selections before search.
- Future Excel Web writing should prefer a single contiguous paste action, so the owner can use one `Ctrl+Z` in Excel Web to revert the extension's write during review/testing.
- The extension should avoid using arbitrary existing RA/Excel tabs. Excel Web paste currently requires focusing the reserved Planilha tab; the popup should keep this step explicit rather than silently stealing view.
- Auto-run is independent from manual popup visibility. If enabled, it runs from a Chrome alarm at the configured local time/day, enables RaBiTool status/popup for the run, opens/prepares reserved tabs, and uses the same `RA > BI` workflow. Missed times are skipped, not caught up later.
- RA > BI is one-run-at-a-time. A second manual click or an auto-run firing while another run is active is skipped, not queued. Toggle-off is the explicit user cancellation path.

## Popup Direction

- Current visible popup should be a compact top-right tool with drag, settings gear, close icon, separator, outline `HugMe`/`Planilha` status buttons, `RA > BI`, loading/current-process line, and stacked warning/result notices.
- Chrome default/new-tab pages cannot show the floating popup because Chrome blocks content-script injection on internal pages.
- Visual direction: white popup, gray icons and separator, icons hover green/light green.
- The same `RA > BI` action should work from normal pages and from the options-page popup preview.
- Browser resize/zoom should not save a new popup position.

## Recommended Next Alignment

After the owner tests the guarded Planilha flow, continue with refinement of the focused keyboard paste path:

1. Confirm required columns and validation rules.
2. `Id HugMe` is confirmed as the unique ticket/case key.
3. Current replacement approach is to find the oldest incoming report ticket in the mother sheet, verify that Excel selected that exact anchor ID, then paste from that row downward.
4. Define final edge cases: missing oldest incoming report ID in the mother sheet, clearly newer reports that might later append, optional blank fields, and whether a preview/confirmation is required.
5. Define what warnings/errors should block execution.
6. Refine popup statuses so each blocking/current step is clear during focused Excel automation.

## Git Identity Alignment

- Allowed Git email for this project: `lorenzo.berto@eduzz.com`.
- The identity guard is enabled for this local repo.
- `.git-identity` is local/ignored and should contain the allowed email.
- `git config user.email` must match `.git-identity`.
- `git config core.hooksPath` must be `.githooks`.
- Initial branch: `main`.
- Remote: `origin -> https://github.com/LorenzoBerto-Eduzz/RaBiTool.git`.
- Commit message convention: start commit titles with the current extension version without brackets, for example `1.0.0 - Commit title`.
- Version rule: do not bump/change `project/manifest.json` version, docs version references, commit version prefix, tags, or releases unless the owner explicitly asks for a version change.
- Release direction: only when owner asks for `remoterelease`, package/upload the zipped local release artifact to GitHub Releases. Use the current manifest version for the release tag/title/description and upload `RaBiTool.zip`. Do not create or edit GitHub Releases without an explicit release instruction.
- Existing first release: `v0.1.0`. Current requested release target is `v1.0.0`; future versions and future remote releases should be created only on explicit owner request.

## Details Still Needed

- Whether to implement append-only fallback when the oldest incoming report ID is not found.
- Whether to add post-paste validation beyond the current anchor guard.
- Whether to narrow permissions from discovery-wide host access to only HugMe/Excel hosts.
- Whether to adjust the version section to allow downloading the same/current version manually.

## Owner Commands

memcheck

Ask for `memcheck` when the AI should thoroughly update long-term project memory/docs so future AIs or devices can continue with the same understanding.

gitcheck

Ask for `gitcheck` when the AI should do `memcheck` and then save the project to Git: inspect, run relevant checks, stage, commit, and push when a remote is configured unless told otherwise.

localrelease

Ask for `localrelease` when the AI should refresh the generated release folder from `project/`. The command should run `scripts/Export-LocalRelease.ps1` and should not create a zip unless a zip is explicitly requested.

remoterelease

Ask for `remoterelease` when the AI should create the zipped local release artifact and publish/upload it to GitHub Releases for the current manifest version. Do not do this as part of ordinary `gitcheck`.
