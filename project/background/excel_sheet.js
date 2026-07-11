// Excel Web destination inspection and future paste support.
function normalizeExcelHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getExpectedExcelWorksheetName(settings) {
  return String(settings?.excelWorksheetName || DEFAULT_SETTINGS?.excelWorksheetName || 'Relat\u00f3rio de Tickets').trim() ||
    'Relat\u00f3rio de Tickets';
}

function inspectActiveExcelWorksheetInPage(expectedName) {
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
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 &&
      rect.width > 0 && rect.height > 0;
  }

  function textFor(element) {
    if (!element) return '';
    const titleNode = element.querySelector?.('[sheet-title]');
    const textNode = element.querySelector?.('.tab-active-text, .dark');
    return [
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('title'),
      element.getAttribute?.('sheet-title'),
      titleNode?.getAttribute?.('sheet-title'),
      textNode?.textContent,
      element.textContent
    ].map((value) => String(value || '').trim()).find(Boolean) || '';
  }

  const expected = normalize(expectedName);
  const bar = document.getElementById('m_excelWebRenderer_ewaCtl_m_sheetTabBar') || document;
  const activeSelectors = [
    '[role="tab"][aria-selected="true"]',
    '.tab-active [role="tab"]',
    '.tab-active .tab-anchor-text',
    'li.tab-active [sheet-title]',
    '[aria-selected="true"][sheet-title]'
  ];
  const allTabSelectors = [
    '[role="tab"]',
    '[sheet-title]',
    '.tab-anchor-text'
  ];

  const activeCandidates = activeSelectors
    .flatMap((selector) => Array.from(bar.querySelectorAll(selector)))
    .filter((element, index, list) => list.indexOf(element) === index)
    .filter(visible);
  const activeNames = activeCandidates.map(textFor).filter(Boolean);
  const activeName = activeNames.find((name) => normalize(name) === expected) || activeNames[0] || '';

  const detectedTabs = allTabSelectors
    .flatMap((selector) => Array.from(bar.querySelectorAll(selector)))
    .filter((element, index, list) => list.indexOf(element) === index)
    .filter(visible)
    .map(textFor)
    .filter(Boolean)
    .filter((name, index, list) => list.findIndex((item) => normalize(item) === normalize(name)) === index)
    .slice(0, 20);

  return {
    ok: true,
    stage: 'excel-worksheet',
    expectedName,
    activeName,
    activeMatches: !!expected && activeNames.some((name) => normalize(name) === expected),
    expectedVisible: !!expected && detectedTabs.some((name) => normalize(name) === expected),
    detectedTabs,
    url: location.href,
    title: document.title
  };
}

async function verifyExcelWorksheetReady(excelTabId, settings) {
  const expectedName = getExpectedExcelWorksheetName(settings);
  const inspected = await runFunctionInTabFrames(excelTabId, inspectActiveExcelWorksheetInPage, [expectedName]);
  if (!inspected?.ok) {
    return {
      ok: false,
      stage: 'excel-worksheet',
      reason: inspected?.reason || `Nao consegui verificar se a worksheet ativa e "${expectedName}".`
    };
  }

  const results = (inspected.results || [])
    .map((item) => ({ frameId: item.frameId, ...(item.result || {}) }))
    .filter((item) => item?.ok);
  const match = results.find((item) => item.activeMatches);
  if (match) {
    return {
      ok: true,
      stage: 'excel-worksheet',
      worksheetName: match.activeName || expectedName,
      frameId: match.frameId
    };
  }

  const evidence = results.find((item) => item.activeName || item.detectedTabs?.length) || null;
  const activeName = evidence?.activeName || 'indetectavel';
  const seenTabs = (evidence?.detectedTabs || []).join(', ');
  const suffix = seenTabs ? ` Guias detectadas: ${seenTabs}.` : '';
  return {
    ok: false,
    stage: 'excel-worksheet',
    reason: `A worksheet ativa do Excel Web nao foi confirmada como "${expectedName}". Aba ativa detectada: "${activeName}".${suffix} Nao vou colar fora da worksheet correta.`
  };
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

function getRowId(row) {
  return String(row?.['Id HugMe'] || '').trim();
}

function normalizeExcelIdValue(value) {
  const firstCell = String(value ?? '').split(/\r?\n/)[0]?.split('\t')[0] || '';
  const text = firstCell.trim();
  const number = Number(text.replace(',', '.'));
  if (Number.isFinite(number) && number > 0) return String(Math.round(number));
  return text.replace(/\s+/g, '');
}

function parseCopiedExcelIdColumn(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => normalizeExcelIdValue(line.split('\t')[0]))
    .filter(Boolean);
}

