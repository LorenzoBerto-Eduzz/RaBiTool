# RaBiTool Workflow Spec

This file tracks the operational details for the Reclame Aqui to Excel Web automation. Keep real customer data, private URLs, real IDs, screenshots, and exported files out of Git.

## Goal

Move data from a Reclame Aqui XLSX export into the Excel Web mother sheet that feeds the downstream BI process.

## Conceptual Model

RaBiTool deals with two separate spreadsheet objects:

1. Incoming report: the newly downloaded Reclame Aqui/HugMe XLSX export. This is raw source data with many columns, export/title rows before the real header, and a limited report time span.
2. Mother sheet: the large Excel Web destination table used by BI. This has the clean target layout, many historical rows, and must be updated without damaging unrelated rows.

The sample workbook previously inspected only demonstrates these two shapes in one file:

- `Sheet1` represents a small snippet of the mother-sheet layout.
- `Sheet2` represents one downloaded report shape.

In production these are separate objects: a fresh downloaded report and the real Excel Web mother sheet.

## Confirmed Direction

- Source: Reclame Aqui web UI.
- Source page currently expected around `https://app.hugme.com.br/app.html#/dados/tickets/exportar/`.
- Export type: XLSX.
- Destination: Excel Web.
- Automation method: browser UI interactions, page waits, downloads, clipboard/import where needed.
- Initial destination behavior: replace rows or append rows, exact rule pending.
- API/OAuth integration: not planned for the initial version.
- Business requirement: stability and correctness are more important than speed or convenience. The tool should stop with a clear reason rather than guess.
- Execution behavior: once guards pass, the owner wants the workflow to be as automatic/quick as practical, without unnecessary confirmation friction.
- Development preference: owner prefers moving toward the real RA report generation/download flow early, rather than only building a manual file-import prototype first. Parser/reconciliation should still remain modular and testable.

## Sample Workbook Structure

The owner provided a private local sample workbook for structural inspection only. Do not copy it into Git and do not record private row-level data from it.

- `Sheet1`: mother-sheet sample.
- `Sheet2`: downloaded Reclame Aqui/HugMe report sample.
- `Sheet1` header row: row 1.
- `Sheet2` report header row: row 4. Rows above it are export/title noise.
- `Sheet1` sample had 9 active columns.
- `Sheet2` sample had 79 active headers across 80 columns.
- `Sheet2` sample rows had unique `Id HugMe` values in the inspected export.

### Current Mother-Sheet Column Contract

The current first working version of RaBiTool should write exactly these mother-sheet columns because the downstream BI reader depends on this layout. Future versions may add or change columns, so implementation should keep the mapping centralized and header-based.

Every current mother-sheet column has a direct header match in the RA export:

| Mother Sheet Column | RA Export Column |
| --- | --- |
| Id HugMe | Id HugMe |
| Data Reclamação | Data Reclamação |
| Tags | Tags |
| Seu problema foi resolvido? | Seu problema foi resolvido? |
| Voltaria a fazer negócio? | Voltaria a fazer negócio? |
| Nota | Nota |
| Tempo primeira resposta (público) | Tempo primeira resposta (público) |
| Atribuido Para | Atribuido Para |
| Tipo de Cliente | Tipo de Cliente |

Current likely key fields:

- Primary identity key: `Id HugMe`. Owner confirmed this is the unique ticket/case id and is the first mother-sheet column.
- Time/order key: `Data Reclamação`.
- Sort requirement: both the incoming report and the mother sheet must be ordered by `Data Reclamação` oldest to newest. This is a crucial safety guard because the reconciliation algorithm depends on oldest report row, current mother-sheet tail, and overlap row counts.

## Intended Pipeline

Keep the workflow staged and modular:

1. RA page controller: operates on HugMe/RA page elements, fills filters, clicks `Gerar relatorio`, detects processing/ready states, and finds the download action.
2. Report intake: obtains the XLSX contents from the generated report. Prefer a captured/fetched report blob or URL; use a user file-picker fallback only if Chrome download access blocks direct parsing.
3. XLSX parser: detects the real header row, validates required headers, maps by header names, normalizes values, and rejects malformed reports.
4. Reconciliation engine: compares normalized report rows to the relevant mother-sheet window. It should use `Id HugMe` for identity and `Data Reclamação` for time span/sorting.
5. Excel Web writer: writes the prepared result into the mother sheet through the approved UI-based method.
6. Safety/reporting layer: presents row counts, date spans, duplicate IDs, expected changes, and exact failure stages in the popup.

