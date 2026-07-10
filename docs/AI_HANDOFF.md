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
- Once all guards pass, owner prefers the workflow to proceed automatically/quickly rather than requiring extra confirmation.
- Owner prefers development to move toward the real RA report generation/download flow early, while keeping parser/reconciliation modular and testable.
- Real customer data, IDs, screenshots, exports, and workbook details must stay out of Git.

## Runtime Baseline

- Floating popup is injected into supported pages.
- Current visible popup shell contains drag, gear, close, separator, and empty body.
- Current visual direction: white popup, gray icons/separator, green/light-green hover for icons.
- Workflow buttons are intentionally hidden until button behavior is aligned.
- Stable workflow action names already exist for future popup buttons:
  - `RABITOOL_START_RA_TO_EXCEL`
  - `RABITOOL_PREPARE_RA_EXPORT`
  - `RABITOOL_PREPARE_EXCEL_IMPORT`
- These actions currently return structured "not configured yet" responses until exact RA/Excel steps are supplied.
- Options page shows enable toggle, Chrome shortcut row, popup preview, support placeholders, and workflow summary.
- Toolbar click and Chrome activation shortcut toggle shared `enabled` storage.

## Main Source Files

- `project/manifest.json`: name, permissions, content-script matches, commands.
- `project/background.js`: service worker import order.
- `project/background/config.js`: settings key and defaults.
- `project/background/reclame_aqui.js`: RA source/download scaffold.
- `project/background/excel_sheet.js`: Excel destination scaffold.
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
5. Excel Web write method: workbook/tab/range, paste/import strategy, and validation after writing.
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