function getReportIds(reportRows) {
  return (reportRows || []).map((row) => normalizeExcelIdValue(getRowId(row))).filter(Boolean);
}

async function copySelectedExcelText(target, stage) {
  const sentinel = `__RABITOOL_CLIPBOARD_SENTINEL_${Date.now()}_${Math.random().toString(16).slice(2)}__`;
  const seeded = await copyText(sentinel);
  if (!seeded.ok) return { ...seeded, stage };
  await delay(120);

  const sent = await dispatchDebuggerCtrlShortcut(target, 'c', 'KeyC', 67);
  if (!sent.ok) {
    return { ok: false, stage, reason: `Ctrl+C na Planilha falhou: ${sent.reason}` };
  }
  await delay(350);
  const selected = await readText({ returnTabId: target.tabId });
  if (!selected.ok) return { ...selected, stage };
  if (String(selected.text || '') === sentinel) {
    return {
      ok: false,
      stage,
      reason: 'Excel nao copiou nenhum valor apos Ctrl+C. Provavelmente o foco ainda nao estava numa celula da Planilha.'
    };
  }
  return { ok: true, stage, text: selected.text || '' };
}

function prepareExcelKeyboardFocusInPage() {
  const popup = document.getElementById('rabi-tool-popup');
  if (popup) popup.style.display = 'none';
  try {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  } catch (_) {}

  function visible(element) {
    if (!element || element.id === 'rabi-tool-popup' || element.closest?.('#rabi-tool-popup')) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 80 && rect.height > 40;
  }

  const selectors = [
    '[role="grid"]',
    '[aria-label*="grid" i]',
    '[aria-label*="sheet" i]',
    '[aria-label*="planilha" i]',
    'canvas',
    '[class*="grid" i]',
    '[id*="grid" i]',
    '[class*="sheet" i]',
    '[id*="sheet" i]'
  ];

  const candidates = Array.from(document.querySelectorAll(selectors.join(',')))
    .filter(visible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { rect, area: rect.width * rect.height };
    })
    .sort((a, b) => b.area - a.area);

  const chosen = candidates[0]?.rect;
  const fallbackX = Math.min(Math.max(window.innerWidth * 0.42, 260), window.innerWidth - 80);
  const fallbackY = Math.min(Math.max(window.innerHeight * 0.56, 230), window.innerHeight - 80);
  const x = chosen ? Math.min(Math.max(chosen.left + chosen.width * 0.22, 40), window.innerWidth - 40) : fallbackX;
  const y = chosen ? Math.min(Math.max(chosen.top + chosen.height * 0.28, 80), window.innerHeight - 40) : fallbackY;

  return {
    ok: true,
    stage: 'excel-focus',
    x,
    y,
    usedCandidate: !!chosen,
    candidateCount: candidates.length
  };
}

function restoreRaBiPopupInPage() {
  const popup = document.getElementById('rabi-tool-popup');
  if (popup) popup.style.display = '';
  return { ok: true };
}

async function focusExcelWorkbookSurface(target) {
  const focused = await runFunctionInTab(target.tabId, prepareExcelKeyboardFocusInPage, []);
  if (!focused?.ok) {
    return {
      ok: false,
      stage: 'excel-focus',
      reason: focused?.reason || 'Nao consegui preparar foco na superficie do Excel.'
    };
  }
  const clicked = await dispatchDebuggerMouseClick(target, focused.x, focused.y);
  if (!clicked.ok) {
    return { ok: false, stage: 'excel-focus', reason: `Clique de foco no Excel falhou: ${clicked.reason}` };
  }
  await delay(450);
  return focused;
}

