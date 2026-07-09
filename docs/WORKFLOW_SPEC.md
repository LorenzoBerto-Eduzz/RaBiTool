# RaBiTool Workflow Spec

This file tracks the operational details for the Reclame Aqui to Excel Web automation. Keep real customer data, private URLs, real IDs, screenshots, and exported files out of Git.

## Goal

Move data from a Reclame Aqui XLSX export into the Excel Web mother sheet that feeds the downstream BI process.

## Confirmed Direction

- Source: Reclame Aqui web UI.
- Export type: XLSX.
- Destination: Excel Web.
- Automation method: browser UI interactions, page waits, downloads, clipboard/import where needed.
- Initial destination behavior: replace rows or append rows, exact rule pending.
- API/OAuth integration: not planned for the initial version.

## Pending Source Details

- Reclame Aqui URL:
- Required login/session assumptions:
- Date/filter fields:
- Buttons/menu sequence:
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

## Pending Row Mapping

Use fake examples only.

| RA Export Column | Excel Target Column | Transform Rule |
| --- | --- | --- |
| Example Source | Example Target | Example transform |

## Known Risks

- Chrome extensions cannot freely read arbitrary downloaded files from disk.
- Excel Web may block synthetic paste/keyboard events unless the workflow uses clipboard or user-approved focus patterns.
- RA and Excel DOM selectors can change; implementation should detect stages and report useful errors.
- Broad `<all_urls>` permissions are acceptable during discovery but should be narrowed before release.
