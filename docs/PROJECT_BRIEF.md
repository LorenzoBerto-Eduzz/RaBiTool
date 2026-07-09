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

## Product Direction

- Source system: Reclame Aqui.
- Transfer format: XLSX export.
- Destination system: Excel Web mother sheet.
- Automation mode: browser UI automation.
- API/OAuth integrations: out of scope for the initial approach.
- Downstream BI app: out of scope; it consumes the mother sheet later.

## Initial Scope

- Project identity and settings renamed to RaBiTool.
- Popup gets project workflow controls and status text.
- Background workflow action names are stable.
- RA export and Excel import modules exist as scaffolds.
- Downloads, offscreen clipboard, tabs, scripting, and commands are available for the prototype.
- Broad host permissions remain during discovery.

## Out Of Scope For Now

- Exact Reclame Aqui selectors and button flows until supplied by the owner.
- Exact Excel worksheet/range placement until supplied by the owner.
- Parsing real customer XLSX exports committed to the repo.
- API integrations with Reclame Aqui, Microsoft Graph, or other external services.
- Public release packaging.

## Constraints

- Keep real exported data, account details, workbook URLs, screenshots, IDs, CPFs/CNPJs, emails, credentials, and tokens out of Git.
- Use fake examples in docs and tests.
- Prefer modular workflow helpers over large hidden timing assumptions.
- Treat web UI automation as inherently fragile; document selectors and page assumptions when implemented.

## Owner Workflow Commands

- `memcheck`: update durable docs/meta memory so future AIs, future sessions, and other devices can continue with the same understanding.
- `gitcheck`: perform `memcheck`, inspect the worktree, run relevant checks, verify Git identity guard, stage, commit, and push when a remote is configured unless the owner says not to.
- `localrelease`: refresh the generated release folder from `project/` using the local release script. It does not create a zip unless the owner explicitly asks for one.