## Tab Preconditions

For the current implementation phase, RaBiTool opens/reuses the RA and mother-sheet workspace tabs when the extension is activated.

- Chrome startup should leave the extension disabled/hidden.
- Toolbar/action shortcut activation enables the extension and opens/reuses RA and BI tabs inactive to the side.
- The extension tracks the tab IDs for RA and BI.
- RAtoBI should use the tracked RA/HugMe export tab and Excel Web mother-sheet tab.
- If either tab is missing/not ready during execution, stop before doing work and show `Abas do HugMe e Planilha Mae nao preparadas` or a more specific HugMe/Planilha readiness warning.
- If the tabs exist but required page elements are not present yet, wait briefly/retry for the expected elements.
- If required elements still do not appear after the bounded wait, stop with a clear error naming the missing stage/element.
- The `HugMe`/`Planilha` buttons in the popup show readiness status and intentionally focus the tracked tab when clicked.
- The background should continuously listen to tracked tab URL/status changes. When login/auth is detected, mark the tab blocked; after login resolves away from auth but not on the target page, automatically navigate that same tracked tab back to the exact target URL.
- The floating popup cannot appear on Chrome internal pages such as the default new tab / `chrome://newtab`, because Chrome does not allow extension content scripts there.

## Business Safety Principles

- Fail closed. If the tool cannot prove that headers, IDs, dates, target columns, or target range are correct, it must stop.
- Use header names instead of fixed column positions whenever possible.
- Do not touch unrelated historical rows outside the affected date span.
- Do not rewrite the full mother sheet unless explicitly aligned later.
- Treat `Id HugMe` as the likely upsert identity key, pending final owner confirmation.
- Treat `Data Reclamação` as the likely affected-window and ordering key, pending final owner confirmation.
- Validate row counts before and after any write.
- Detect duplicate IDs in the incoming report and in the affected mother-sheet window.
- Surface a summary before destructive replace/update behavior when practical.
- Keep real exports, real workbook URLs, customer data, CPFs/CNPJs, emails, names, phones, screenshots, and tokens out of Git.

## Pending Source Details

- Reclame Aqui URL: likely `https://app.hugme.com.br/app.html#/dados/tickets/exportar/`.
- Required login/session assumptions:
- Create-report page DOM has been inspected from a pasted page snapshot. Use selectors/labels cautiously because the app is Angular and may change classes/states.
- Empresa dropdown: `select.empresa`, choose label `Eduzz`.
- Titulo field: `input.titulo`, fill `RaBiToolRelatoriohhmmssddmmyy` where the numeric suffix is execution time in `hhmmssddmmyy` format.
- Periodo mode: choose radio `#periodoADefinir` / label `A definir`.
- Periodo start field: `#starty`, type/paste date as `ddmmyyyy`, set to current execution date minus 45 days, then press Enter so HugMe formats slashes.
- Periodo end field: `#endy`, type/paste date as `ddmmyyyy`, set to current execution date, then press Enter.
- Date fields must be validated before report generation: the tool should block if either field remains as raw digits and does not become `dd/mm/yyyy` after Enter/blur/change events.
- Ordenacao field: `select.order`, owner asked for `Data Reclamação`.
- Ordenacao type: `select.order-type`, owner corrected this to `ascendente` so the report has oldest rows first and latest rows at the bottom, matching the mother sheet.
- Personalizar colunas: checkbox `#selAll`, select all columns.
- Submit: button text `Gerar relatório`, `ng-click="submitFilter();"`.
- Field-setting logic should first check current values and only change fields when needed.
- Generated report list: under `Meus relatórios`, each active report appears as `li.item` with title in `h5`.
- Generated report tracking: locate the current run by exact title `RaBiToolRelatoriohhmmssddmmyy`, not by first item alone.
- Processing state: the current report item shows a disabled button with text `Processando relatório...`.
- Ready state: the same report item exposes a visible `Download` button with `ng-click="download(i.id, $event)"` when `!i.processando && i.disponivel`.
- Report metadata: item includes date, report ID text such as `ID: 4259804`, and user text.
- Processing wait rule: check every 2 seconds for the matching report item to become downloadable.
- Processing timeout: block after 420 seconds if the matching report is still not downloadable.
- Expected download filename pattern: generated title plus `.xlsx`, for example `RaBiToolRelatoriohhmmssddmmyy.xlsx`; if HugMe/Chrome changes the filename, detect the fresh XLSX started after the download click.
- Expected columns:
- Export edge cases:

## RA Create-Report Setup Stage

First source automation milestone should stop after submitting the report request:

1. Find the tracked RA/HugMe export tab.
2. Wait briefly until the create-report form is visible.
3. Confirm/select company `Eduzz`.
4. Fill timestamped report title `RaBiToolRelatoriohhmmssddmmyy`.
5. Switch period to `A definir`.
6. Fill date range from execution date minus 45 days through execution date.
7. Confirm/select ordering field `Data Reclamação`.
8. Confirm/select ordering type `ascendente`.
9. Confirm/select all report columns.
10. Click `Gerar relatório`.
11. Locate the generated report item by exact title.
12. Detect that the report item entered processing state.

Ordering note: RA should now be set to `ascendente`, matching the mother-sheet requirement that `Data Reclamação` is oldest-to-newest. Parser/reconciliation should still validate sort order and block if the report is not actually ascending.

## RA Processing/Download Stage

After submitting `Gerar relatório`, the next source automation milestone is:

1. Watch the `Meus relatórios` list for the report item whose `h5` title exactly matches the generated `RaBiToolRelatoriohhmmssddmmyy`.
2. If the item shows `Processando relatório...`, keep waiting/polling that same item every 2 seconds.
3. If the item disappears, fails to appear, expires, or cannot be uniquely identified, stop with a clear error.
4. When the item shows a visible `Download` button, click that button for the matching item only.
5. Use Chrome downloads tracking to detect the resulting XLSX download and associate it with this run by matching the generated title.
6. The downloaded file becomes the incoming report for parser/reconciliation.
7. The current test build intentionally stops here after Chrome reports the XLSX download completed. Existing parser/reconciliation/Excel inspection modules remain in the codebase, but are deferred until the owner confirms the download leg is solid.

Current implementation choice: poll the page every 2 seconds for up to 420 seconds. For the current test build, stop with success once Chrome reports the XLSX download completed. Parser, reconciliation, and Excel paste resume after the owner confirms the download leg is solid.

## Pending Destination Details

- Excel workbook URL: configured as the SharePoint/Excel Web mother sheet URL in defaults; activation opens/reuses and tracks this tab for current v1.
- Worksheet/tab name: `Relatório de Tickets`.
- Target start cell/range: determined by locating the oldest report `Id HugMe` in the mother sheet; write should start in the matching row and the first mapped mother-sheet column.
- Replace/append/clear behavior: replace from the oldest matching report row downward; append only if clearly newer; block when uncertain.
- Required formatting preservation: future writer should paste values only, preserving existing sheet formatting where Excel Web allows it.
- Columns to fill: the 9 required mapped columns, by header name.
- Rows to skip or keep: do not touch unrelated historical rows before the affected window.
- Success validation: still pending; should verify row count/anchor and allow one Excel Web `Ctrl+Z` recovery for the single paste.

## Excel Web No-Focus Dry Run

The available Excel inspection module attempts a conservative dry run after report parsing, but the current download-test build does not call this stage yet:

1. Reuse the tracked Excel Web tab without activating/focusing it.
2. Inject an inspection script into that tab.
3. Detect the configured worksheet name in page text/title.
4. Collect readable grid cells from accessible DOM attributes such as `role="gridcell"`, `aria-rowindex`, and `aria-colindex`.
5. Confirm the 9 required mother-sheet headers by cell position, not just loose page text.
6. Inspect visible data rows and try to find the oldest report `Id HugMe` as the replacement anchor.
7. If any of those proofs fail, block with a specific stage/reason.

Known limitation: Excel Web may virtualize or canvas-render the workbook. If it does not expose enough row/cell data to a background-tab content script, the dry run will correctly block. Later fallback options are Excel Web search/find automation, a controlled focus-required paste flow, workbook export/import, or a user-approved file/clipboard bridge.

## Pending Reconciliation Rules

