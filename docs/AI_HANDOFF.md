# AI Handoff

This file is the portable continuity note for AI coding sessions working on RaBiTool.

## Current State

- Project name: `RaBiTool`.
- Project kind: Chrome Manifest V3 extension.
- Source folder: `project/`.
- Manifest: `project/manifest.json`.
- Current version: `0.1.0`.
- Stack: plain JavaScript, HTML, CSS, Chrome extension APIs.
- Build step: none.
- Load unpacked from `project/`.
- Git is initialized locally.
- Initial branch is `main`.
- First project baseline commit has been created locally.
- GitHub remote is `origin -> https://github.com/LorenzoBerto-Eduzz/RaBiTool.git`.
- Support placeholders remain intentionally unconfigured for now.
- Allowed Git email for this project: `lorenzo.berto@eduzz.com`.
- Git identity guard is enabled locally with `.git-identity`, `git config user.email`, and `git config core.hooksPath .githooks`.

## Product Purpose

RaBiTool automates a Reclame Aqui to Excel BI workflow.

The current implemented workflow is:

1. Use the Reclame Aqui web UI in Chrome.
2. Prepare RaBiTool-owned reserved HugMe and Planilha tabs for the current extension load.
3. Fill the HugMe export form, generate the report, wait for the matching report item, click Download, and detect the matching XLSX.
4. Parse and validate the XLSX, mapping the 9 mother-sheet columns by header.
5. Focus the reserved Excel Web mother-sheet tab.
6. Verify the destination worksheet and anchor ticket, then paste one TSV block into the sheet.

A separate downstream BI app reads the mother sheet later. That downstream app is out of scope for this extension.

## Core Data Model

RaBiTool handles two separate spreadsheet objects:

- Incoming report: a newly downloaded RA/HugMe XLSX export. It is raw source data, has many columns, and may include export/title rows before the real header.
- Mother sheet: the large Excel Web destination used by BI. It has the clean target layout and many historical rows.

The private sample workbook previously inspected placed the mother-sheet snippet in `Sheet1` and the report sample in `Sheet2`, but production should be treated as a fresh report plus the real Excel Web workbook.

## Key Alignment

- Workflow style: browser UI automation.
- No API/OAuth integration is planned for the first version.
- Destination: Excel Web.
- Source: Reclame Aqui export/download page.
- The first implementation should be driven by exact owner-provided page steps, selectors, filters, and destination placement rules.
- Treat this as business-critical data automation. It must fail closed with clear reasons instead of guessing.
- Use modular stages: RA controller, report intake, XLSX parser, reconciliation engine, Excel writer, and safety/reporting layer.
- Owner confirmed `Id HugMe` is the unique ticket/case identity key and the first mother-sheet column.
- Current time/order key is `Data Reclamação`.
- Current mother-sheet output contract is exactly 9 columns: `Id HugMe`, `Data Reclamação`, `Tags`, `Seu problema foi resolvido?`, `Voltaria a fazer negócio?`, `Nota`, `Tempo primeira resposta (público)`, `Atribuido Para`, and `Tipo de Cliente`.
- The incoming report is authoritative for those mapped columns. Blank mapped report values should overwrite existing mother-sheet values.
- The report must be sorted ascending by `Data Reclamação`; if not, the tool blocks before writing. The mother-sheet sort assumption remains important, but the current UI-only Excel path cannot fully inspect the whole sheet reliably.
- Current reconciliation strategy: find the oldest incoming report ticket in the mother sheet, verify that Excel selected that exact `Id HugMe`, then paste the normalized report rows from that row downward. The owner realigned that overlap count differences are acceptable because missing/extra tickets inside the interval are not destructive for the current paste model.
- Current safety rule: block if the target worksheet cannot be proven, if the report is malformed/unsorted, or if Excel Find does not select the expected oldest report `Id HugMe`. Do not block merely because an overlap count would differ.
- Current append behavior: the active workflow blocks if Excel Find cannot confirm the oldest incoming report ticket in the mother sheet. Append-only fallback is not active in the current release path.
- Excel Web write requirement: prefer one contiguous paste action for the prepared affected range so the owner can use a single `Ctrl+Z` in Excel Web to revert the extension's write during review/testing. Avoid multi-step cell-by-cell writes unless explicitly realigned, because they may fragment Excel's undo stack.
- RA form setup alignment: on `https://app.hugme.com.br/app.html#/dados/tickets/exportar/`, choose company `Eduzz`, fill a timestamped title `RaBiToolRelatoriohhmmssddmmyy`, choose period `A definir`, fill date fields directly as `dd/mm/yyyy` with start date execution date minus 45 days and end date execution date, select order field `Data Reclamação`, select order type `ascendente`, select all columns, validate all configured fields, and only then click `Gerar relatório`.
- RA processing/download alignment: after submit, inject a watcher into the HugMe page. It locates the matching `Meus relatórios` item by exact title or by the `RaBiToolRelatoriohhmmssddmmyy` token, checks up to every 1 second while it shows `Processando relatório...`, blocks after 420 seconds if not ready, then clicks that same item's visible `Download` button. Track the resulting Chrome XLSX download by matching the generated title or title token inside filenames such as `prefix_rabitoolrelatoriohhmmssddmmyy_suffix.xlsx`.
- Once all guards pass, owner prefers the workflow to proceed automatically/quickly rather than requiring extra confirmation.
- Auto-run alignment: options page has an `Execução Automática` section with an `Auto Run RA>BI` toggle, local-device 24-hour time field displayed as `16:00h`, and day buttons `D S T Q Q S S` defaulting to Monday-Friday selected. Auto-run is off by default. When enabled, it uses Chrome alarms to schedule the next selected day/time and runs only when Chrome is awake/running near that scheduled time; missed wakeups are skipped rather than caught up later.
- Owner prefers development to move toward the real RA report generation/download flow early, while keeping parser/reconciliation modular and testable.
- Real customer data, IDs, screenshots, exports, and workbook details must stay out of Git.