function fillExcelFindDialogInPage(value, submit = false) {
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function visible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  const input = [
    document.querySelector('#findTextId'),
    document.querySelector('input[data-unique-id="findTextId-input"]'),
    document.querySelector('input[aria-label="Find"]'),
    document.querySelector('input[placeholder="Insert Text"]'),
    ...Array.from(document.querySelectorAll('input[type="text"]')).filter((item) => {
      const label = item.getAttribute('aria-label') || item.placeholder || item.id || '';
      return /find|localizar|buscar/i.test(label);
    })
  ].find(visible);

  if (!input) {
    return {
      ok: false,
      stage: 'excel-find-dialog',
      reason: 'O dialog Find do Excel abriu, mas o campo de busca #findTextId nao ficou acessivel.'
    };
  }

  input.scrollIntoView({ block: 'center', inline: 'center' });
  input.focus();
  input.select?.();

  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, String(value));
  else input.value = String(value);

  input.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: 'insertText',
    data: String(value)
  }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.focus();
  input.select?.();
  input.setSelectionRange?.(String(value).length, String(value).length);

  const result = {
    ok: true,
    stage: 'excel-find-dialog',
    value: input.value,
    activeElementId: document.activeElement?.id || '',
    activeElementLabel: document.activeElement?.getAttribute?.('aria-label') || ''
  };

  if (!submit) return result;

  return (async () => {
    await sleep(80);
    input.focus();
    ['keydown', 'keypress', 'keyup'].forEach((type) => {
      input.dispatchEvent(new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13
      }));
    });
    return { ...result, submitted: true };
  })();
}

async function fillExcelFindDialog(target, id, stage, submit = false) {
  const direct = await runFunctionInTab(target.tabId, fillExcelFindDialogInPage, [String(id), submit]);
  if (direct?.ok && normalizeExcelIdValue(direct.value) === normalizeExcelIdValue(id)) {
    return direct;
  }

  const frameResult = await runFunctionInTabFrames(target.tabId, fillExcelFindDialogInPage, [String(id), submit]);
  if (!frameResult?.ok) {
    return {
      ok: false,
      stage,
      reason: frameResult?.reason || direct?.reason || 'Nao consegui procurar o campo Find nos frames do Excel.'
    };
  }

  const results = (frameResult.results || []).map((item) => ({
    frameId: item.frameId,
    ...(item.result || {})
  }));
  const exact = results.find((item) => item.ok && normalizeExcelIdValue(item.value) === normalizeExcelIdValue(id));
  if (exact) return exact;

  const firstError = results.find((item) => item.reason)?.reason || direct?.reason || '';
  return {
    ok: false,
    stage,
    reason: `O dialog Find do Excel abriu, mas o campo de busca nao ficou preenchivel nos frames acessiveis. ${firstError}`.trim()
  };
}

async function findExcelIdWithSearch(target, id, stage = 'excel-find-anchor') {
  const wanted = normalizeExcelIdValue(id);
  const focus = await focusExcelWorkbookSurface(target);
  if (!focus.ok) return focus;

  let sent = await dispatchDebuggerCtrlShortcut(target, 'f', 'KeyF', 70);
  if (!sent.ok) return { ok: false, stage, reason: `Ctrl+F via debugger falhou: ${sent.reason}` };
  await delay(900);

  const filled = await fillExcelFindDialog(target, id, stage, true);
  if (!filled?.ok) {
    return {
      ok: false,
      stage,
      reason: filled?.reason || 'Nao consegui focar/preencher o campo Find do Excel.'
    };
  }
  if (normalizeExcelIdValue(filled.value) !== wanted) {
    return {
      ok: false,
      stage,
      reason: `Campo Find do Excel nao confirmou o ID esperado. Esperado ${id}, valor atual "${filled.value || ''}".`
    };
  }
  await delay(2000);

  sent = await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
  if (!sent.ok) return { ok: false, stage, reason: `Escape para fechar busca falhou: ${sent.reason}` };
  await delay(700);

  const selected = await copySelectedExcelText(target, `${stage}-verify`);
  if (!selected.ok) return selected;

  const selectedId = normalizeExcelIdValue(selected.text);
  if (selectedId !== wanted) {
    return {
      ok: false,
      stage: `${stage}-verify`,
      reason: `Busca no Excel nao confirmou a celula alvo. Esperado Id HugMe ${id}, mas a celula selecionada copiou "${String(selected.text || '').trim()}". Nao vou colar.`
    };
  }

  return { ok: true, stage, id: wanted, copiedText: selected.text };
}

