# RaBiTool

Chrome Manifest V3 extension for automating a Reclame Aqui to Excel BI workflow.

RaBiTool is intended to run inside Chrome, interact with the Reclame Aqui web UI, download/export an XLSX file, transform or prepare the exported rows, and bring that data into a mother sheet opened in Excel Web. A separate downstream BI process consumes that mother sheet later.

## Current State

- Source folder: `project/`
- Stack: plain JavaScript, HTML, CSS, Chrome extension APIs
- Build step: none
- Load unpacked from `project/`
- Workflow mode: browser UI automation, not API/OAuth
- Initial destination: Excel Web
- Initial source: Reclame Aqui export/download page

## Included Baseline

- Compact floating popup with drag, options gear, close button, and workflow buttons.
- Options page with enable toggle, Chrome shortcut display, popup preview, and project workflow summary.
- Background modules for settings, tab helpers, clipboard helper, download lookup, RA scaffolding, Excel scaffolding, and workflow routing.
- Durable AI memory docs under `docs/`.
- Local release export script.

## First Workflow Shape

1. Navigate or operate on the configured Reclame Aqui page.
2. Apply the owner-specified filters and actions.
3. Trigger and/or detect the XLSX download.
4. Read or prepare the downloaded/exported rows.
5. Open/focus the Excel Web mother sheet.
6. Replace or append rows according to the configured placement rules.

Exact RA selectors, date/filter behavior, Excel workbook URL, worksheet name, target range, and row-mapping rules still need owner alignment before implementation.

## Load In Chrome

Load unpacked from:

```text
C:\C.Nvme\Projects\RaBiTool\project
```

## Checks

```powershell
node --check project/background.js
Get-ChildItem project/background -Filter *.js | ForEach-Object { node --check $_.FullName }
node --check project/content.js
node --check project/popup_ui.js
node --check project/options.js
```

## Owner Workflow Commands

- `memcheck`: update durable project memory/docs only.
- `gitcheck`: do `memcheck`, inspect and check the repo, then stage/commit/push when a remote is configured unless told otherwise.
- `localrelease`: refresh the generated release folder from `project/`; do not create a zip unless explicitly asked.