## Runtime Baseline

- Extension starts disabled/hidden on Chrome startup. Activation via toolbar/action shortcut enables it for the session and prepares RaBiTool-owned HugMe and Planilha tabs inactive to the side.
- RaBiTool stores the group ID and tab IDs it created for the current extension load marker. On toggle it reuses only those current-load recorded tabs, not arbitrary existing tabs or old groups that merely happen to be named `RaBiTool`.
- If reserved tabs are missing or closed, activation or `RA > BI` creates fresh tabs and groups them as `RaBiTool`. Chrome tab groups only support named colors, so the group uses Chrome's `green` color as the closest match to the `RA > BI` button.
- Floating popup is injected into supported pages after activation.
- Current visible popup contains drag, gear, close, separator, outline `HugMe`/`Planilha` tracked-tab buttons, a `RA > BI` button, a loading/current-process line, and stacked warning/result notices.
- Current visual direction: white popup, gray icons/separator, green/light-green hover for chrome icons; tracked-tab buttons are outline-only and use green/check when ready, blue/spinner while checking, and red/X when blocked.
- Popup notice/log lines remain visually clean and show only the human-readable log text. Each notice still has a deterministic debug code derived from level/stage/text, for example `RBT-ERR-EXCEL-FIND-ANCHOR-...`; clicking a notice copies only the human message plus `Código: ...` at the end so the owner/colleagues can report precise failures without huge diagnostic payloads.
- `RA > BI` runs the current end-to-end guarded workflow: reserved tabs, HugMe report generation/download, XLSX parse/validation, Excel Web worksheet confirmation, anchor verification, and one-block paste.
- Stable workflow action names:
  - `RABITOOL_START_RA_TO_EXCEL`
  - `RABITOOL_PREPARE_RA_EXPORT`
  - `RABITOOL_PREPARE_EXCEL_IMPORT`