async function readMotherOverlapIdsFromAnchor(target, anchorId, reportIds) {
  const wantedAnchor = normalizeExcelIdValue(anchorId);
  let sent = await dispatchDebuggerKey(target, 'ArrowDown', 'ArrowDown', 40);
  if (!sent.ok) return { ok: false, stage: 'excel-overlap-ui', reason: `Seta para baixo apos ancora falhou: ${sent.reason}` };
  await delay(220);

  const nextCell = await copySelectedExcelText(target, 'excel-overlap-probe');
  if (!nextCell.ok) return nextCell;
  const nextId = normalizeExcelIdValue(nextCell.text);

  sent = await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
  if (!sent.ok) return { ok: false, stage: 'excel-overlap-ui', reason: `Escape apos copiar linha de probe falhou: ${sent.reason}` };
  await delay(180);

  if (!nextId) {
    return {
      ok: true,
      stage: 'excel-overlap-ui',
      motherIds: [wantedAnchor],
      motherLatestId: wantedAnchor
    };
  }

  sent = await dispatchDebuggerKey(target, 'ArrowUp', 'ArrowUp', 38);
  if (!sent.ok) return { ok: false, stage: 'excel-overlap-ui', reason: `Seta para cima para voltar a ancora falhou: ${sent.reason}` };
  await delay(220);

  const anchorCheck = await copySelectedExcelText(target, 'excel-overlap-anchor-check');
  if (!anchorCheck.ok) return anchorCheck;
  const anchorCheckId = normalizeExcelIdValue(anchorCheck.text);
  if (anchorCheckId !== wantedAnchor) {
    return {
      ok: false,
      stage: 'excel-overlap-anchor-check',
      reason: `Apos voltar uma linha, a celula selecionada nao era a ancora ${anchorId}; copiou "${String(anchorCheck.text || '').trim()}". Nao vou colar.`
    };
  }

  sent = await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
  if (!sent.ok) return { ok: false, stage: 'excel-overlap-ui', reason: `Escape apos revalidar ancora falhou: ${sent.reason}` };
  await delay(220);

  sent = await dispatchDebuggerCtrlShiftKey(target, 'ArrowDown', 'ArrowDown', 40);
  if (!sent.ok) return { ok: false, stage: 'excel-overlap-ui', reason: `Ctrl+Shift+Down para selecionar overlap falhou: ${sent.reason}` };
  await delay(700);

  const range = await copySelectedExcelText(target, 'excel-overlap-ui');
  if (!range.ok) return range;

  const rawLines = String(range.text || '').split(/\r?\n/);
  if (rawLines.length > (reportIds?.length || 0) + 100 || String(range.text || '').length > 500000) {
    return {
      ok: false,
      stage: 'excel-overlap-ui',
      reason: `A selecao de IDs da Planilha ficou grande demais (${rawLines.length} linhas copiadas). Nao vou arriscar colar sem uma janela de overlap clara.`
    };
  }

  const motherIds = parseCopiedExcelIdColumn(range.text);
  if (!motherIds.length || motherIds[0] !== wantedAnchor) {
    return {
      ok: false,
      stage: 'excel-overlap-ui',
      reason: `A selecao de overlap nao comecou no ticket esperado ${anchorId}. Primeiro valor copiado: "${motherIds[0] || ''}".`
    };
  }

  sent = await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
  if (!sent.ok) return { ok: false, stage: 'excel-overlap-ui', reason: `Escape apos copiar range de overlap falhou: ${sent.reason}` };
  await delay(220);

  sent = await dispatchDebuggerCtrlShortcut(target, 'ArrowDown', 'ArrowDown', 40);
  if (!sent.ok) return { ok: false, stage: 'excel-overlap-ui', reason: `Ctrl+Down para selecionar ultimo ticket da Planilha falhou: ${sent.reason}` };
  await delay(350);

  const latestCell = await copySelectedExcelText(target, 'excel-overlap-latest-check');
  if (!latestCell.ok) return latestCell;
  const latestId = normalizeExcelIdValue(latestCell.text);
  const rangeLatestId = motherIds[motherIds.length - 1];
  if (latestId !== rangeLatestId) {
    return {
      ok: false,
      stage: 'excel-overlap-latest-check',
      reason: `A cauda selecionada por Ctrl+Down (${latestId || 'vazio'}) nao bate com o ultimo ID do range copiado (${rangeLatestId}). Nao vou colar.`
    };
  }

  return {
    ok: true,
    stage: 'excel-overlap-ui',
    motherIds,
    motherLatestId: motherIds[motherIds.length - 1]
  };
}

