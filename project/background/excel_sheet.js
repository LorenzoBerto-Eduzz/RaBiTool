// Excel Web destination inspection and future paste support.
function normalizeExcelHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getReportDateMs(row) {
  return parseReportDateValue(row?.['Data Reclamação']);
}

function rowToTsvLine(row, columns = RABI_TARGET_COLUMNS) {
  return columns.map((column) => {
    return String(row?.[column] ?? '')
      .replace(/\r?\n/g, ' ')
      .replace(/\t/g, ' ')
      .trim();
  }).join('\t');
}

function buildRowsTsv(rows, columns = RABI_TARGET_COLUMNS) {
  return rows.map((row) => rowToTsvLine(row, columns)).join('\n');
}

async function findExcelMotherSheetTabForSettings(settings) {
  const tabs = await queryTabs({});
  return tabs.find((tab) => isExcelMotherSheetTab(tab, settings)) || null;
}

function inspectExcelMotherSheetInPage(args) {
  const { requiredColumns, worksheetName, oldestReportId, newestReportId } = args;

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function visible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getElementText(element) {
    const values = [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.textContent
    ];
    return values.map((value) => String(value || '').trim()).find(Boolean) || '';
  }

  function getRowIndex(element) {
    const own = element.getAttribute('aria-rowindex') || element.getAttribute('data-row');
    if (own && Number.isFinite(Number(own))) return Number(own);
    const row = element.closest('[aria-rowindex], [role="row"]');
    const fromRow = row?.getAttribute('aria-rowindex') || row?.getAttribute('data-row');
    return fromRow && Number.isFinite(Number(fromRow)) ? Number(fromRow) : null;
  }

  function getColumnIndex(element) {
    const own = element.getAttribute('aria-colindex') || element.getAttribute('data-col');
    if (own && Number.isFinite(Number(own))) return Number(own);
    const cellRef = element.getAttribute('aria-label')?.match(/\b([A-Z]+)(\d+)\b/i)?.[1] || '';
    if (cellRef) {
      let index = 0;
      for (const letter of cellRef.toUpperCase()) index = index * 26 + (letter.charCodeAt(0) - 64);
      return index;
    }
    return null;
  }

  const bodyText = document.body?.innerText || '';
  const normalizedBody = normalize(bodyText);
  const worksheetVisible = !worksheetName || normalizedBody.includes(normalize(worksheetName)) ||
    normalize(document.title).includes(normalize(worksheetName));

  const candidates = Array.from(document.querySelectorAll([
    '[role="gridcell"]',
    '[role="columnheader"]',
    '[aria-rowindex][aria-colindex]',
    '[data-row][data-col]',
    '[aria-label*="Id HugMe"]',
    '[title*="Id HugMe"]'
  ].join(','))).filter(visible);

  const cells = [];
  for (const element of candidates) {
    const rowIndex = getRowIndex(element);
    const columnIndex = getColumnIndex(element);
    const text = getElementText(element);
    if (!text || !Number.isFinite(rowIndex) || !Number.isFinite(columnIndex)) continue;
    if (text.length > 300) continue;
    cells.push({ rowIndex, columnIndex, text });
  }

  const rows = new Map();
  for (const cell of cells) {
    if (!rows.has(cell.rowIndex)) rows.set(cell.rowIndex, new Map());
    const row = rows.get(cell.rowIndex);
    if (!row.has(cell.columnIndex)) row.set(cell.columnIndex, cell.text);
  }

  const required = requiredColumns.map(normalize);
  let headerRowIndex = null;
  let headerColumns = [];

  for (const [rowIndex, row] of rows.entries()) {
    const byText = new Map();
    for (const [columnIndex, text] of row.entries()) byText.set(normalize(text), columnIndex);
    if (required.every((column) => byText.has(column))) {
      headerRowIndex = rowIndex;
      headerColumns = requiredColumns.map((column) => ({
        name: column,
        columnIndex: byText.get(normalize(column))
      }));
      break;
    }
  }

  const visibleDataRows = [];
  if (headerRowIndex !== null) {
    const orderedHeaders = headerColumns.slice().sort((a, b) => a.columnIndex - b.columnIndex);
    for (const [rowIndex, row] of rows.entries()) {
      if (rowIndex <= headerRowIndex) continue;
      const values = {};
      let hasAny = false;
      for (const header of orderedHeaders) {
        const value = String(row.get(header.columnIndex) || '').trim();
        values[header.name] = value;
        if (value) hasAny = true;
      }
      if (hasAny) visibleDataRows.push({ rowIndex, values });
    }
  }

  const foundOldestReportId = visibleDataRows.find((row) => row.values['Id HugMe'] === oldestReportId) || null;
  const foundNewestReportId = visibleDataRows.find((row) => row.values['Id HugMe'] === newestReportId) || null;
  const requiredHeadersInBody = requiredColumns.filter((column) => normalizedBody.includes(normalize(column)));

  return {
    ok: true,
    stage: 'excel-inspect',
    url: location.href,
    title: document.title,
    worksheetName,
    worksheetVisible,
    candidateCellCount: cells.length,
    readableRowCount: rows.size,
    headerRowIndex,
    headerColumns,
    visibleDataRowCount: visibleDataRows.length,
    visibleFirstDataRowIndex: visibleDataRows[0]?.rowIndex || null,
    visibleLastDataRowIndex: visibleDataRows[visibleDataRows.length - 1]?.rowIndex || null,
    foundOldestReportIdRow: foundOldestReportId?.rowIndex || null,
    foundNewestReportIdRow: foundNewestReportId?.rowIndex || null,
    requiredHeadersInBody
  };
}

