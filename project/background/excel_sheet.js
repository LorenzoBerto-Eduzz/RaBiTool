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

function selectExpectedExcelWorksheetInPage(expectedName) {
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
    const textNode = element.querySelector?.('.tab-active-text, .dark, .tab-anchor-text');
    return [
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('title'),
      element.getAttribute?.('sheet-title'),
      titleNode?.getAttribute?.('sheet-title'),
      textNode?.textContent,
      element.textContent
    ].map((value) => String(value || '').trim()).find(Boolean) || '';
  }

  function active(element) {
    const nodes = [
      element,
      element.closest?.('[role="tab"]'),
      element.closest?.('li'),
      element.closest?.('[aria-selected]')
    ].filter(Boolean);
    return nodes.some((node) => {
      const className = String(node.className || '');
      return node.getAttribute?.('aria-selected') === 'true' ||
        className.includes('tab-active') ||
        className.includes('is-selected');
    });
  }

  function clickLikeUser(element) {
    const rect = element.getBoundingClientRect();
    const x = Math.max(1, Math.round(rect.left + rect.width / 2));
    const y = Math.max(1, Math.round(rect.top + rect.height / 2));
    element.scrollIntoView?.({ block: 'nearest', inline: 'center' });
    element.focus?.({ preventScroll: true });
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
      element.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y
      }));
    });
    element.click?.();
  }

  const expected = normalize(expectedName);
  const bar = document.getElementById('m_excelWebRenderer_ewaCtl_m_sheetTabBar') || document;
  const selectors = [
    '[role="tab"]',
    '[sheet-title]',
    '.tab-anchor-text',
    '[aria-label]',
    '[title]'
  ];
  const candidates = selectors
    .flatMap((selector) => Array.from(bar.querySelectorAll(selector)))
    .filter((element, index, list) => list.indexOf(element) === index)
    .filter(visible)
    .map((element) => ({
      element,
      clickable: element.closest?.('[role="tab"], button, [tabindex], li') || element,
      name: textFor(element)
    }))
    .filter((item) => normalize(item.name) === expected);

  if (!candidates.length) {
    return {
      ok: false,
      stage: 'excel-worksheet',
      selected: false,
      reason: `A guia "${expectedName}" não ficou visível para seleção.`
    };
  }

  const current = candidates.find((item) => active(item.element) || active(item.clickable));
  if (current) {
    return {
      ok: true,
      stage: 'excel-worksheet',
      selected: false,
      activeMatches: true,
      worksheetName: current.name || expectedName
    };
  }

  const target = candidates[0];
  clickLikeUser(target.clickable || target.element);
  return {
    ok: true,
    stage: 'excel-worksheet',
    selected: true,
    worksheetName: target.name || expectedName
  };
}

async function verifyExcelWorksheetReadyLegacy(excelTabId, settings) {
  const expectedName = getExpectedExcelWorksheetName(settings);
  const inspected = await runFunctionInTabFrames(excelTabId, inspectActiveExcelWorksheetInPage, [expectedName]);
  if (!inspected?.ok) {
    return {
      ok: false,
      stage: 'excel-worksheet',
      reason: inspected?.reason || `Não consegui verificar se a aba ativa do Excel é "${expectedName}".`
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
    reason: `A aba ativa do Excel Web não foi confirmada como "${expectedName}". Aba ativa detectada: "${activeName}".${suffix} Não vou colar fora da aba correta.`
  };
}

async function verifyExcelWorksheetReady(excelTabId, settings) {
  const expectedName = getExpectedExcelWorksheetName(settings);
  const attempts = 4;
  let lastReason = '';
  let lastEvidence = null;
  let triedSelection = false;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await setRaBiWorkflowStatus({
      running: true,
      activeText: `Confirmando aba Relatório de Tickets... (${attempt}/${attempts})`
    });

    const inspected = await runFunctionInTabFrames(
      excelTabId,
      inspectActiveExcelWorksheetInPage,
      [expectedName],
      { timeoutMs: 7000, stage: 'excel-worksheet' }
    );

    if (!inspected?.ok) {
      lastReason = inspected?.reason || `Não consegui verificar se a aba ativa do Excel é "${expectedName}".`;
    } else {
      const results = (inspected.results || [])
        .map((item) => ({ frameId: item.frameId, ...(item.result || {}) }))
        .filter((item) => item?.ok);
      const match = results.find((item) => item.activeMatches);
      if (match) {
        return {
          ok: true,
          stage: 'excel-worksheet',
          worksheetName: match.activeName || expectedName,
          frameId: match.frameId,
          attempts: attempt
        };
      }

      lastEvidence = results.find((item) => item.activeName || item.detectedTabs?.length) || null;
      const activeName = lastEvidence?.activeName || 'indetectável';
      const seenTabs = (lastEvidence?.detectedTabs || []).join(', ');
      const suffix = seenTabs ? ` Guias detectadas: ${seenTabs}.` : '';
      lastReason = `A aba ativa do Excel Web não foi confirmada como "${expectedName}". Aba ativa detectada: "${activeName}".${suffix}`;
    }

    if (attempt < attempts) {
      await delay(750 + attempt * 500);
    }
  }

  return {
    ok: false,
    stage: 'excel-worksheet',
    reason: `Não consegui confirmar a aba "${expectedName}" após ${attempts} tentativas. Último retorno: ${lastReason || 'Excel Web não retornou informação da aba ativa.'} Não vou colar fora da aba correta.`
  };
}

