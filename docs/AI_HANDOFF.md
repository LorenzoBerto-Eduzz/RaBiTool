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
- Initial branch should be `main`.
- First project baseline commit has been created locally.
- No remote is configured yet; pushing is deferred until the owner adds/chooses a remote.
- Support placeholders remain intentionally unconfigured for now.
- Allowed Git email for this project: `lorenzo.berto@eduzz.com`.
- Git identity guard is enabled locally with `.git-identity`, `git config user.email`, and `git config core.hooksPath .githooks`.

## Product Purpose

RaBiTool automates a Reclame Aqui to Excel BI workflow.

The owner is still aligning exact behavior. The current broad understanding is:

1. Use the Reclame Aqui web UI in Chrome.
2. Select filters/actions specified by the owner.
3. Download or detect an XLSX export from Reclame Aqui.
4. Extract/prepare the exported rows.
5. Open or focus a mother sheet in Excel Web.
6. Insert the rows in the required structure, likely by replacing or appending rows.

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
- Both report and mother sheet must be sorted ascending by `Data Reclamação`; if not, the tool should block before writing.
- First reconciliation strategy: find the oldest incoming report ticket in the mother sheet, validate the overlap through the current most recent mother-sheet ticket, then replace from the oldest matching mother-sheet row downward with normalized report rows.
- Safety rule: if overlap row counts between mother sheet and report do not match, stop and show an error rather than writing.
- Append-only rule: if the oldest report ticket is not found in the mother sheet, append at the end only when the report is clearly newer than the current mother-sheet tail.
- Excel Web write requirement: prefer one contiguous paste action for the prepared affected range so the owner can use a single `Ctrl+Z` in Excel Web to revert the extension's write during review/testing. Avoid multi-step cell-by-cell writes unless explicitly realigned, because they may fragment Excel's undo stack.
- RA form setup alignment: on `https://app.hugme.com.br/app.html#/dados/tickets/exportar/`, choose company `Eduzz`, fill a timestamped title `RaBiToolRelatoriohhmmssddmmyy`, choose period `A definir`, type date fields as `ddmmyyyy` with start date execution date minus 45 days and end date execution date, press Enter after each date so HugMe formats slashes, select order field `Data Reclamação`, select order type `ascendente`, select all columns, and click `Gerar relatório`.
- RA processing/download alignment: after submit, locate the matching `Meus relatórios` item by exact title, poll every 2 seconds while it shows `Processando relatório...`, block after 420 seconds if not ready, then click that same item's visible `Download` button when available. Track the resulting Chrome XLSX download by matching the generated title when possible and otherwise by a fresh XLSX started after the click.
- Once all guards pass, owner prefers the workflow to proceed automatically/quickly rather than requiring extra confirmation.
- Owner prefers development to move toward the real RA report generation/download flow early, while keeping parser/reconciliation modular and testable.
- Real customer data, IDs, screenshots, exports, and workbook details must stay out of Git.

## Runtime Baseline

- Extension starts disabled/hidden on Chrome startup. Activation via toolbar/action shortcut enables it for the session and opens/reuses the RA and BI workspace tabs inactive to the side.
- Floating popup is injected into supported pages after activation.
- Current visible popup contains drag, gear, close, separator, outline `HugMe`/`Planilha` tracked-tab buttons, a `RA > BI` button, a loading/current-process line, and stacked warning/result notices.
- Current visual direction: white popup, gray icons/separator, green/light-green hover for chrome icons; tracked-tab buttons are outline-only and use green/check when ready, blue/spinner while checking, and red/X when blocked.
- `RA > BI` currently runs the first test implementation of the RA export/download path.
- Stable workflow action names:
  - `RABITOOL_START_RA_TO_EXCEL`
  - `RABITOOL_PREPARE_RA_EXPORT`
  - `RABITOOL_PREPARE_EXCEL_IMPORT`