function validateKeyboardOverlap(reportRows, anchorId, motherIds) {
  const reportIds = getReportIds(reportRows);
  const normalizedAnchor = normalizeExcelIdValue(anchorId);
  if (!reportIds.length) {
    return { ok: false, stage: 'excel-overlap-ui', reason: 'Relatorio RA nao tem IDs normalizados para validar o overlap.' };
  }
  if (reportIds[0] !== normalizedAnchor) {
    return {
      ok: false,
      stage: 'excel-overlap-ui',
      reason: `O primeiro ID normalizado do relatorio (${reportIds[0]}) nao bate com a ancora esperada (${anchorId}).`
    };
  }

  const motherLatestId = motherIds[motherIds.length - 1];
  const reportLatestMotherIndex = reportIds.findIndex((id) => id === motherLatestId);
  if (reportLatestMotherIndex < 0) {
    return {
      ok: false,
      stage: 'excel-overlap-ui',
      reason: `O ultimo ticket atual da Planilha Mae (${motherLatestId}) nao foi encontrado no relatorio baixado. Nao vou colar.`
    };
  }

  const reportOverlapIds = reportIds.slice(0, reportLatestMotherIndex + 1);
  if (motherIds.length !== reportOverlapIds.length) {
    return {
      ok: false,
      stage: 'excel-overlap-ui',
      reason: `Contagem de overlap divergente: Planilha Mae=${motherIds.length}, relatorio=${reportOverlapIds.length}. Nao vou colar.`
    };
  }

  for (let index = 0; index < motherIds.length; index += 1) {
    if (motherIds[index] !== reportOverlapIds[index]) {
      return {
        ok: false,
        stage: 'excel-overlap-ui',
        reason: `IDs de overlap divergiram na posicao ${index + 1}: Planilha Mae=${motherIds[index]}, relatorio=${reportOverlapIds[index]}. Nao vou colar.`
      };
    }
  }

  return {
    ok: true,
    stage: 'excel-overlap-ui',
    motherLatestId,
    motherOverlapCount: motherIds.length,
    reportOverlapCount: reportOverlapIds.length,
    newRowsAfterOverlap: reportRows.length - reportOverlapIds.length
  };
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

  const visibleRows = [];
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
      visibleRows.push({ rowIndex, values, hasAny });
      if (hasAny) visibleDataRows.push({ rowIndex, values });
    }
  }

  const foundOldestReportId = visibleDataRows.find((row) => row.values['Id HugMe'] === oldestReportId) || null;
  const foundNewestReportId = visibleDataRows.find((row) => row.values['Id HugMe'] === newestReportId) || null;
  const lastVisibleDataRow = visibleDataRows[visibleDataRows.length - 1] || null;
  const blankRowsAfterLastData = lastVisibleDataRow
    ? visibleRows.filter((row) => row.rowIndex > lastVisibleDataRow.rowIndex && !row.hasAny).length
    : 0;
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
    lastVisibleMotherId: lastVisibleDataRow?.values?.['Id HugMe'] || '',
    blankRowsAfterLastData,
    visibleDataRows: visibleDataRows.map((row) => ({
      rowIndex: row.rowIndex,
      id: row.values['Id HugMe'] || '',
      date: row.values['Data Reclamação'] || row.values['Data ReclamaÃ§Ã£o'] || ''
    })),
    requiredHeadersInBody
  };
}