async function verifyExcelWorksheetReady(excelTabId, settings) {
  const expectedName = getExpectedExcelWorksheetName(settings);
  const attempts = 4;
  let lastReason = '';
  let lastEvidence = null;
  let triedSelection = false;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await setRaBiWorkflowStatus({
      running: true,
      activeText: `Confirmando aba Relatório de Tickets... (${attempt}/${attempts})`
    });

    const inspected = await runFunctionInTabFrames(
      excelTabId,
      inspectActiveExcelWorksheetInPage,
      [expectedName],
      { timeoutMs: 7000, stage: 'excel-worksheet' }
    );

    if (!inspected?.ok) {
      lastReason = inspected?.reason || `Não consegui verificar se a aba ativa do Excel é "${expectedName}".`;
    } else {
      const results = (inspected.results || [])
        .map((item) => ({ frameId: item.frameId, ...(item.result || {}) }))
        .filter((item) => item?.ok);
      const match = results.find((item) => item.activeMatches);
      if (match) {
        return {
          ok: true,
          stage: 'excel-worksheet',
          worksheetName: match.activeName || expectedName,
          frameId: match.frameId,
          attempts: attempt
        };
      }

      lastEvidence = results.find((item) => item.activeName || item.detectedTabs?.length) || null;
      const activeName = lastEvidence?.activeName || 'indetectável';
      const seenTabs = (lastEvidence?.detectedTabs || []).join(', ');
      const suffix = seenTabs ? ` Guias detectadas: ${seenTabs}.` : '';
      lastReason = `A aba ativa do Excel Web não foi confirmada como "${expectedName}". Aba ativa detectada: "${activeName}".${suffix}`;

      if (results.some((item) => item.expectedVisible) && !triedSelection) {
        triedSelection = true;
        await setRaBiWorkflowStatus({
          running: true,
          activeText: 'Selecionando aba Relatório de Tickets...'
        });
        const selected = await runFunctionInTabFrames(
          excelTabId,
          selectExpectedExcelWorksheetInPage,
          [expectedName],
          { timeoutMs: 7000, stage: 'excel-worksheet' }
        );
        if (!selected?.ok) {
          lastReason = selected?.reason || `A guia "${expectedName}" apareceu, mas não consegui selecioná-la.`;
        }
        await delay(1200);
        continue;
      }
    }

    if (attempt < attempts) {
      await delay(750 + attempt * 500);
    }
  }

  return {
    ok: false,
    stage: 'excel-worksheet',
    reason: `Não consegui confirmar a aba "${expectedName}" após ${attempts} tentativas. Último retorno: ${lastReason || 'Excel Web não retornou informação da aba ativa.'} Não vou colar fora da aba correta.`
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

const EXCEL_FIND_ATTEMPT_WAITS_MS = [700, 1200, 1800, 2400, 3000, 3800];
const EXCEL_SELECTED_CELL_VERIFY_WAITS_MS = [350, 700, 1100, 1600, 2300, 3200];

function excelFindShortcutSpec(key) {
  const normalized = String(key || 'f').toLowerCase() === 'l' ? 'l' : 'f';
  const upper = normalized.toUpperCase();
  return {
    key: normalized,
    code: `Key${upper}`,
    windowsVirtualKeyCode: upper.charCodeAt(0),
    label: `ctrl-${normalized}`
  };
}

async function copySelectedExcelText(target, stage, options = {}) {
  const attempts = Math.max(1, Number(options.attempts || 1));
  const baseWaitMs = Math.max(0, Number(options.baseWaitMs || 350));
  let lastReason = '';

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const sentinel = `__RABITOOL_CLIPBOARD_SENTINEL_${Date.now()}_${Math.random().toString(16).slice(2)}__`;
    const seeded = await copyText(sentinel);
    if (!seeded.ok) return { ...seeded, stage };
    await delay(120);

    const sent = await dispatchDebuggerCtrlShortcut(target, 'c', 'KeyC', 67);
    if (!sent.ok) {
      lastReason = `Ctrl+C na Planilha falhou: ${sent.reason}`;
      await delay(150);
      continue;
    }

    await delay(baseWaitMs + ((attempt - 1) * 250));
    const selected = await readText({ returnTabId: target.tabId });
    if (!selected.ok) {
      lastReason = selected.reason || 'Leitura do clipboard falhou após Ctrl+C.';
      await delay(150);
      continue;
    }

    if (String(selected.text || '') === sentinel) {
      lastReason = 'Excel não copiou nenhum valor após Ctrl+C. Provavelmente a célula alvo ainda não estava selecionada.';
      await delay(150);
      continue;
    }

    return { ok: true, stage, text: selected.text || '', copyAttempts: attempt };
  }

  return {
    ok: false,
    stage,
    reason: `${lastReason || 'Não consegui copiar a célula selecionada.'} Tentativas de cópia: ${attempts}.`
  };
}

async function verifySelectedExcelId(target, id, stage = 'excel-find-anchor') {
  const wanted = normalizeExcelIdValue(id);
  let lastCopiedText = '';
  let lastReason = '';

  for (let attempt = 1; attempt <= EXCEL_SELECTED_CELL_VERIFY_WAITS_MS.length; attempt += 1) {
    const waitMs = EXCEL_SELECTED_CELL_VERIFY_WAITS_MS[attempt - 1];
    await delay(waitMs);
    const selected = await copySelectedExcelText(target, `${stage}-verify`, {
      attempts: 3,
      baseWaitMs: Math.min(1200, 350 + waitMs)
    });

    if (!selected.ok) {
      lastReason = selected.reason || 'Não consegui copiar a célula selecionada para confirmar o ID.';
      continue;
    }

    lastCopiedText = selected.text || '';
    const selectedId = normalizeExcelIdValue(selected.text);
    if (selectedId === wanted) {
      return {
        ok: true,
        stage,
        id: wanted,
        copiedText: selected.text,
        verifyAttempts: attempt
      };
    }

    lastReason = `Tentativa de confirmação ${attempt}: a célula selecionada copiou "${String(selected.text || '').trim()}".`;
  }

  return {
    ok: false,
    stage: `${stage}-verify`,
    copiedText: lastCopiedText,
    reason: lastReason || `A célula selecionada não confirmou o Id HugMe ${id}.`
  };
}