- Current implemented workflow scope: `RABITOOL_START_RA_TO_EXCEL` prepares reserved tabs, fills/submits the RA report form, waits in the HugMe page for the matching generated report to expose Download, clicks Download, waits for a matching XLSX download, fetches/reads the XLSX, validates required headers/rows/IDs/date ordering, stores normalized rows in service-worker memory, then uses a guarded Excel Web keyboard/debugger flow to find the oldest report ticket, verify the selected ID, and paste one TSV block into the mother sheet.
- The temporary `Test Paste` button/action and packaged local test XLSX were removed from dev and release builds.
- XLSX parser module: `project/background/xlsx_report_parser.js`. It reads XLSX ZIP/XML directly in the browser, detects the real header row, maps the 9 target columns by header, validates nonblank/unique `Id HugMe`, validates parseable `Data Reclamação`, and blocks if report dates are not ascending. Parsed rows are cached in service-worker memory for the next workflow step and are not persisted to Git/storage.
- Excel module: `project/background/excel_sheet.js`. It first tries DOM inspection when possible, but the reliable current path is Chrome Debugger keyboard automation against the focused Excel tab. It confirms the active worksheet tab is `Relatorio de Tickets`, uses Excel Find to locate the oldest report `Id HugMe`, confirms the Find dialog/input is actually visible and writable, confirms the Find field contains the expected ID, copies the selected cell to verify that exact anchor, then performs one contiguous TSV paste without pressing Enter afterward. The Excel Find/anchor flow refocuses and brings the workbook forward before Find attempts, looks for both explicit Excel grid selectors and broad visible workbook-like surfaces in the top document and all accessible frames, varies click points inside the chosen surface, tries multiple Find shortcut delivery variants when Excel Web does not expose the Find dialog, executes the filled Find search with real debugger Enter keys, waits progressively for Excel Web to settle, retries selected-cell copy/confirmation with increasingly patient waits, and reuses an already-correct selected anchor instead of reopening Find unnecessarily. English Excel Web uses `Ctrl+F`, while PT-BR Excel Web may use `Ctrl+L` for `Localizar`; the current implementation detects Portuguese/browser/ribbon signals and tries `Ctrl+L` first for PT-BR UI, then `Ctrl+F` as fallback. English/no-PT signals try `Ctrl+F` first, then `Ctrl+L`. If Find still cannot open or the found cell cannot be copied/verified, the error includes focus/search evidence and blocks with a specific stage such as `excel-worksheet`, `excel-find-anchor`, `excel-paste`, or `clipboard`.
- Before attaching Chrome Debugger to Excel, RaBiTool revalidates the tracked Planilha tab, focuses its window/tab, navigates that same tracked tab back to the configured Excel workbook URL if it drifted, and retries bounded attempts before blocking. If another extension or DevTools is actively controlling the Planilha tab through Chrome Debugger, Chrome cannot share that controller; RaBiTool must block and ask the user to stop that recording/inspection and run again.
- RaBiTool is intentionally non-destructive toward other extensions. It does not remove, detach, disable, or edit another extension's overlay/frame. If the Planilha contains a visible `chrome-extension://` iframe/frame/embed/object from a different extension, the Planilha status turns blocked with a short warning. The warning includes the interfering extension ID prefix and clicking it opens `chrome://extensions/?id=<extensionId>` in a focused side tab so the user can disable or adjust that extension manually. Hidden/zero-size extension frames are ignored so stale inactive frames do not keep the warning stuck after the user disables the interfering extension.
- The Excel Find preparation now stabilizes accidental user interaction before searching: it releases possible stuck mouse/key modifier states, sends Escape, refocuses the workbook surface, and clicks once to collapse accidental multi-cell selections before sending `Ctrl+F`/`Ctrl+L`.
- Current Excel focus alignment: because Excel Web paste/find/count uses user-like keyboard actions and clipboard reads, part 2 must assume focus on the Excel tab while it runs. This should be surfaced in popup status text, e.g. after `Validando Planilha Mae...`, show that the tool is assuming focus of the sheet for paste. Running the final Excel write fully in the background is not reliable without an API path, which is out of scope for now.
- Workspace tab behavior: activation and `RA > BI` prepare reserved HugMe `https://app.hugme.com.br/app.html#/dados/tickets/exportar/` and Planilha `https://eduzz.sharepoint.com/:x:/s/BI/IQD6u3ZLO0KJTLwdN11bRG8ZAS5Nj2f5Nry7-F5WpL1iDnE?e=qQorVa` tabs. The popup shows `HugMe`/`Planilha` half-width status buttons with spinner/check/X; clicking either button intentionally focuses that tracked tab for visual inspection.
- Workspace tabs listen continuously with Chrome tab update/remove events. If a tracked tab enters login/auth, the tool marks it blocked; after auth resolves to a non-target page, it automatically navigates the same tracked tab back to the required HugMe export URL or Planilha workbook URL.
- Chrome internal pages such as the default new tab / `chrome://newtab` cannot receive injected content-script UI, so the floating popup cannot appear on that page. Activation from there can still prepare the reserved workspace tabs; the popup appears once a supported web page or tracked workspace tab is focused.
- If reserved tabs are missing at `RA > BI` time, the action recreates and assigns them before proceeding. If reserved tabs cannot be prepared or required page elements do not load after bounded waits, stop with a clear stage/element error such as `Abas reservadas do HugMe e Planilha Mae nao preparadas`.
- Options page currently keeps the enable toggle/header, Chrome shortcut row, auto-run controls, release/version section, and popup preview. The version section checks GitHub Releases for `LorenzoBerto-Eduzz/RaBiTool`, compares the latest release tag with the running manifest version, looks for `RaBiTool.zip`, and offers a download button only when a newer package is available. The options-page popup preview also wires the `RA > BI` button to the real runtime action so missing-tab and workflow errors are visible there too. Extra support sections remain removed for simplicity.
- User-facing UI and status text should be in PT-BR with proper accents/punctuation. This includes the options page, popup controls/tooltips, manifest description, release README, workflow active-text lines, and blocking/error notices.
- Default popup placement is top-right. The popup remains draggable and saves deliberate dragged positions under the current top-right position key. Resize/zoom should not save new positions.
- Toolbar click and Chrome activation shortcut toggle shared `enabled` storage.
- Scheduled auto-run is independent from manual popup visibility. At its scheduled time it sets RaBiTool enabled so the popup/status can appear, prepares the reserved HugMe/Planilha tabs, and runs the same guarded `RA > BI` workflow. The Excel Web paste phase still focuses the Planilha tab because the current UI/clipboard method requires active workbook focus.
- Auto-run cleanup differs from manual runs: when an auto-run RA > BI execution completes successfully, RaBiTool automatically disables itself through the shared hard-shutdown path, closing the tracked HugMe/Planilha tabs and clearing workspace tracking. If the auto-run blocks, errors, hits login, or is skipped, the popup and tracked tabs stay open so the user can see the reason and recover manually. Manual RA > BI runs do not auto-close after completion.
- RA > BI has a service-worker in-memory run lock. Manual clicks and scheduled auto-run share the same entrypoint, so a second start request is skipped with a warning while the first run continues. The lock is released only after the current workflow finishes or errors.
- Toggle-off behavior is intentionally a hard shutdown for the current session. When the owner disables RaBiTool through the toolbar/shortcut, popup close button, or options toggle, the extension marks any active RA > BI workflow as canceled, closes the currently tracked HugMe and Planilha workspace tabs, clears workspace tab tracking, and sets `enabled=false`. This applies to manual and auto-run workflows. The active workflow checks the cancel flag between major stages and also fails closed when its controlled tabs are removed.