function validateExcelInspection(inspection, report) {
  if (!inspection?.ok) return inspection || { ok: false, stage: 'excel-inspect', reason: 'Inspecao do Excel nao retornou resultado.' };

  if (!inspection.worksheetVisible) {
    return {
      ok: false,
      stage: 'excel-inspect',
      reason: `A aba/planilha "${inspection.worksheetName}" nao ficou detectavel no Excel Web. Abra a worksheet correta antes de executar.`
    };
  }

  if (!inspection.candidateCellCount) {
    return {
      ok: false,
      stage: 'excel-inspect',
      reason: 'Excel Web nao expos celulas legiveis para a extensao em segundo plano. Nao vou escrever sem conseguir validar cabecalhos/linhas.'
    };
  }

  if (inspection.headerRowIndex === null) {
    const visibleHeaders = inspection.requiredHeadersInBody?.length || 0;
    const suffix = visibleHeaders
      ? ` Vi ${visibleHeaders}/${RABI_TARGET_COLUMNS.length} cabecalhos no texto da pagina, mas nao consegui mapear posicoes de celulas.`
      : '';
    return {
      ok: false,
      stage: 'excel-headers',
      reason: `Nao consegui confirmar os 9 cabecalhos da planilha mae por celulas no Excel Web.${suffix}`
    };
  }

  const mappedHeaders = new Set((inspection.headerColumns || []).map((column) => normalizeExcelHeader(column.name)));
  const missing = RABI_TARGET_COLUMNS.filter((column) => !mappedHeaders.has(normalizeExcelHeader(column)));
  if (missing.length) {
    return {
      ok: false,
      stage: 'excel-headers',
      reason: `Cabecalhos obrigatorios ausentes na planilha mae: ${missing.join(', ')}.`
    };
  }

  if (!inspection.visibleDataRowCount) {
    return {
      ok: false,
      stage: 'excel-data-window',
      reason: 'Cabecalhos confirmados, mas nenhuma linha de dados ficou legivel no Excel Web para calcular o ponto de substituicao.'
    };
  }

  const oldestId = report.firstId || report.rows?.[0]?.['Id HugMe'];
  if (!inspection.foundOldestReportIdRow) {
    return {
      ok: false,
      stage: 'excel-anchor',
      reason: `Cabecalhos confirmados, mas o ticket mais antigo do relatorio (${oldestId}) nao apareceu na janela legivel do Excel. Ainda nao e seguro calcular replace/append sem ler a cauda completa da planilha.`
    };
  }

  return { ok: true };
}