function prepareExcelKeyboardFocusInPage(pointIndex = 0) {
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

  function textFor(element) {
    return [
      element.id,
      element.getAttribute?.('role'),
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('class')
    ].map((value) => String(value || '').trim()).filter(Boolean).join('|').slice(0, 160);
  }

  function candidateFromElement(element, kind) {
    const rect = element.getBoundingClientRect();
    return {
      element,
      rect,
      kind,
      area: rect.width * rect.height,
      top: rect.top,
      left: rect.left,
      label: textFor(element)
    };
  }

  function frameOffset() {
    let x = 0;
    let y = 0;
    let depth = 0;
    let known = true;
    try {
      let win = window;
      while (win && win !== win.top) {
        const frame = win.frameElement;
        if (!frame) {
          known = false;
          break;
        }
        const rect = frame.getBoundingClientRect();
        x += rect.left;
        y += rect.top;
        depth += 1;
        win = win.parent;
      }
    } catch (_) {
      known = false;
    }
    return { x, y, depth, known };
  }

  const selectors = [
    '[role="grid"]',
    '[role="application"]',
    '[role="main"]',
    '[role="region"]',
    '[role="presentation"]',
    '[aria-label*="grid" i]',
    '[aria-label*="sheet" i]',
    '[aria-label*="planilha" i]',
    '[aria-label*="worksheet" i]',
    '[aria-label*="workbook" i]',
    '[aria-label*="célula" i]',
    '[aria-label*="celula" i]',
    '[aria-label*="cell" i]',
    'canvas',
    'svg',
    '[class*="grid" i]',
    '[id*="grid" i]',
    '[class*="sheet" i]',
    '[id*="sheet" i]',
    '[class*="worksheet" i]',
    '[id*="worksheet" i]',
    '[class*="workbook" i]',
    '[id*="workbook" i]',
    '[class*="ewa" i]',
    '[id*="ewa" i]',
    '[class*="canvas" i]',
    '[id*="canvas" i]',
    '[class*="scroll" i]',
    '[id*="scroll" i]'
  ];

  const selectorCandidates = Array.from(document.querySelectorAll(selectors.join(',')))
    .filter(visible)
    .map((element) => candidateFromElement(element, 'selector'));

  const broadCandidates = Array.from(document.querySelectorAll('div,section,main,canvas,svg,[role]'))
    .filter((element) => {
      if (!visible(element)) return false;
      const rect = element.getBoundingClientRect();
      const enoughArea = rect.width >= Math.min(420, window.innerWidth * 0.45) && rect.height >= 120;
      const likelyWorkbookZone = rect.bottom > window.innerHeight * 0.32 && rect.top < window.innerHeight - 80;
      const notWholePage = rect.width < window.innerWidth * 0.995 || rect.height < window.innerHeight * 0.995;
      return enoughArea && likelyWorkbookZone && notWholePage;
    })
    .map((element) => candidateFromElement(element, 'large-visible'));

  const seen = new Set();
  const candidates = [...selectorCandidates, ...broadCandidates]
    .filter((item) => {
      const key = `${Math.round(item.rect.left)}:${Math.round(item.rect.top)}:${Math.round(item.rect.width)}:${Math.round(item.rect.height)}:${item.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.area - a.area);

  const chosen = candidates[0] || null;
  if (chosen?.element) {
    try {
      if (!chosen.element.hasAttribute('tabindex')) chosen.element.setAttribute('tabindex', '-1');
      chosen.element.focus?.({ preventScroll: true });
    } catch (_) {}
  }

  const chosenRect = chosen?.rect || null;
  const rectPoints = [
    [0.45, 0.48],
    [0.22, 0.30],
    [0.35, 0.42],
    [0.60, 0.50],
    [0.18, 0.62],
    [0.72, 0.36]
  ];
  const fallbackPoints = [
    [0.48, 0.55],
    [0.32, 0.46],
    [0.62, 0.50],
    [0.42, 0.36],
    [0.24, 0.62],
    [0.72, 0.42]
  ];
  const index = Math.abs(Number(pointIndex) || 0) % rectPoints.length;
  const rectPoint = rectPoints[index];
  const fallbackPoint = fallbackPoints[index];
  const fallbackX = Math.min(Math.max(window.innerWidth * fallbackPoint[0], 120), window.innerWidth - 80);
  const fallbackY = Math.min(Math.max(window.innerHeight * fallbackPoint[1], 150), window.innerHeight - 80);
  const offset = frameOffset();
  const rawX = chosenRect ? chosenRect.left + chosenRect.width * rectPoint[0] : fallbackX;
  const rawY = chosenRect ? chosenRect.top + chosenRect.height * rectPoint[1] : fallbackY;
  const x = Math.min(Math.max(rawX + offset.x, 40), window.top === window ? window.innerWidth - 40 : 100000);
  const y = Math.min(Math.max(rawY + offset.y, 80), window.top === window ? window.innerHeight - 40 : 100000);
  const topCandidates = candidates.slice(0, 4).map((item) => ({
    kind: item.kind,
    left: Math.round(item.rect.left),
    top: Math.round(item.rect.top),
    width: Math.round(item.rect.width),
    height: Math.round(item.rect.height),
    label: item.label
  }));

  return {
    ok: true,
    stage: 'excel-focus',
    x,
    y,
    usedCandidate: !!chosen,
    candidateCount: candidates.length,
    selectorCandidateCount: selectorCandidates.length,
    broadCandidateCount: broadCandidates.length,
    candidateKind: chosen?.kind || '',
    candidateLabel: chosen?.label || '',
    candidateRect: chosenRect ? {
      left: Math.round(chosenRect.left + offset.x),
      top: Math.round(chosenRect.top + offset.y),
      width: Math.round(chosenRect.width),
      height: Math.round(chosenRect.height)
    } : null,
    frameOffset: {
      x: Math.round(offset.x),
      y: Math.round(offset.y),
      depth: offset.depth,
      known: offset.known
    },
    frameHref: location.href,
    pointIndex: index,
    topCandidates,
    documentFocused: document.hasFocus(),
    activeElement: document.activeElement?.tagName || '',
    activeRole: document.activeElement?.getAttribute?.('role') || '',
    activeAriaLabel: document.activeElement?.getAttribute?.('aria-label') || ''
  };
}

function restoreRaBiPopupInPage() {
  const popup = document.getElementById('rabi-tool-popup');
  if (popup) popup.style.display = '';
  return { ok: true };
}

async function focusExcelWorkbookSurface(target, options = {}) {
  await debuggerSendCommand(target, 'Page.bringToFront', {});
  await delay(250);
  const topFocused = await runFunctionInTab(target.tabId, prepareExcelKeyboardFocusInPage, [options.pointIndex || 0]);
  let focused = topFocused;

  if (!topFocused?.ok || !topFocused.usedCandidate) {
    const frameResult = await runFunctionInTabFrames(target.tabId, prepareExcelKeyboardFocusInPage, [options.pointIndex || 0]);
    const frameCandidates = (frameResult?.results || [])
      .map((item) => ({
        frameId: item.frameId,
        ...(item.result || {})
      }))
      .filter((item) => item.ok && item.usedCandidate)
      .sort((a, b) => {
        const areaA = Number(a.candidateRect?.width || 0) * Number(a.candidateRect?.height || 0);
        const areaB = Number(b.candidateRect?.width || 0) * Number(b.candidateRect?.height || 0);
        return areaB - areaA;
      });
    if (frameCandidates.length) {
      focused = {
        ...frameCandidates[0],
        fromFrame: true,
        frameCandidateCount: frameCandidates.length,
        topCandidateCount: topFocused?.candidateCount || 0,
        topSelectorCandidateCount: topFocused?.selectorCandidateCount || 0,
        topBroadCandidateCount: topFocused?.broadCandidateCount || 0
      };
    } else if (topFocused?.ok) {
      focused = {
        ...topFocused,
        fromFrame: false,
        frameCandidateCount: 0
      };
    } else {
      focused = topFocused;
    }
  }

  if (!focused?.ok) {
    return {
      ok: false,
      stage: 'excel-focus',
      reason: focused?.reason || 'Não consegui preparar foco na área da Planilha.'
    };
  }
  const clicked = await dispatchDebuggerMouseClick(target, focused.x, focused.y);
  if (!clicked.ok) {
    return { ok: false, stage: 'excel-focus', reason: `Clique de foco no Excel falhou: ${clicked.reason}` };
  }
  await delay(650);
  return focused;
}

async function submitExcelFindSearchWithDebugger(target, id, stage, attempt, waitMs) {
  const enterGapMs = Math.min(260, 120 + (attempt * 25));
  for (let index = 0; index < 2; index += 1) {
    const sent = await dispatchDebuggerKey(target, 'Enter', 'Enter', 13, { holdMs: 70 });
    if (!sent.ok) {
      return {
        ok: false,
        stage,
        reason: `Enter ${index + 1} para executar a busca do ID ${id} falhou: ${sent.reason}`
      };
    }
    await delay(enterGapMs);
  }
  await delay(Math.max(450, waitMs));
  return { ok: true, stage, submitted: true, submitCount: 2 };
}

async function closeExcelFindAndSettleOnSelection(target, stage, waitMs) {
  await releaseExcelPointerAndModifiers(target);
  const sent = await dispatchDebuggerKey(target, 'Escape', 'Escape', 27, { holdMs: 55 });
  if (!sent.ok) {
    return { ok: false, stage, reason: `Escape para fechar a busca falhou: ${sent.reason}` };
  }
  await delay(Math.max(650, Math.min(1800, waitMs + 300)));
  return { ok: true, stage };
}

async function releaseExcelPointerAndModifiers(target, point = null) {
  const releases = [
    { key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, modifiers: 0 },
    { key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, modifiers: 0 },
    { key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18, modifiers: 0 }
  ];
  for (const item of releases) {
    await debuggerSendCommand(target, 'Input.dispatchKeyEvent', {
      ...item,
      nativeVirtualKeyCode: item.windowsVirtualKeyCode,
      type: 'keyUp'
    });
    await delay(25);
  }

  if (point?.x != null && point?.y != null) {
    await debuggerSendCommand(target, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.max(1, Math.round(point.x)),
      y: Math.max(1, Math.round(point.y)),
      button: 'left',
      clickCount: 1
    });
    await delay(120);
  }

  return { ok: true };
}

async function stabilizeExcelBeforeFind(target, pointIndex = 0) {
  await releaseExcelPointerAndModifiers(target);
  await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
  await delay(120);
  await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
  await delay(160);

  const focus = await focusExcelWorkbookSurface(target, { pointIndex });
  if (!focus.ok) return focus;
  await releaseExcelPointerAndModifiers(target, { x: focus.x, y: focus.y });
  await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
  await delay(180);
  return { ...focus, stabilized: true };
}

function dispatchExcelFindShortcutInPage(keyName = 'f') {
  const key = String(keyName || 'f').toLowerCase() === 'l' ? 'l' : 'f';
  const upper = key.toUpperCase();
  const code = `Key${upper}`;
  const keyCode = upper.charCodeAt(0);
  const target = document.activeElement || document.body || document.documentElement || document;
  const eventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    key,
    code,
    keyCode,
    which: keyCode,
    ctrlKey: true
  };
  ['keydown', 'keypress', 'keyup'].forEach((type) => {
    target.dispatchEvent(new KeyboardEvent(type, eventInit));
  });
  return {
    ok: true,
    stage: 'excel-find-shortcut',
    shortcut: `Ctrl+${upper}`,
    documentFocused: document.hasFocus(),
    activeElement: document.activeElement?.tagName || '',
    activeRole: document.activeElement?.getAttribute?.('role') || '',
    activeAriaLabel: document.activeElement?.getAttribute?.('aria-label') || ''
  };
}

function detectExcelFindShortcutLocaleInPage() {
  function textFor(element) {
    if (!element) return '';
    return [
      element.id,
      element.getAttribute?.('name'),
      element.getAttribute?.('data-unique-id'),
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('label'),
      element.textContent
    ].map((value) => String(value || '').trim()).filter(Boolean).join(' ').slice(0, 500);
  }

  const sampledText = Array.from(document.querySelectorAll('#FindAndSelect,[data-unique-id="Ribbon-FindAndSelect"],[data-unique-id="Ribbon-Find"],button[name="Find"],[role="button"],[role="menuitem"]'))
    .slice(0, 30)
    .map(textFor)
    .filter(Boolean)
    .join(' ');
  const signals = [
    navigator.language || '',
    document.documentElement?.lang || '',
    sampledText
  ].join(' ').toLowerCase();
  const prefersCtrlL = /\bpt\b|pt-br|portugu[eê]s|localizar|selecionar|substituir|planilha/.test(signals);
  return {
    ok: true,
    prefersCtrlL,
    language: navigator.language || '',
    documentLanguage: document.documentElement?.lang || ''
  };
}

async function detectExcelFindShortcutOrder(target) {
  const probes = [];
  const direct = await runFunctionInTab(target.tabId, detectExcelFindShortcutLocaleInPage, []);
  if (direct?.ok) probes.push({ source: 'top', ...direct });

  const frames = await runFunctionInTabFrames(target.tabId, detectExcelFindShortcutLocaleInPage, []);
  (frames?.results || []).forEach((item) => {
    if (item.result?.ok) probes.push({ source: `frame:${item.frameId}`, ...item.result });
  });

  const portuguese = probes.find((probe) => probe.prefersCtrlL);
  const order = portuguese ? ['l', 'f'] : ['f', 'l'];
  return {
    order,
    reason: portuguese ? `sinais PT-BR em ${portuguese.source}` : 'sem sinal PT-BR'
  };
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
      reason: 'A busca do Excel abriu, mas o campo de texto não ficou acessível.'
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

function inspectExcelFindDialogInPage() {
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
      reason: 'O diálogo de busca do Excel ainda não ficou visível/acessível.'
    };
  }

  return {
    ok: !input.disabled && !input.readOnly,
    stage: 'excel-find-dialog',
    value: input.value || '',
    activeElementId: document.activeElement?.id || '',
    activeElementLabel: document.activeElement?.getAttribute?.('aria-label') || '',
    disabled: !!input.disabled,
    readOnly: !!input.readOnly,
    reason: input.disabled || input.readOnly
      ? 'O campo de busca do Excel apareceu, mas ainda não está pronto para receber texto.'
      : ''
  };
}

async function inspectExcelFindDialog(target, stage) {
  const direct = await runFunctionInTab(target.tabId, inspectExcelFindDialogInPage, []);
  if (direct?.ok) return direct;

  const frameResult = await runFunctionInTabFrames(target.tabId, inspectExcelFindDialogInPage, []);
  if (!frameResult?.ok) {
    return {
      ok: false,
      stage,
      reason: frameResult?.reason || direct?.reason || 'Não consegui verificar o diálogo de busca do Excel.'
    };
  }

  const results = (frameResult.results || []).map((item) => ({
    frameId: item.frameId,
    ...(item.result || {})
  }));
  const ready = results.find((item) => item.ok);
  if (ready) return ready;

  const firstReason = results.find((item) => item.reason)?.reason || direct?.reason || '';
  return {
    ok: false,
    stage,
    reason: firstReason || 'O diálogo de busca do Excel não ficou acessível nos frames da página.'
  };
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
      reason: frameResult?.reason || direct?.reason || 'Não consegui encontrar o campo de busca nos frames do Excel.'
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
    reason: `A busca do Excel abriu, mas o campo de busca não ficou preenchível nos frames acessíveis. ${firstError}`.trim()
  };
}

async function dispatchSyntheticExcelFindShortcut(target, key = 'f') {
  const direct = await runFunctionInTab(target.tabId, dispatchExcelFindShortcutInPage, [key]);
  const frames = await runFunctionInTabFrames(target.tabId, dispatchExcelFindShortcutInPage, [key]);
  return {
    ok: !!direct?.ok || !!frames?.ok,
    direct,
    frames,
    reason: direct?.reason || frames?.reason || ''
  };
}

async function tryOpenExcelFindDialog(target, stage, waitMs, attempt) {
  const shortcutDetection = await detectExcelFindShortcutOrder(target);
  const variants = shortcutDetection.order.flatMap((key) => {
    const shortcut = excelFindShortcutSpec(key);
    return [
      {
        name: `debugger-raw-${shortcut.label}`,
        run: () => dispatchDebuggerCtrlShortcut(target, shortcut.key, shortcut.code, shortcut.windowsVirtualKeyCode)
      },
      {
        name: `debugger-keydown-${shortcut.label}`,
        run: () => dispatchDebuggerCtrlShortcutKeyDown(target, shortcut.key, shortcut.code, shortcut.windowsVirtualKeyCode)
      },
      {
        name: `debugger-modified-${shortcut.label}`,
        run: () => dispatchDebuggerKey(target, shortcut.key, shortcut.code, shortcut.windowsVirtualKeyCode, { ctrl: true, holdMs: 100 })
      },
      {
        name: `dom-synthetic-${shortcut.label}`,
        run: () => dispatchSyntheticExcelFindShortcut(target, shortcut.key)
      }
    ];
  });
  let lastReason = '';
  let lastFocus = null;

  for (let variantIndex = 0; variantIndex < variants.length; variantIndex += 1) {
    const variant = variants[variantIndex];
    const pointIndex = ((attempt - 1) * variants.length) + variantIndex;
    const focus = await stabilizeExcelBeforeFind(target, pointIndex);
    lastFocus = focus;
    if (!focus.ok) {
      lastReason = `${variant.name}: ${focus.reason || 'não consegui focar a área da Planilha'}`;
      await delay(waitMs);
      continue;
    }

    await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
    await delay(120);
    await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
    await delay(280);

    const sent = await variant.run();
    if (!sent?.ok) {
      lastReason = `${variant.name}: ${sent?.reason || 'atalho não foi enviado'}`;
      await delay(200);
      continue;
    }

    await delay(waitMs);
    const opened = await inspectExcelFindDialog(target, stage);
    if (opened?.ok) {
      return {
        ...opened,
        openVariant: variant.name,
        openAttempt: attempt,
        shortcutOrder: shortcutDetection.order,
        focus
      };
    }

    lastReason = `${variant.name}: ${opened?.reason || 'Find não apareceu'}`;
    await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
    await delay(250);
  }

  const focusEvidence = lastFocus
    ? `Foco: origem=${lastFocus.fromFrame ? `frame:${lastFocus.frameId}` : 'top'}, frameCandidates=${lastFocus.frameCandidateCount || 0}, candidatos=${lastFocus.candidateCount}, seletores=${lastFocus.selectorCandidateCount || 0}, amplos=${lastFocus.broadCandidateCount || 0}, usouGrid=${lastFocus.usedCandidate ? 'sim' : 'não'}, ponto=${lastFocus.pointIndex}, tipo=${lastFocus.candidateKind || 'nenhum'}, rect=${lastFocus.candidateRect ? `${lastFocus.candidateRect.left},${lastFocus.candidateRect.top},${lastFocus.candidateRect.width}x${lastFocus.candidateRect.height}` : 'nenhum'}, offset=${lastFocus.frameOffset ? `${lastFocus.frameOffset.x},${lastFocus.frameOffset.y},d${lastFocus.frameOffset.depth},${lastFocus.frameOffset.known ? 'ok' : 'incerto'}` : 'n/a'}, docFocus=${lastFocus.documentFocused ? 'sim' : 'não'}, ativo=${lastFocus.activeElement || 'vazio'}${lastFocus.activeRole ? `/${lastFocus.activeRole}` : ''}${lastFocus.activeAriaLabel ? `/${lastFocus.activeAriaLabel}` : ''}, top=${(lastFocus.topCandidates || []).map((item) => `${item.kind}:${item.left},${item.top},${item.width}x${item.height}:${item.label}`).join(' || ') || 'nenhum'}.`
    : 'Foco: sem evidência.';
  return {
    ok: false,
    stage,
    reason: `Tentativa ${attempt}: não consegui abrir/confirmar o Find do Excel após variantes de teclado. Atalhos=${shortcutDetection.order.map((key) => `Ctrl+${key.toUpperCase()}`).join('>')} (${shortcutDetection.reason}). ${lastReason} ${focusEvidence}`.trim()
  };
}

async function findExcelIdWithSearch(target, id, stage = 'excel-find-anchor') {
  const wanted = normalizeExcelIdValue(id);
  let lastCopiedText = '';
  let lastReason = '';

  for (let attempt = 1; attempt <= EXCEL_FIND_ATTEMPT_WAITS_MS.length; attempt += 1) {
    const waitMs = EXCEL_FIND_ATTEMPT_WAITS_MS[attempt - 1];

    if (attempt > 1) {
      const alreadySelected = await verifySelectedExcelId(target, id, stage);
      if (alreadySelected.ok) {
        return { ...alreadySelected, attempts: attempt - 1, reusedExistingSelection: true };
      }
      lastCopiedText = alreadySelected.copiedText || lastCopiedText;
    }

    const opened = await tryOpenExcelFindDialog(target, stage, waitMs, attempt);
    if (!opened?.ok) {
      lastReason = `Tentativa ${attempt}: busca do Excel não ficou pronta após ${waitMs}ms. ${opened?.reason || ''}`.trim();
      await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
      await delay(150);
      continue;
    }

    const filled = await fillExcelFindDialog(target, id, stage, false);
    if (!filled?.ok) {
      lastReason = `Tentativa ${attempt}: ${filled?.reason || 'Não consegui focar/preencher o campo de busca do Excel.'}`;
      await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
      await delay(150);
      continue;
    }
    if (normalizeExcelIdValue(filled.value) !== wanted) {
      lastReason = `Tentativa ${attempt}: campo de busca do Excel não confirmou o ID esperado. Esperado ${id}, valor atual "${filled.value || ''}".`;
      await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
      await delay(150);
      continue;
    }

    const submitted = await submitExcelFindSearchWithDebugger(target, id, stage, attempt, waitMs);
    if (!submitted.ok) {
      lastReason = `Tentativa ${attempt}: ${submitted.reason || 'Não consegui executar a busca do Excel.'}`;
      await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
      await delay(250);
      continue;
    }

    const closed = await closeExcelFindAndSettleOnSelection(target, stage, waitMs);
    if (!closed.ok) return closed;

    const selected = await verifySelectedExcelId(target, id, stage);
    if (!selected.ok) {
      lastCopiedText = selected.copiedText || lastCopiedText;
      lastReason = `Tentativa ${attempt}: ${selected.reason || 'Não consegui confirmar a célula selecionada.'}`;
      await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
      await delay(250);
      continue;
    }

    lastCopiedText = selected.copiedText || '';
    if (normalizeExcelIdValue(selected.copiedText) === wanted) {
      return { ...selected, attempts: attempt };
    }
    lastReason = `Tentativa ${attempt}: a célula selecionada copiou "${String(selected.copiedText || '').trim()}".`;
  }

  return {
    ok: false,
    stage: `${stage}-verify`,
    reason: `Busca do Excel não confirmou a célula alvo após ${EXCEL_FIND_ATTEMPT_WAITS_MS.length} tentativas. Esperado Id HugMe ${id}, último valor copiado "${String(lastCopiedText || '').trim()}". ${lastReason} Não vou colar.`.trim()
  };
}

async function findExcelMotherSheetTabForSettings(settings) {
  const tabs = await queryTabs({});
  return tabs.find((tab) => isExcelMotherSheetTab(tab, settings)) || null;
}

function isBrowserInternalOrExtensionUrl(url) {
  return /^(chrome|chrome-extension|edge|about):/i.test(String(url || '').trim());
}

function inspectForeignExtensionFramesInPage(currentExtensionId) {
  const ownPrefix = `chrome-extension://${currentExtensionId}/`;
  const detected = [];
  const candidates = Array.from(document.querySelectorAll('iframe, frame, embed, object')).filter((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 &&
      rect.width > 0 && rect.height > 0;
  });
  candidates.forEach((element) => {
    const source = String(element.getAttribute('src') || element.getAttribute('data') || '').trim();
    if (!source.toLowerCase().startsWith('chrome-extension://')) return;
    if (source.startsWith(ownPrefix)) return;
    const rect = element.getBoundingClientRect?.();
    detected.push({
      tag: element.tagName,
      source,
      rect: rect ? `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}` : ''
    });
  });
  return {
    ok: true,
    stage: 'excel-extension-overlays',
    overlayCount: detected.length,
    overlays: detected.slice(0, 8)
  };
}

async function inspectForeignExtensionFramesFromExcelTab(tabId) {
  const result = await runFunctionInTab(tabId, inspectForeignExtensionFramesInPage, [chrome.runtime.id]);
  return result?.ok ? result : {
    ok: false,
    stage: 'excel-extension-overlays',
    overlayCount: 0,
    reason: result?.reason || 'Não consegui verificar overlays de outras extensões na Planilha.'
  };
}

async function retargetExistingExcelTab(previousTab, settings) {
  const targetUrl = String(settings?.excelWorkbookUrl || '').trim();
  if (!targetUrl) {
    return {
      ok: false,
      stage: 'excel-tab',
      reason: 'URL da Planilha Mãe não configurada para recolocar a aba Excel.'
    };
  }

  if (!Number.isInteger(previousTab?.id)) {
    return {
      ok: false,
      stage: 'excel-tab',
      reason: 'A aba rastreada da Planilha não está disponível para recolocar.'
    };
  }

  await focusWindow(previousTab.windowId);
  await activateTab(previousTab.id);
  const retargeted = await updateTab(previousTab.id, { url: targetUrl, active: true });
  if (!retargeted) {
    return {
      ok: false,
      stage: 'excel-tab',
      reason: 'Não consegui recolocar a aba rastreada da Planilha na URL do Excel Web.'
    };
  }

  await waitForTabComplete(previousTab.id, 30000);
  const liveRetargeted = await getTab(previousTab.id) || retargeted;
  const retargetedTracked = await getWorkspaceTabs();
  retargetedTracked.bi = {
    ...(retargetedTracked.bi || {}),
    tabId: liveRetargeted.id,
    url: liveRetargeted.url || targetUrl,
    status: liveRetargeted.status || 'loading',
    reservedForRaBiTool: true,
    retargetedAt: new Date().toISOString()
  };
  await setWorkspaceTabs(retargetedTracked);
  return { ok: true, tab: liveRetargeted };
}

async function ensureExcelTabOnTarget(excelTab, settings, attempts = 3) {
  const targetUrl = String(settings?.excelWorkbookUrl || '').trim();
  let lastTab = excelTab || null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastTab = await getTab(lastTab?.id);
    if (!lastTab) {
      return {
        ok: false,
        stage: 'excel-tab',
        reason: 'A aba rastreada da Planilha foi fechada antes da colagem.'
      };
    }

    if (isBrowserInternalOrExtensionUrl(lastTab.url)) {
      const replacement = await retargetExistingExcelTab(lastTab, settings);
      if (!replacement.ok) return replacement;
      lastTab = replacement.tab;
    }

    await focusWindow(lastTab.windowId);
    await activateTab(lastTab.id);
    await delay(350);

    lastTab = await getTab(lastTab.id) || lastTab;
    if (isExcelMotherSheetTab(lastTab, settings)) {
      return { ok: true, tab: lastTab, attempts: attempt };
    }

    if (targetUrl) {
      await updateTab(lastTab.id, { url: targetUrl });
      await waitForTabComplete(lastTab.id, 10000);
    }
    await delay(attempt <= attempts ? 1000 : 1500);
  }

  const finalTab = lastTab?.id ? await getTab(lastTab.id) : lastTab;
  return {
    ok: false,
    stage: 'excel-tab',
    reason: `Não consegui recolocar a aba da Planilha no arquivo alvo do Excel Web após ${attempts} tentativas. URL atual: ${finalTab?.url || 'indisponível'}`
  };
}

async function attachDebuggerToExcelTab(excelTab, settings, attempts = 3) {
  let lastReason = '';
  let lastTab = excelTab;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const prepared = await ensureExcelTabOnTarget(lastTab, settings, 3);
    if (!prepared.ok) return prepared;
    lastTab = prepared.tab;

    const overlayInspection = await inspectForeignExtensionFramesFromExcelTab(lastTab.id);
    if (overlayInspection.overlayCount > 0) {
      return {
        ok: false,
        stage: 'excel-extension-overlays',
        reason: `Detectei ${overlayInspection.overlayCount} overlay(s) de outra extensão na Planilha. Não vou remover nem alterar elementos de outra extensão; pause/desative a extensão interferente para rodar RA > BI com segurança.`
      };
    }

    const target = { tabId: lastTab.id };
    const attached = await debuggerAttach(target);
    if (attached.ok) {
      return { ok: true, stage: 'excel-debugger', target, tab: lastTab, attempts: attempt };
    }

    lastReason = attached.reason || 'motivo não informado';
    const lower = lastReason.toLowerCase();
    const currentAfterFailure = await getTab(lastTab.id) || lastTab;
    if (isBrowserInternalOrExtensionUrl(currentAfterFailure.url)) {
      const replacement = await retargetExistingExcelTab(currentAfterFailure, settings);
      if (!replacement.ok) return replacement;
      lastTab = replacement.tab;
      lastReason = `${lastReason}. A aba rastreada estava em ${currentAfterFailure.url || 'URL interna/extensão'}; recoloquei essa mesma aba na Planilha.`;
      await delay(1000);
      continue;
    }
    if (lower.includes('chrome-extension://')) {
      return {
        ok: false,
        stage: 'excel-debugger',
        reason: `O Chrome bloqueou o debugger por conflito com página/extensão interna, mas a aba rastreada ainda está na Planilha (${currentAfterFailure.url || 'URL indisponível'}). Não vou alterar elementos de outra extensão. Verifique se alguma extensão, como JAM, está ativa sobre a Planilha antes de rodar RA > BI.`
      };
    }
    const anotherDebugger = lower.includes('another debugger') || lower.includes('debugger is already attached');
    if (anotherDebugger) {
      return {
        ok: false,
        stage: 'excel-debugger',
        reason: 'Outra extensão ou o DevTools do Chrome já está controlando a aba da Planilha. Feche a gravação/inspeção nessa aba e rode RA > BI novamente.'
      };
    }

    await delay(attempt <= attempts ? 1000 : 1500);
  }

  return {
    ok: false,
    stage: 'excel-debugger',
    reason: `Não consegui anexar o Chrome Debugger na aba da Planilha após ${attempts} tentativas: ${lastReason}`
  };
}

