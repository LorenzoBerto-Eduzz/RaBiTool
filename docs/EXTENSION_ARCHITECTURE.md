# Extension Architecture

RaBiTool is a no-build Chrome Manifest V3 extension.

## Runtime Files

- `project/manifest.json`: extension manifest, permissions, content scripts, service worker, options page, and command shortcut.
- `project/background.js`: service worker entrypoint that imports background modules in dependency order.
- `project/background/config.js`: shared settings key and default settings.
- `project/background/settings.js`: settings defaults, storage merge helpers, and install/update option opening.
- `project/background/chrome_tabs.js`: Chrome tab/window/query/injection helpers.
- `project/background/workspace_tabs.js`: reserved RA/BI tab opening, current-load tab-group tracking, readiness status, and explicit focus helpers.
- `project/background/clipboard.js`: offscreen clipboard helper for Excel Web paste/import flows.
- `project/background/xlsx_report_parser.js`: direct XLSX ZIP/XML reader and 9-column RA report normalizer.
- `project/background/reclame_aqui.js`: Reclame Aqui source-page automation, HugMe page-side report/download watcher, and Chrome XLSX download detection.
- `project/background/excel_sheet.js`: Excel Web worksheet guard, keyboard/debugger Find navigation, anchor verification, TSV preparation, clipboard copy, and one-block paste.
- `project/background/ra_bi_workflow.js`: workflow action names and orchestration scaffold.
- `project/background/runtime.js`: Chrome runtime listeners, workflow registration map, popup/settings message routing, and side-tab helper.
- `project/content.js`: injected into matching pages. Owns popup creation/binding, popup position, extension toggle behavior, shortcut handling, and workflow button status.
- `project/popup_ui.js`: pure shared popup markup and CSS string factory.
- `project/options.html`: options page markup.
- `project/options.js`: options UI logic, storage, Chrome shortcut display/shortcut-settings link, and options-page popup preview with the same `RA > BI` runtime action wiring.
- `project/offscreen.html` / `project/offscreen.js`: clipboard fallback document.

## Workflow Boundaries

Keep workflow code separated by responsibility:

- RA source automation: `background/reclame_aqui.js`.
- Download discovery: `background/reclame_aqui.js`.
- XLSX parsing and report normalization: `background/xlsx_report_parser.js`.
- Excel destination inspection/automation: `background/excel_sheet.js`.
- Cross-step orchestration and status shape: `background/ra_bi_workflow.js`.
- User controls/status: `popup_ui.js`, `content.js`, and the options-page popup binding in `options.js`.

When the exact page steps are known, implement them as named helpers with clear stages:

1. target tab discovery/opening;
2. page readiness check;
3. selector/action execution;
4. download completion detection;
5. row parsing/preparation;
6. Excel tab discovery without activation when possible;
7. destination range inspection/preparation;
8. import/paste/replace action;
9. status reporting.

## Current Popup

The popup is compact and fixed-position:

- drag handle;
- options gear;
- close button;
- `HugMe` and `Planilha` tracked-tab status/focus buttons;
- `RA > BI` main action;
- loading/current-process line;
- stacked warning/result notices.

The tracked-tab buttons are outline-only: green/check means ready, blue/spinner means checking/loading, and red/X means blocked or login/permisson needed. The `RA > BI` button calls the RA export/download/parser and guarded Excel Web keyboard paste workflow. The temporary `Test Paste` button/action and local test XLSX were removed from dev and release builds. The default placement is top-right; dragging saves the position, while browser resize/zoom should only keep the popup visible and should not save a new position.

## Workspace Tabs

RaBiTool owns a reserved pair of HugMe/Planilha tabs. On activation and on `RA > BI`, it prepares the assigned tabs. It reuses only the tab IDs and Chrome group ID recorded by RaBiTool for the current extension load marker; it does not scan arbitrary existing tabs or trust an old group merely because it is named `RaBiTool`.

Assigned tabs are grouped as `RaBiTool` when Chrome allows it. Chrome tab groups support named colors rather than custom hex colors, so the extension uses Chrome's `green` group color as the closest available match to the `RA > BI` button.

## Permissions

Prototype permissions:

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

Before release or sharing, narrow host permissions and content-script matches to the actual Reclame Aqui and Excel Web hosts.

## UI Automation Notes

This project intentionally uses browser UI automation instead of API integrations. That means implementation should avoid brittle timing guesses where possible:

- wait for observable DOM states;
- check active URLs and page readiness;
- report the exact failed stage;
- keep selectors documented;
- prefer explicit owner-confirmed button labels/selectors;
- use clipboard/import only where Chrome and Excel Web allow it reliably.
- for the current Excel Web write path, explicitly focus the Excel tab before keyboard/debugger actions and clearly show that step in popup status text.

## Local Release Exports

`scripts/Export-LocalRelease.ps1` creates the generated local release folder at the repo root. Do not run it unless the owner explicitly asks for a local release/export. Zip files should only be created when the owner explicitly asks for a zip.