function buildExcelDryRunPlan(inspection, report) {
  const validation = validateExcelInspection(inspection, report);
  if (!validation.ok) return validation;

  const targetRow = inspection.foundOldestReportIdRow;
  const reportRows = report.rows || [];
  const firstDate = getReportDateMs(reportRows[0]);
  const lastDate = getReportDateMs(reportRows[reportRows.length - 1]);
  const tsv = buildRowsTsv(reportRows);

  return {
    ok: true,
    stage: 'excel-dry-run',
    targetRow,
    targetColumn: 1,
    reportRowCount: reportRows.length,
    reportColumnCount: RABI_TARGET_COLUMNS.length,
    firstReportId: report.firstId,
    lastReportId: report.lastId,
    firstReportDateMs: firstDate,
    lastReportDateMs: lastDate,
    headerRowIndex: inspection.headerRowIndex,
    visibleDataRowCount: inspection.visibleDataRowCount,
    clipboardTextLength: tsv.length,
    message: `Excel validado: cabecalhos OK, ancora na linha ${targetRow}. Proxima etapa: colar ${reportRows.length} linhas x ${RABI_TARGET_COLUMNS.length} colunas.`
  };
}

async function prepareExcelDryRun(excelTabId, report, settings) {
  if (!Number.isInteger(excelTabId)) {
    return { ok: false, stage: 'excel-tab', reason: 'Aba do Excel nao informada para inspecao.' };
  }
  if (!report?.rows?.length) {
    return { ok: false, stage: 'excel-report', reason: 'Nenhum relatorio RA normalizado esta disponivel para reconciliar.' };
  }

  await waitForTabComplete(excelTabId, 15000);
  const inspection = await runFunctionInTab(excelTabId, inspectExcelMotherSheetInPage, [{
    requiredColumns: RABI_TARGET_COLUMNS,
    worksheetName: settings?.excelWorksheetName || '',
    oldestReportId: report.firstId || report.rows[0]['Id HugMe'],
    newestReportId: report.lastId || report.rows[report.rows.length - 1]['Id HugMe']
  }]);

  if (!inspection.ok) {
    return {
      ok: false,
      stage: 'excel-inspect',
      reason: inspection.reason || 'Nao foi possivel inspecionar a aba do Excel Web.'
    };
  }

  return buildExcelDryRunPlan(inspection, report);
}

async function prepareExcelWorkbook(preferredExcelTabId = null) {
  const settings = await getStoredSettings();
  const report = getLatestParsedRaReport();
  if (!report?.rows?.length) {
    return {
      ok: false,
      stage: 'excel-report',
      reason: 'Nenhum relatorio RA ja foi lido nesta execucao. Rode RA > BI para gerar e parsear o XLSX primeiro.'
    };
  }

  const excelTab = Number.isInteger(preferredExcelTabId)
    ? await getTab(preferredExcelTabId)
    : await findExcelMotherSheetTabForSettings(settings);

  if (!excelTab) {
    return {
      ok: false,
      stage: 'excel-tab',
      reason: 'Aba da Planilha Mae no Excel Web nao encontrada.'
    };
  }

  return prepareExcelDryRun(excelTab.id, report, settings);
}

async function copyPreparedRowsToClipboard(rowsText) {
  const text = String(rowsText || '').trim();
  if (!text) {
    return { ok: false, stage: 'clipboard', reason: 'No prepared rows were provided.' };
  }

  const result = await copyText(text);
  return { ...result, stage: 'clipboard' };
}
