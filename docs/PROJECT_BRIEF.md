# Project Brief

## Identity

- Project name: `RaBiTool`
- Project kind: Chrome Manifest V3 extension
- Source folder: `project/`
- Stack: plain JavaScript, HTML, CSS, Chrome extension APIs
- Current manifest version: `0.1.0`

## Purpose

RaBiTool automates the operational bridge between Reclame Aqui exports and an Excel Web mother sheet used by BI.

The owner wants a Chrome extension that can operate through normal browser pages: click buttons, wait for pages, trigger or detect an XLSX download from Reclame Aqui, and then bring that data into a specific Excel sheet in the required row structure.

The project should be developed as a reliable business-data workflow, not as a loose page-click macro. Correctness, validation, clear failure states, and modularity matter more than rushing to automate every click.

## Product Direction

- Source system: Reclame Aqui.
- Transfer format: XLSX export.
- Destination system: Excel Web mother sheet.
- Automation mode: browser UI automation.
- API/OAuth integrations: out of scope for the initial approach.
- Downstream BI app: out of scope; it consumes the mother sheet later.

## Core Objects

- Incoming report: the fresh RA/HugMe XLSX file produced by the export flow.
- Mother sheet: the large Excel Web BI input sheet that must be updated carefully.
- Parser/reconciliation layer: the business logic that maps report rows into the mother-sheet shape and decides what to update, insert, or leave untouched.

## Initial Scope

- Project identity and settings renamed to RaBiTool.
- Popup has project workflow controls and status text.
- Background workflow action names are stable.
- RA export/download automation exists for the current HugMe flow, including a page-side watcher for the generated report's Download button and Chrome XLSX download detection by title token.
- Excel import modules now include XLSX parser/validation, active worksheet guard, keyboard/debugger anchor verification, clipboard TSV preparation, and one-block paste through Excel Web when guards pass.
- Downloads, offscreen clipboard, tabs, tab groups, scripting, debugger, and commands are available for the prototype.
- Optional scheduled auto-run uses Chrome alarms, with an off-by-default config section for local time and active weekdays.
- Activation and `RA > BI` use RaBiTool-owned reserved HugMe/Planilha tabs. Current-load group/tab IDs are reused; arbitrary pre-existing tabs or stale groups named `RaBiTool` are ignored.
- Disabling/toggling off RaBiTool is now a hard session shutdown: it cancels any active RA > BI workflow, closes the tracked HugMe and Planilha tabs, clears workspace tracking, and sets the extension disabled.
- User-facing extension text should be PT-BR with correct accents in popup, options page, manifest description, workflow statuses, and blocking/error messages.
- Broad host permissions remain during discovery.
- Durable docs capture the current two-spreadsheet model and alignment-first development plan.
- Popup visual baseline is a clean white shell with gray controls and green hover.

## Out Of Scope For Now

- Additional Reclame Aqui filters or changed button flows beyond the currently aligned HugMe export path.
- API/OAuth/Graph-based Excel writes. The current path is focused browser UI automation.
- Parsing real customer XLSX exports committed to the repo.
- API integrations with Reclame Aqui, Microsoft Graph, or other external services.
- GitHub release publishing unless the owner explicitly asks for `remoterelease`.

## Constraints

- Keep real exported data, account details, workbook URLs, screenshots, IDs, CPFs/CNPJs, emails, credentials, and tokens out of Git.
- Use fake examples in docs and tests.
- Prefer modular workflow helpers over large hidden timing assumptions.
- Treat web UI automation as inherently fragile; document selectors and page assumptions when implemented.
- Fail closed when business data validation is uncertain.
- Prefer header-name mapping and explicit validation over fixed column positions.
- Avoid touching unrelated mother-sheet rows outside the affected time span.
- Keep one contiguous Excel paste as the write action whenever possible so Excel Web undo remains simple.
- Treat Excel Web UI automation as focused-tab automation. Guard Excel Find by proving the Find dialog, searched ID, and selected anchor cell before pasting.
- After validation guards pass, optimize for quick/automatic execution.
- Next planned project direction is using the GitHub remote/release flow and later adding a config-page version/download section.

## Owner Workflow Commands

- `memcheck`: update durable docs/meta memory so future AIs, future sessions, and other devices can continue with the same understanding.
- `gitcheck`: perform `memcheck`, inspect the worktree, run relevant checks, verify Git identity guard, stage, commit, and push when a remote is configured unless the owner says not to.
- `localrelease`: refresh the generated release folder from `project/` using the local release script. It does not create a zip unless the owner explicitly asks for one.
- `remoterelease`: only when explicitly requested, create the zipped local release artifact and publish/upload it to GitHub Releases for the current manifest version. Version bumps and GitHub release creation/editing are never automatic.