async function applyExcelWorkbookUpdate(preferredExcelTabId = null) {
  const settings = await getStoredSettings();
  let cancelled = getRaBiWorkflowCancellationResult('workflow-cancel');
  if (cancelled) return cancelled;

  const report = getLatestParsedRaReport();
  if (!report?.rows?.length) {
    return {
      ok: false,
      stage: 'excel-report',
      reason: 'Nenhum relatório RA validado está disponível para colar na planilha mãe.'
    };
  }

  const excelTab = Number.isInteger(preferredExcelTabId)
    ? await getTab(preferredExcelTabId)
    : await findExcelMotherSheetTabForSettings(settings);

  if (!excelTab) {
    return {
      ok: false,
      stage: 'excel-tab',
      reason: 'Aba da Planilha Mãe no Excel Web não encontrada.'
    };
  }
  const preparedExcelTab = await ensureExcelTabOnTarget(excelTab, settings, 3);
  if (!preparedExcelTab.ok) return preparedExcelTab;
  cancelled = getRaBiWorkflowCancellationResult('workflow-cancel');
  if (cancelled) return cancelled;

  return applyExcelWorkbookUpdateViaKeyboard(preparedExcelTab.tab, report, null);
}

async function applyExcelWorkbookUpdateViaKeyboard(excelTab, report, plan = null) {
  const settings = await getStoredSettings();
  let cancelled = getRaBiWorkflowCancellationResult('workflow-cancel');
  if (cancelled) return cancelled;

  const reportRows = report.rows || [];
  const anchorId = report.firstId || getRowId(reportRows[0]);
  const tsv = buildRowsTsv(reportRows);

  await setRaBiWorkflowStatus({ running: true, activeText: 'Assumindo foco da Planilha Mãe...' });
  await focusWindow(excelTab.windowId);
  await activateTab(excelTab.id);
  await delay(500);
  cancelled = getRaBiWorkflowCancellationResult('workflow-cancel');
  if (cancelled) return cancelled;

  await setRaBiWorkflowStatus({ running: true, activeText: 'Confirmando aba Relatório de Tickets...' });
  const preparedExcelTab = await ensureExcelTabOnTarget(excelTab, settings, 3);
  if (!preparedExcelTab.ok) return preparedExcelTab;
  excelTab = preparedExcelTab.tab;
  const worksheet = await verifyExcelWorksheetReady(excelTab.id, settings);
  if (!worksheet.ok) return worksheet;
  cancelled = getRaBiWorkflowCancellationResult('workflow-cancel');
  if (cancelled) return cancelled;

  const attached = await attachDebuggerToExcelTab(excelTab, settings, 3);
  if (!attached.ok) return attached;
  excelTab = attached.tab;
  const target = attached.target;
  if (!attached.ok) {
    return {
      ok: false,
      stage: 'excel-debugger',
      reason: `Não consegui anexar o Chrome Debugger na aba da Planilha: ${attached.reason}`
    };
  }

  try {
    await setRaBiWorkflowStatus({ running: true, activeText: `Procurando ID âncora ${anchorId} na Planilha...` });
    let sent = await dispatchDebuggerKey(target, 'Escape', 'Escape', 27);
    if (!sent.ok) return { ok: false, stage: 'excel-keyboard', reason: `Escape via debugger falhou: ${sent.reason}` };
    await delay(150);
    const stabilized = await stabilizeExcelBeforeFind(target, 0);
    if (!stabilized.ok) return stabilized;
    cancelled = getRaBiWorkflowCancellationResult('workflow-cancel');
    if (cancelled) return cancelled;

    let found = await findExcelIdWithSearch(target, anchorId, 'excel-find-anchor');
    if (!found.ok) return found;
    cancelled = getRaBiWorkflowCancellationResult('workflow-cancel');
    if (cancelled) return cancelled;

    await setRaBiWorkflowStatus({ running: true, activeText: `Colando ${reportRows.length} linhas do relatório...` });
    sent = await copyText(tsv);
    if (!sent.ok) return { ...sent, stage: 'clipboard' };
    cancelled = getRaBiWorkflowCancellationResult('workflow-cancel');
    if (cancelled) return cancelled;

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
    message: `Colei ${reportRows.length} linhas x ${RABI_TARGET_COLUMNS.length} colunas na Planilha Mãe a partir do ID âncora ${anchorId}.`
  };
}

async function prepareExcelWorkbook(preferredExcelTabId = null) {
  const settings = await getStoredSettings();
  const report = getLatestParsedRaReport();
  if (!report?.rows?.length) {
    return {
      ok: false,
      stage: 'excel-report',
      reason: 'Nenhum relatório RA já foi lido nesta execução. Rode RA > BI para gerar e ler o XLSX primeiro.'
    };
  }

  const excelTab = Number.isInteger(preferredExcelTabId)
    ? await getTab(preferredExcelTabId)
    : await findExcelMotherSheetTabForSettings(settings);

  if (!excelTab) {
    return {
      ok: false,
      stage: 'excel-tab',
      reason: 'Aba da Planilha Mãe no Excel Web não encontrada.'
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
    message: `Planilha Mãe pronta: aba ${worksheet.worksheetName || getExpectedExcelWorksheetName(settings)} confirmada. Próxima etapa: RA > BI pode procurar o ID âncora e colar ${report.rows.length} linhas.`
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