## Main Source Files

- `project/manifest.json`: name, permissions, content-script matches, commands.
- `project/background.js`: service worker import order.
- `project/background/config.js`: settings key and defaults.
- `project/background/workspace_tabs.js`: activation workspace tab opening/tracking/status/focus helpers.
- `project/background/xlsx_report_parser.js`: XLSX ZIP/XML reader and RA report normalizer.
- `project/background/reclame_aqui.js`: RA source/download scaffold.
- `project/background/excel_sheet.js`: Excel destination no-focus dry-run inspection and future paste support.
- `project/background/ra_bi_workflow.js`: workflow action names and orchestration scaffold.
- `project/background/autorun.js`: Chrome alarm scheduling, selected-day/time calculation, missed-run skipping, and scheduled RA > BI launch.
- `project/background/runtime.js`: runtime message routing.
- `project/content.js`: injected popup, shortcut behavior, workflow button handlers.
- `project/popup_ui.js`: shared popup markup and CSS.
- `project/options.html` / `project/options.js`: settings UI and popup preview.
- `project/offscreen.html` / `project/offscreen.js`: clipboard fallback support.

## Current Permissions

The prototype manifest includes:

- `storage`
- `tabs`
- `tabGroups`
- `scripting`
- `commands`
- `downloads`
- `alarms`
- `offscreen`
- `clipboardWrite`
- `clipboardRead`
- `debugger`
- `host_permissions`: `<all_urls>`
- content script `matches`: `<all_urls>`

Keep this broad only while discovering. Before release, narrow host permissions and content-script matches to Reclame Aqui and Excel Web hosts once the exact URLs are known.

## Next Required Alignments

Current recommended next work:

1. Smoke test the colleague release on a second Chrome profile/machine.
2. Refine Excel paste edge cases when Excel Find cannot locate the oldest incoming report ID.
3. Decide whether append-only fallback should be implemented for clearly newer reports.
4. Add post-paste validation if the owner wants an additional review guard.
5. Eventually narrow `<all_urls>` permissions to the HugMe and Excel Web hosts once discovery stabilizes.

## First Commit Gate

Before any project commit:

1. Confirm `.git-identity` has `GIT_ALLOWED_EMAIL="lorenzo.berto@eduzz.com"`.
2. Confirm local `git config user.email` is `lorenzo.berto@eduzz.com`.
3. Confirm local `git config core.hooksPath` is `.githooks`.
4. Run relevant JS syntax checks.
5. Commit locally.
6. Push only when a remote is configured and the owner asks for or expects push.

## Owner Workflow Commands

- `memcheck`: update durable project docs/meta memory only.
- `gitcheck`: perform `memcheck`, inspect and check the repo, verify Git identity guard when present, then stage, commit, and push if a remote is configured unless the owner says not to. Commit titles should start with the current extension version without brackets, for example `0.1.0 - Commit title`. Do not bump/change the extension version unless the owner explicitly asks for a version change.
- `localrelease`: refresh the generated local release folder from `project/` using `scripts/Export-LocalRelease.ps1`. Do not create a zip unless explicitly requested.
- `remoterelease`: only when explicitly requested, create the zipped local release artifact and publish/upload it to GitHub Releases for the current extension version. Use the version name for the release tag/title/description and upload `RaBiTool.zip`. Do not create or edit GitHub Releases unless the owner explicitly asks for `remoterelease` or gives a direct release instruction.
