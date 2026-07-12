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
      reason: inspected?.reason || `Nao consegui verificar se a aba ativa do Excel e "${expectedName}".`
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
    reason: `A aba ativa do Excel Web nao foi confirmada como "${expectedName}". Aba ativa detectada: "${activeName}".${suffix} Nao vou colar fora da aba correta.`
  };
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
      reason: 'Excel nao copiou nenhum valor apos Ctrl+C. Provavelmente a celula alvo ainda nao estava selecionada.'
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
      reason: focused?.reason || 'Nao consegui preparar foco na area da Planilha.'
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
      reason: 'A busca do Excel abriu, mas o campo de texto nao ficou acessivel.'
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

  const submitCount = typeof submit === 'number' ? submit : (submit ? 1 : 0);
  if (!submitCount) return result;

  return (async () => {
    await sleep(80);
    input.focus();
    for (let index = 0; index < submitCount; index += 1) {
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
      await sleep(80);
    }
    return { ...result, submitted: true, submitCount };
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
      reason: frameResult?.reason || direct?.reason || 'Nao consegui encontrar o campo de busca nos frames do Excel.'
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
    reason: `A busca do Excel abriu, mas o campo de busca nao ficou preenchivel nos frames acessiveis. ${firstError}`.trim()
  };
}

async function findExcelIdWithSearch(target, id, stage = 'excel-find-anchor') {
  const wanted = normalizeExcelIdValue(id);
  const focus = await focusExcelWorkbookSurface(target);
  if (!focus.ok) return focus;

  let lastCopiedText = '';
  let lastReason = '';

  const attemptWaits = [500, 1000];
  for (let attempt = 1; attempt <= attemptWaits.length; attempt += 1) {
    let sent = await dispatchDebuggerCtrlShortcut(target, 'f', 'KeyF', 70);
    if (!sent.ok) return { ok: false, stage, reason: `Ctrl+F na Planilha falhou: ${sent.reason}` };
    await delay(250);

    const filled = await fillExcelFindDialog(target, id, stage, 2);
    if (!filled?.ok) {
      lastReason = filled?.reason || 'Nao consegui focar/preencher o campo de busca do Excel.';
      await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
      await delay(120);
      continue;
    }
    if (normalizeExcelIdValue(filled.value) !== wanted) {
      lastReason = `Campo de busca do Excel nao confirmou o ID esperado. Esperado ${id}, valor atual "${filled.value || ''}".`;
      await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
      await delay(120);
      continue;
    }

    await delay(attemptWaits[attempt - 1]);
    sent = await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
    if (!sent.ok) return { ok: false, stage, reason: `Escape para fechar a busca falhou: ${sent.reason}` };
    await delay(150);

    const selected = await copySelectedExcelText(target, `${stage}-verify`);
    if (!selected.ok) {
      lastReason = selected.reason || 'Nao consegui copiar a celula selecionada para confirmar o ID.';
      continue;
    }

    lastCopiedText = selected.text || '';
    const selectedId = normalizeExcelIdValue(selected.text);
    if (selectedId === wanted) {
      return { ok: true, stage, id: wanted, copiedText: selected.text, attempts: attempt };
    }
    lastReason = `Tentativa ${attempt}: a celula selecionada copiou "${String(selected.text || '').trim()}".`;
  }

  return {
    ok: false,
    stage: `${stage}-verify`,
    reason: `Busca do Excel nao confirmou a celula alvo apos 2 tentativas. Esperado Id HugMe ${id}, ultimo valor copiado "${String(lastCopiedText || '').trim()}". ${lastReason} Nao vou colar.`.trim()
  };
}

async function findExcelMotherSheetTabForSettings(settings) {
  const tabs = await queryTabs({});
  return tabs.find((tab) => isExcelMotherSheetTab(tab, settings)) || null;
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

  return applyExcelWorkbookUpdateViaKeyboard(excelTab, report, null);
}

async function applyExcelWorkbookUpdateViaKeyboard(excelTab, report, plan = null) {
  const settings = await getStoredSettings();
  const reportRows = report.rows || [];
  const anchorId = report.firstId || getRowId(reportRows[0]);
  const tsv = buildRowsTsv(reportRows);

  await setRaBiWorkflowStatus({ running: true, activeText: 'Assumindo foco da Planilha Mae...' });
  await focusWindow(excelTab.windowId);
  await activateTab(excelTab.id);
  await delay(500);

  await setRaBiWorkflowStatus({ running: true, activeText: 'Confirmando aba Relatorio de Tickets...' });
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

  try {
    await setRaBiWorkflowStatus({ running: true, activeText: `Procurando ID ancora ${anchorId} na Planilha...` });
    let sent = await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
    if (!sent.ok) return { ok: false, stage: 'excel-keyboard', reason: `Escape via debugger falhou: ${sent.reason}` };
    await delay(150);

    let found = await findExcelIdWithSearch(target, anchorId, 'excel-find-anchor');
    if (!found.ok) return found;

    await setRaBiWorkflowStatus({ running: true, activeText: `Colando ${reportRows.length} linhas do relatorio...` });
    sent = await copyText(tsv);
    if (!sent.ok) return { ...sent, stage: 'clipboard' };
    sent = await dispatchDebuggerCtrlShortcut(target, 'v', 'KeyV', 86);
    if (!sent.ok) return { ok: false, stage: 'excel-paste', reason: `Ctrl+V na planilha falhou: ${sent.reason}` };
    await delay(300);
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
    usedKeyboardFallback: !plan?.ok,
    plan,
    message: `Colei ${reportRows.length} linhas x ${RABI_TARGET_COLUMNS.length} colunas na Planilha Mae a partir do ID ancora ${anchorId}.`
  };
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

  const worksheet = await verifyExcelWorksheetReady(excelTab.id, settings);
  if (!worksheet.ok) return worksheet;

  return {
    ok: true,
    stage: 'excel-ready',
    reportRowCount: report.rows.length,
    reportColumnCount: RABI_TARGET_COLUMNS.length,
    firstReportId: report.firstId || getRowId(report.rows[0]),
    worksheetName: worksheet.worksheetName,
    message: `Planilha Mae pronta: aba ${worksheet.worksheetName || getExpectedExcelWorksheetName(settings)} confirmada. Proxima etapa: RA > BI pode procurar o ID ancora e colar ${report.rows.length} linhas.`
  };
}

async function copyPreparedRowsToClipboard(rowsText) {
  const text = String(rowsText ?? '');
  if (!text) {
    return { ok: false, stage: 'clipboard', reason: 'Nenhuma linha preparada foi informada para copiar.' };
  }

  const result = await copyText(text);
  return { ...result, stage: 'clipboard' };
}