function validateExcelInspection(inspection, report) {
  if (!inspection?.ok) return inspection || { ok: false, stage: 'excel-inspect', reason: 'Inspecao do Excel nao retornou resultado.' };

  if (!inspection.candidateCellCount) {
    return {
      ok: false,
      stage: 'excel-inspect',
      reason: 'Excel Web nao expos celulas legiveis para a extensao mesmo apos ativar a aba e inspecionar frames. Nao vou escrever sem conseguir validar cabecalhos/linhas.'
    };
  }

  if (inspection.headerRowIndex === null) {
    const visibleHeaders = inspection.requiredHeadersInBody?.length || 0;
    const worksheetSuffix = inspection.worksheetVisible
      ? ''
      : ` A worksheet "${inspection.worksheetName}" tambem nao ficou visivel no DOM do Excel Web.`;
    const suffix = visibleHeaders
      ? ` Vi ${visibleHeaders}/${RABI_TARGET_COLUMNS.length} cabecalhos no texto da pagina, mas nao consegui mapear posicoes de celulas.`
      : '';
    return {
      ok: false,
      stage: 'excel-headers',
      reason: `Nao consegui confirmar os 9 cabecalhos da planilha mae por celulas no Excel Web.${suffix}${worksheetSuffix}`
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

  const headerPositions = (inspection.headerColumns || []).map((column) => column.columnIndex);
  for (let index = 1; index < headerPositions.length; index += 1) {
    if (headerPositions[index] !== headerPositions[index - 1] + 1) {
      return {
        ok: false,
        stage: 'excel-headers',
        reason: 'Os 9 cabecalhos da planilha mae nao estao contiguos na ordem esperada; nao e seguro colar um bloco TSV unico.'
      };
    }
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
  const targetColumn = Math.min(...(inspection.headerColumns || []).map((column) => column.columnIndex));
  const reportRows = report.rows || [];
  const visibleDataRows = inspection.visibleDataRows || [];
  const anchorIndex = visibleDataRows.findIndex((row) => row.id === getRowId(reportRows[0]));
  const motherLatestId = inspection.lastVisibleMotherId;
  const reportLatestMotherIndex = reportRows.findIndex((row) => getRowId(row) === motherLatestId);
  const visibleOverlapCount = anchorIndex >= 0 ? visibleDataRows.length - anchorIndex : 0;
  const reportOverlapCount = reportLatestMotherIndex >= 0 ? reportLatestMotherIndex + 1 : 0;
  const firstDate = getReportDateMs(reportRows[0]);
  const lastDate = getReportDateMs(reportRows[reportRows.length - 1]);
  const tsv = buildRowsTsv(reportRows);

  if (!motherLatestId) {
    return {
      ok: false,
      stage: 'excel-overlap',
      reason: 'Nao consegui identificar o ultimo ticket visivel da planilha mae para validar o overlap.'
    };
  }

  if (!inspection.blankRowsAfterLastData) {
    return {
      ok: false,
      stage: 'excel-overlap',
      reason: `A janela legivel do Excel termina no ticket ${motherLatestId}, mas nao ha linha vazia visivel depois dele; nao consigo provar que ele e a cauda atual da planilha mae.`
    };
  }

  if (reportLatestMotherIndex < 0) {
    return {
      ok: false,
      stage: 'excel-overlap',
      reason: `O ultimo ticket visivel da planilha mae (${motherLatestId}) nao foi encontrado no relatorio baixado.`
    };
  }

  if (visibleOverlapCount !== reportOverlapCount) {
    return {
      ok: false,
      stage: 'excel-overlap',
      reason: `Contagem de overlap divergente: planilha mae=${visibleOverlapCount}, relatorio=${reportOverlapCount}. Nao vou colar.`
    };
  }

  return {
    ok: true,
    stage: 'excel-dry-run',
    targetRow,
    targetColumn,
    reportRowCount: reportRows.length,
    reportColumnCount: RABI_TARGET_COLUMNS.length,
    firstReportId: report.firstId,
    lastReportId: report.lastId,
    motherLatestId,
    visibleOverlapCount,
    reportOverlapCount,
    firstReportDateMs: firstDate,
    lastReportDateMs: lastDate,
    headerRowIndex: inspection.headerRowIndex,
    visibleDataRowCount: inspection.visibleDataRowCount,
    clipboardTextLength: tsv.length,
    message: `Excel validado: cabecalhos OK, ancora na linha ${targetRow}. Proxima etapa: colar ${reportRows.length} linhas x ${RABI_TARGET_COLUMNS.length} colunas.`
  };
}

function selectExcelTargetCellInPage(args) {
  const { targetRow, targetColumn } = args;

  function visible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
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
    return null;
  }

  const candidates = Array.from(document.querySelectorAll([
    '[role="gridcell"]',
    '[aria-rowindex][aria-colindex]',
    '[data-row][data-col]'
  ].join(','))).filter(visible);

  const target = candidates.find((element) => {
    return getRowIndex(element) === targetRow && getColumnIndex(element) === targetColumn;
  });

  if (!target) {
    return {
      ok: false,
      stage: 'excel-select',
      reason: `Nao encontrei a celula alvo visivel no Excel Web (linha ${targetRow}, coluna ${targetColumn}).`
    };
  }

  target.scrollIntoView({ block: 'center', inline: 'center' });
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
  target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
  target.click();
  target.focus?.();

  return {
    ok: true,
    stage: 'excel-select',
    targetRow,
    targetColumn
  };
}

async function applyExcelWorkbookUpdate(preferredExcelTabId = null) {
  const settings = await getStoredSettings();
  const report = getLatestParsedRaReport();
  if (!report?.rows?.length) {
    return {
      ok: false,
      stage: 'excel-report',
      reason: 'Nenhum relatorio RA validado esta disponivel para colar na planilha mae.'
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

  const plan = await prepareExcelDryRun(excelTab.id, report, settings);
  if (!plan.ok) {
    return applyExcelWorkbookUpdateViaKeyboard(excelTab, report, plan);
  }

  return applyExcelWorkbookUpdateViaKeyboard(excelTab, report, plan);
}

async function applyExcelWorkbookUpdateViaKeyboard(excelTab, report, plan = null) {
  const settings = await getStoredSettings();
  const reportRows = report.rows || [];
  const anchorId = report.firstId || getRowId(reportRows[0]);
  const tsv = buildRowsTsv(reportRows);
  const reportIds = getReportIds(reportRows);

  await focusWindow(excelTab.windowId);
  await activateTab(excelTab.id);
  await delay(900);

  await setRaBiWorkflowStatus({ running: true, activeText: 'Confirmando worksheet da Planilha Mae...' });
  const worksheet = await verifyExcelWorksheetReady(excelTab.id, settings);
  if (!worksheet.ok) return worksheet;

  const target = { tabId: excelTab.id };
  const attached = await debuggerAttach(target);
  if (!attached.ok) {
    return {
      ok: false,
      stage: 'excel-debugger',
      reason: `Nao consegui anexar o Chrome Debugger na aba da Planilha: ${attached.reason}`
    };
  }

  let overlapResult = null;

  try {
    await setRaBiWorkflowStatus({ running: true, activeText: `Procurando ticket ${anchorId} na Planilha Mae...` });
    let sent = await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
    if (!sent.ok) return { ok: false, stage: 'excel-keyboard', reason: `Escape via debugger falhou: ${sent.reason}` };
    await delay(150);

    let found = await findExcelIdWithSearch(target, anchorId, 'excel-find-anchor');
    if (!found.ok) return found;

    await setRaBiWorkflowStatus({ running: true, activeText: 'Validando overlap de IDs na Planilha Mae...' });
    const overlapRange = await readMotherOverlapIdsFromAnchor(target, anchorId, reportIds);
    if (!overlapRange.ok) return overlapRange;
    const overlap = validateKeyboardOverlap(reportRows, anchorId, overlapRange.motherIds);
    if (!overlap.ok) return overlap;
    overlapResult = overlap;

    await setRaBiWorkflowStatus({
      running: true,
      activeText: `Overlap validado: ${overlap.motherOverlapCount} linhas. Reposicionando ancora...`
    });
    found = await findExcelIdWithSearch(target, anchorId, 'excel-refind-anchor');
    if (!found.ok) return found;

    await setRaBiWorkflowStatus({ running: true, activeText: `Colando ${reportRows.length} linhas na Planilha Mae...` });
    sent = await copyText(tsv);
    if (!sent.ok) return { ...sent, stage: 'clipboard' };
    sent = await dispatchDebuggerCtrlShortcut(target, 'v', 'KeyV', 86);
    if (!sent.ok) return { ok: false, stage: 'excel-paste', reason: `Ctrl+V na planilha falhou: ${sent.reason}` };
    await delay(900);
    sent = await dispatchDebuggerKey(target, 'Enter', 'Enter', 13);
    if (!sent.ok) return { ok: false, stage: 'excel-paste', reason: `Enter apos paste falhou: ${sent.reason}` };
  } finally {
    await runFunctionInTab(target.tabId, restoreRaBiPopupInPage, []);
    await debuggerDetach(target);
  }

  return {
    ok: true,
    stage: 'excel-paste',
    targetAnchorId: anchorId,
    reportRowCount: reportRows.length,
    reportColumnCount: RABI_TARGET_COLUMNS.length,
    motherLatestId: overlapResult?.motherLatestId || '',
    motherOverlapCount: overlapResult?.motherOverlapCount || 0,
    reportOverlapCount: overlapResult?.reportOverlapCount || 0,
    usedKeyboardFallback: !plan?.ok,
    plan,
    message: `Colei ${reportRows.length} linhas x ${RABI_TARGET_COLUMNS.length} colunas na Planilha Mae apos validar o overlap pelo ID ${anchorId}.`
  };
}

async function prepareExcelDryRun(excelTabId, report, settings) {
  if (!Number.isInteger(excelTabId)) {
    return { ok: false, stage: 'excel-tab', reason: 'Aba do Excel nao informada para inspecao.' };
  }
  if (!report?.rows?.length) {
    return { ok: false, stage: 'excel-report', reason: 'Nenhum relatorio RA normalizado esta disponivel para reconciliar.' };
  }

  const excelTab = await getTab(excelTabId);
  if (excelTab) {
    await focusWindow(excelTab.windowId);
    await activateTab(excelTab.id);
    await delay(1200);
  }

  await waitForTabComplete(excelTabId, 15000);
  const inspectArgs = {
    requiredColumns: RABI_TARGET_COLUMNS,
    worksheetName: settings?.excelWorksheetName || '',
    oldestReportId: report.firstId || report.rows[0]['Id HugMe'],
    newestReportId: report.lastId || report.rows[report.rows.length - 1]['Id HugMe']
  };

  let inspection = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const frameInspection = await runFunctionInTabFrames(excelTabId, inspectExcelMotherSheetInPage, [inspectArgs]);
    if (!frameInspection.ok) {
      inspection = frameInspection;
    } else {
      const candidates = frameInspection.results
        .map((item) => ({ ...(item.result || {}), frameId: item.frameId }))
        .filter((item) => item?.ok);
      inspection = candidates
        .slice()
        .sort((a, b) => {
          const aScore = (a.headerRowIndex !== null ? 100000 : 0) + (a.candidateCellCount || 0) + (a.requiredHeadersInBody?.length || 0);
          const bScore = (b.headerRowIndex !== null ? 100000 : 0) + (b.candidateCellCount || 0) + (b.requiredHeadersInBody?.length || 0);
          return bScore - aScore;
        })[0] || {
          ok: false,
          stage: 'excel-inspect',
          reason: 'Nenhum frame acessivel do Excel Web retornou informacoes de planilha.'
        };
    }

    if (inspection?.ok && (inspection.candidateCellCount || inspection.headerRowIndex !== null)) break;
    await delay(1000);
  }

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
  const text = String(rowsText ?? '');
  if (!text) {
    return { ok: false, stage: 'clipboard', reason: 'No prepared rows were provided.' };
  }

  const result = await copyText(text);
  return { ...result, stage: 'clipboard' };
}