- Confirmed first strategy: use the oldest ticket in the incoming report to locate where the report overlaps the mother sheet, then replace from that row downward with normalized report rows.
- If the oldest incoming report ticket is found in the mother sheet, paste/replace the report-shaped rows starting on that exact mother-sheet row.
- If the incoming report contains rows newer than the current mother-sheet tail, those rows are added below the replaced overlap.
- If the oldest incoming report ticket is not found in the mother sheet, append the normalized report rows below the mother sheet only when the report is clearly newer than the current mother-sheet tail. The report rows are placed at the end.
- The paste/write should include only the columns used by the mother sheet, mapped from the report headers, not all report columns.
- The Excel Web write should be implemented as one contiguous paste action for the prepared affected range whenever possible. The intended operator recovery path is a single Excel Web `Ctrl+Z` to undo the extension's write if review/testing shows something wrong.
- Existing rows are replaced as full mother-sheet rows for the mapped columns, because older tickets can receive updated fields later such as resolution, return-to-business, note/CSAT, assignee, tags, or client type.
- The incoming report is authoritative for the mapped mother-sheet columns. If a mapped report field is blank, that blank should overwrite the existing mother-sheet value for that field.
- Safety check: when the oldest report ticket is found in the mother sheet, also take the last/current most recent mother-sheet ticket and find it in the incoming report.
- Count mother-sheet rows from the found oldest report ticket through the current most recent mother-sheet ticket.
- Count report rows from the oldest report ticket through that same current most recent mother-sheet ticket.
- If those counts match, the overlap is considered safe to replace.
- If those counts do not match, stop and show an error in the popup instead of writing.
- If the current most recent mother-sheet ticket is not found in the report, stop unless a later aligned rule explicitly allows append-only or gap behavior.
- If either the report or mother sheet is not sorted ascending by `Data Reclamação`, stop before writing.
- What should happen when the report includes older/newer rows outside the intended filter span?
- Blank optional fields are allowed in mapped columns and should be pasted as blanks because the report is the definitive source for the replacement range.
- Should the tool require a preview/confirmation before applying changes?

## Pending Row Mapping Details

Use fake examples only.

| RA Export Column | Excel Target Column | Transform Rule |
| --- | --- | --- |
| Example Source | Example Target | Example transform |

## Recommended Alignment Order

Before heavy development, align in this order:

1. Data contract: required headers, allowed missing optional values, data types, and date parsing.
2. Reconciliation rule: update/insert/delete/keep behavior inside the affected date span.
3. Safety gates: what blocks execution and what only warns.
4. Report intake method: direct capture/fetch versus manual file picker fallback.
5. Excel Web write method: exact target worksheet/range and paste/import strategy.
6. RA page automation: exact selectors, filters, report generation, processing checks, and download behavior.
7. Popup workflow: statuses, confirmations, keyboard shortcuts, and tab checks.

## Popup/UI Alignment

- Current visible popup baseline is a compact top-right tool: drag handle, settings gear, close icon, top separator, outline `HugMe`/`Planilha` tracked-tab status buttons, `RA > BI` button, loading/current-process line, and stacked warning/result notices.
- Visual direction: white popup, gray icons, gray separator line, icons hover green/light green. Tracked-tab buttons are outline-only and use green/check when ready, blue/spinner while checking, and red/X when blocked.
- Popup should be toggleable by the extension action/shortcut.
- The `RA > BI` button should work from the normal content-script popup and from the options-page popup preview.
- `HugMe`/`Planilha` status buttons show spinner/check/X and focus the tracked tab when clicked.
- The popup defaults to the top-right corner and remains draggable. Browser resize/zoom should not save a new popup position.

## Known Risks

- Chrome extensions cannot freely read arbitrary downloaded files from disk.
- To parse the XLSX automatically, prefer capturing or fetching the report file from the download button/link before or during download. If Chrome only saves the file to disk and exposes no readable URL/blob, a user file-picker fallback may be required.
- Excel Web may block synthetic paste/keyboard events unless the workflow uses clipboard or user-approved focus patterns.
- Bulk updates in Excel Web must be tested carefully because the mother sheet can have roughly 40,000+ rows.
- Replacement should avoid scanning or rewriting the entire workbook when the incoming report covers a limited date span.
- RA and Excel DOM selectors can change; implementation should detect stages and report useful errors.
- Broad `<all_urls>` permissions are acceptable during discovery but should be narrowed before release.
