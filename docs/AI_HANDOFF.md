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
- Owner prefers development to move toward the real RA report generation/download flow early, while keeping parser/reconciliation modular and testable.
- Real customer data, IDs, screenshots, exports, and workbook details must stay out of Git.

## Runtime Baseline

- Extension starts disabled/hidden on Chrome startup. Activation via toolbar/action shortcut enables it for the session and prepares RaBiTool-owned HugMe and Planilha tabs inactive to the side.
- RaBiTool stores the group ID and tab IDs it created for the current extension load marker. On toggle it reuses only those current-load recorded tabs, not arbitrary existing tabs or old groups that merely happen to be named `RaBiTool`.
- If reserved tabs are missing or closed, activation or `RA > BI` creates fresh tabs and groups them as `RaBiTool`. Chrome tab groups only support named colors, so the group uses Chrome's `green` color as the closest match to the `RA > BI` button.
- Floating popup is injected into supported pages after activation.
- Current visible popup contains drag, gear, close, separator, outline `HugMe`/`Planilha` tracked-tab buttons, a `RA > BI` button, a loading/current-process line, and stacked warning/result notices.
- Current visual direction: white popup, gray icons/separator, green/light-green hover for chrome icons; tracked-tab buttons are outline-only and use green/check when ready, blue/spinner while checking, and red/X when blocked.
- `RA > BI` runs the current end-to-end guarded workflow: reserved tabs, HugMe report generation/download, XLSX parse/validation, Excel Web worksheet confirmation, anchor verification, and one-block paste.
- Stable workflow action names:
  - `RABITOOL_START_RA_TO_EXCEL`
  - `RABITOOL_PREPARE_RA_EXPORT`
  - `RABITOOL_PREPARE_EXCEL_IMPORT`
- Current implemented workflow scope: `RABITOOL_START_RA_TO_EXCEL` prepares reserved tabs, fills/submits the RA report form, waits in the HugMe page for the matching generated report to expose Download, clicks Download, waits for a matching XLSX download, fetches/reads the XLSX, validates required headers/rows/IDs/date ordering, stores normalized rows in service-worker memory, then uses a guarded Excel Web keyboard/debugger flow to find the oldest report ticket, verify the selected ID, and paste one TSV block into the mother sheet.
- The temporary `Test Paste` button/action and packaged local test XLSX were removed from dev and release builds.
- XLSX parser module: `project/background/xlsx_report_parser.js`. It reads XLSX ZIP/XML directly in the browser, detects the real header row, maps the 9 target columns by header, validates nonblank/unique `Id HugMe`, validates parseable `Data Reclamação`, and blocks if report dates are not ascending. Parsed rows are cached in service-worker memory for the next workflow step and are not persisted to Git/storage.
- Excel module: `project/background/excel_sheet.js`. It first tries DOM inspection when possible, but the reliable current path is Chrome Debugger keyboard automation against the focused Excel tab. It confirms the active worksheet tab is `Relatorio de Tickets`, uses Excel Find (`Ctrl+F`) to locate the oldest report `Id HugMe`, copies the selected cell to verify that exact anchor, then performs one contiguous TSV paste without pressing Enter afterward. If proof is insufficient, it blocks with a specific stage such as `excel-worksheet`, `excel-find-anchor`, `excel-paste`, or `clipboard`.
- Current Excel focus alignment: because Excel Web paste/find/count uses user-like keyboard actions and clipboard reads, part 2 must assume focus on the Excel tab while it runs. This should be surfaced in popup status text, e.g. after `Validando Planilha Mae...`, show that the tool is assuming focus of the sheet for paste. Running the final Excel write fully in the background is not reliable without an API path, which is out of scope for now.
- Workspace tab behavior: activation and `RA > BI` prepare reserved HugMe `https://app.hugme.com.br/app.html#/dados/tickets/exportar/` and Planilha `https://eduzz.sharepoint.com/:x:/s/BI/IQD6u3ZLO0KJTLwdN11bRG8ZAS5Nj2f5Nry7-F5WpL1iDnE?e=qQorVa` tabs. The popup shows `HugMe`/`Planilha` half-width status buttons with spinner/check/X; clicking either button intentionally focuses that tracked tab for visual inspection.
- Workspace tabs listen continuously with Chrome tab update/remove events. If a tracked tab enters login/auth, the tool marks it blocked; after auth resolves to a non-target page, it automatically navigates the same tracked tab back to the required HugMe export URL or Planilha workbook URL.
- Chrome internal pages such as the default new tab / `chrome://newtab` cannot receive injected content-script UI, so the floating popup cannot appear on that page. Activation from there can still prepare the reserved workspace tabs; the popup appears once a supported web page or tracked workspace tab is focused.
- If reserved tabs are missing at `RA > BI` time, the action recreates and assigns them before proceeding. If reserved tabs cannot be prepared or required page elements do not load after bounded waits, stop with a clear stage/element error such as `Abas reservadas do HugMe e Planilha Mae nao preparadas`.
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
- `tabGroups`
- `scripting`
- `commands`
- `downloads`
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
- `gitcheck`: perform `memcheck`, inspect and check the repo, verify Git identity guard when present, then stage, commit, and push if a remote is configured unless the owner says not to.
- `localrelease`: refresh the generated local release folder from `project/` using `scripts/Export-LocalRelease.ps1`. Do not create a zip unless explicitly requested.
