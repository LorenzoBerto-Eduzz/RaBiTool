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
- Date/filter fields:
- Buttons/menu sequence:
- Generated report status behavior: owner described a `Gerar relatorio` action, a `processando relatorio` state, reload/check behavior, and then a download button when the report is ready.
- Expected download filename pattern:
- Expected columns:
- Export edge cases:

## Pending Destination Details

- Excel workbook URL:
- Worksheet/tab name:
- Target start cell/range:
- Replace/append/clear behavior:
- Required formatting preservation:
- Columns to fill:
- Rows to skip or keep:
- Success validation:

## Pending Reconciliation Rules

- Confirmed first strategy: use the oldest ticket in the incoming report to locate where the report overlaps the mother sheet, then replace from that row downward with normalized report rows.
- If the oldest incoming report ticket is found in the mother sheet, paste/replace the report-shaped rows starting on that exact mother-sheet row.
- If the incoming report contains rows newer than the current mother-sheet tail, those rows are added below the replaced overlap.
- If the oldest incoming report ticket is not found in the mother sheet, append the normalized report rows below the mother sheet only when the report is clearly newer than the current mother-sheet tail. The report rows are placed at the end.
- The paste/write should include only the columns used by the mother sheet, mapped from the report headers, not all report columns.
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

- Current visible popup baseline should be a clean shell: drag handle, settings gear, close icon, top separator, and empty body.
- Workflow buttons are not visible in the shell until their behavior is aligned.
- Visual direction: white popup, gray icons, gray separator line, icons hover green/light green.
- Popup should be toggleable by the extension action/shortcut.
- Future shortcuts and workflow buttons should be added after the core flow is aligned.
- Exact default corner placement needs final wording confirmation because the owner described "bottom top corner"; current code still uses the existing floating placement behavior unless updated.

## Known Risks

- Chrome extensions cannot freely read arbitrary downloaded files from disk.
- To parse the XLSX automatically, prefer capturing or fetching the report file from the download button/link before or during download. If Chrome only saves the file to disk and exposes no readable URL/blob, a user file-picker fallback may be required.
- Excel Web may block synthetic paste/keyboard events unless the workflow uses clipboard or user-approved focus patterns.
- Bulk updates in Excel Web must be tested carefully because the mother sheet can have roughly 40,000+ rows.
- Replacement should avoid scanning or rewriting the entire workbook when the incoming report covers a limited date span.
- RA and Excel DOM selectors can change; implementation should detect stages and report useful errors.
- Broad `<all_urls>` permissions are acceptable during discovery but should be narrowed before release.