- These actions currently return structured "not configured yet" responses until exact RA/Excel steps are supplied.
- Current implemented test scope: `RABITOOL_START_RA_TO_EXCEL` requires both RA and Excel tabs, fills/submits the RA report form, polls the matching generated report, clicks Download, waits for a matching XLSX download, and then stops with a success message showing the detected filename. XLSX parsing, Excel inspection, and actual paste/write are intentionally deferred until the owner confirms the download leg is solid.
- XLSX parser module: `project/background/xlsx_report_parser.js`. It reads XLSX ZIP/XML directly in the browser, detects the real header row, maps the 9 target columns by header, validates nonblank/unique `Id HugMe`, validates parseable `Data Reclamação`, and blocks if report dates are not ascending. Parsed rows are cached in service-worker memory for the next workflow step and are not persisted to Git/storage.
- Excel dry-run module: `project/background/excel_sheet.js`. It injects into the Excel tab without activating it, tries to detect the configured worksheet, readable grid cells, the 9 required headers, visible data rows, and the oldest report `Id HugMe` as an anchor. If Excel Web does not expose enough DOM/cell state in a background tab, it blocks with `excel-inspect`, `excel-headers`, `excel-data-window`, or `excel-anchor` instead of writing.
- Workspace tab behavior: activation opens/reuses and tracks HugMe `https://app.hugme.com.br/app.html#/dados/tickets/exportar/` and Planilha `https://eduzz.sharepoint.com/:x:/s/BI/IQD6u3ZLO0KJTLwdN11bRG8ZAS5Nj2f5Nry7-F5WpL1iDnE?e=qQorVa` as inactive side tabs. The popup shows `HugMe`/`Planilha` half-width status buttons with spinner/check/X; clicking either button intentionally focuses that tracked tab for visual inspection.
- Workspace tabs listen continuously with Chrome tab update/remove events. If a tracked tab enters login/auth, the tool marks it blocked; after auth resolves to a non-target page, it automatically navigates the same tracked tab back to the required HugMe export URL or Planilha workbook URL.
- Chrome internal pages such as the default new tab / `chrome://newtab` cannot receive injected content-script UI, so the floating popup cannot appear on that page. Activation from there can still open/reuse workspace tabs; the popup appears once a supported web page or tracked workspace tab is focused.
- If required tabs are missing/not ready during `RA > BI`, stop with the clear popup error `Abas do HugMe e Planilha Mae nao preparadas` or with a more specific HugMe/Planilha readiness warning. If tabs exist but required elements are not loaded yet, wait/retry briefly; if still missing, stop with a clear stage/element error.
- Options page currently keeps only the enable toggle/header, Chrome shortcut row, and popup preview. The options-page popup preview also wires the `RA > BI` button to the real runtime action so missing-tab and workflow errors are visible there too. Extra workflow/support/version sections were removed for simplicity.
- Default popup placement is top-right. The popup remains draggable and saves deliberate dragged positions under the current top-right position key. Resize/zoom should not save new positions.
- Toolbar click and Chrome activation shortcut toggle shared `enabled` storage.

## Main Source Files

- `project/manifest.json`: name, permissions, content-script matches, commands.
- `project/background.js`: service worker import order.
- `project/background/config.js`: settings key and defaults.
- `project/background/workspace_tabs.js`: activation workspace tab opening/tracking/status/focus helpers.
- `project/background/xlsx_report_parser.js`: XLSX ZIP/XML reader and RA report normalizer.
- `project/background/reclame_aqui.js`: RA source/download scaffold.
- `project/background/excel_sheet.js`: Excel destination no-focus dry-run inspection and future paste support.
- `project/background/ra_bi_workflow.js`: workflow action names and orchestration scaffold.
- `project/background/runtime.js`: runtime message routing.
- `project/content.js`: injected popup, shortcut behavior, workflow button handlers.
- `project/popup_ui.js`: shared popup markup and CSS.
- `project/options.html` / `project/options.js`: settings UI and popup preview.
- `project/offscreen.html` / `project/offscreen.js`: clipboard fallback support.

## Current Permissions

The prototype manifest includes:

- `storage`
- `tabs`
- `scripting`
- `commands`
- `downloads`
- `offscreen`
- `clipboardWrite`
- `host_permissions`: `<all_urls>`
- content script `matches`: `<all_urls>`

Keep this broad only while discovering. Before release, narrow host permissions and content-script matches to Reclame Aqui and Excel Web hosts once the exact URLs are known.

## Next Required Alignments

Before implementing the real workflow, align with the owner in this order:

1. Data contract: required report headers, target mother-sheet headers, data types, optional fields, and validation rules.
2. Reconciliation behavior: refine edge cases around missing oldest report ticket, missing current most recent mother-sheet ticket, sorting validation, append-only behavior, and confirmation before write.
3. Safety gates: what blocks execution versus what only warns.
4. Report intake method: direct capture/fetch of the downloaded XLSX versus file-picker fallback.
5. Excel Web write method: workbook/tab/range, paste/import strategy, and validation after writing. Owner prefers no tab focus/switching unless absolutely required; if final paste needs focus, the tool should make that explicit rather than silently stealing view.
6. Exact RA page automation: URL, filters, buttons, processing state, reload/check behavior, and download trigger.
7. Popup/meta workflow: statuses, confirmations, keybinds, tab checks, and recovery flows.

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
- `gitcheck`: perform `memcheck`, inspect and check the repo, verify Git identity guard when present, then stage, commit, and push if a remote is configured unless the owner says not to.
- `localrelease`: refresh the generated local release folder from `project/` using `scripts/Export-LocalRelease.ps1`. Do not create a zip unless explicitly requested.
