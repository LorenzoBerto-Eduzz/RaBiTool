// Reclame Aqui source-page automation.
const RA_EXPORT_URL_FRAGMENT = 'app.hugme.com.br/app.html#/dados/tickets/exportar';
const EXCEL_HOST_HINTS = ['eduzz.sharepoint.com', 'excel.officeapps.live.com', 'officeapps.live.com'];

function getStoredSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (data) => resolve(withDefaultSettings(data?.[SETTINGS_KEY])));
  });
}

function formatTwoDigits(value) {
  return String(value).padStart(2, '0');
}

function formatDateInput(date) {
  return [
    formatTwoDigits(date.getDate()),
    formatTwoDigits(date.getMonth() + 1),
    date.getFullYear()
  ].join('');
}

function formatReportTimeTag(date) {
  return [
    formatTwoDigits(date.getHours()),
    formatTwoDigits(date.getMinutes()),
    formatTwoDigits(date.getSeconds()),
    formatTwoDigits(date.getDate()),
    formatTwoDigits(date.getMonth() + 1),
    String(date.getFullYear()).slice(-2)
  ].join('');
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isRaExportTab(tab) {
  return String(tab?.url || '').includes(RA_EXPORT_URL_FRAGMENT);
}

function isExcelMotherSheetTab(tab, settings) {
  const url = String(tab?.url || '');
  const configuredUrl = String(settings?.excelWorkbookUrl || '').trim();
  if (configuredUrl && url.startsWith(configuredUrl)) return true;
  return EXCEL_HOST_HINTS.some((hint) => url.includes(hint));
}

async function findRequiredWorkflowTabs(settings) {
  const tabs = await queryTabs({});
  const raTabs = tabs.filter(isRaExportTab);
  const excelTabs = tabs.filter((tab) => isExcelMotherSheetTab(tab, settings));

  if (!raTabs.length || !excelTabs.length) {
    return {
      ok: false,
      stage: 'tabs',
      reason: 'Abas do HugMe e Planilha Mae nao preparadas'
    };
  }

  return { ok: true, raTab: raTabs[0], excelTab: excelTabs[0] };
}

async function waitForMatchingDownload(title, clickedAtMs, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const normalizedTitle = String(title || '').toLowerCase();
  let lastSeen = '';

  while (Date.now() < deadline) {
    await setRaBiWorkflowStatus({
      running: true,
      activeText: 'Aguardando download do XLSX...'
    });
    const result = await new Promise((resolve) => {
      chrome.downloads.search({ limit: 20, orderBy: ['-startTime'] }, (downloads) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, reason: chrome.runtime.lastError.message });
          return;
        }

        const freshXlsx = (downloads || []).filter((item) => {
          const startedAt = item.startTime ? new Date(item.startTime).getTime() : 0;
          const filename = String(item.filename || item.url || '').toLowerCase();
          return startedAt >= clickedAtMs - 2000 &&
            (filename.endsWith('.xlsx') || filename.includes('.xlsx?'));
        });
        const match = freshXlsx.find((item) => {
          const filename = String(item.filename || item.url || '').toLowerCase();
          return filename.includes(normalizedTitle);
        }) || (freshXlsx.length === 1 ? freshXlsx[0] : null);

        if (!match) {
          const newest = freshXlsx[0];
          return resolve({
            ok: false,
            pending: true,
            seen: newest?.filename || newest?.url || ''
          });
        }
        if (match.error || match.state === 'interrupted') {
          resolve({ ok: false, reason: `Download interrompido: ${match.error || 'erro desconhecido'}` });
          return;
        }
        if (match.state === 'complete') {
          resolve({
            ok: true,
            downloadId: match.id,
            filename: match.filename,
            url: match.url,
            mime: match.mime
          });
          return;
        }
        resolve({ ok: false, pending: true });
      });
    });

    if (result.seen) lastSeen = result.seen;
    if (result.ok || !result.pending) return result;
    await delay(1000);
  }

  return {
    ok: false,
    reason: lastSeen
      ? `O XLSX apareceu, mas nao terminou dentro do tempo limite: ${lastSeen}`
      : 'O download do XLSX nao iniciou/terminou dentro do tempo limite.'
  };
}

function setupRaReportFormInPage(args) {
  const {
    companyLabel,
    title,
    startDate,
    endDate,
    orderLabel,
    orderTypeLabel,
    waitMs
  } = args;

  const result = { ok: false, stage: 'ra-form' };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function visible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && !element.closest('.ng-hide');
  }

  async function waitFor(selector, label) {
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      const element = document.querySelector(selector);
      if (element) return element;
      await sleep(250);
    }
    throw new Error(`Elemento nao encontrado: ${label || selector}`);
  }

  function dispatchInput(element) {
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function normalizeComparable(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function selectedText(select) {
    return select?.selectedOptions?.[0]?.label ||
      select?.selectedOptions?.[0]?.textContent?.trim() ||
      select?.options?.[select.selectedIndex]?.label ||
      select?.options?.[select.selectedIndex]?.textContent?.trim() ||
      '';
  }

  function normalizeDateValue(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function isFormattedDate(value, expectedDigits) {
    return String(value || '').trim() === `${expectedDigits.slice(0, 2)}/${expectedDigits.slice(2, 4)}/${expectedDigits.slice(4)}`;
  }

  function selectByLabel(select, label) {
    const expected = normalizeComparable(label);
    const option = Array.from(select.options).find((item) => {
      return normalizeComparable(item.label) === expected ||
        normalizeComparable(item.textContent) === expected;
    });
    if (!option) throw new Error(`Opcao nao encontrada: ${label}`);
    if (select.value !== option.value) {
      select.value = option.value;
      dispatchInput(select);
    }
  }

  function keyCodeFor(key) {
    if (key === 'Enter') return 13;
    if (/^\d$/.test(key)) return key.charCodeAt(0);
    return 0;
  }

  function sendKeyboardEvent(element, type, key) {
    const code = keyCodeFor(key);
    const event = new KeyboardEvent(type, {
      key,
      code: key === 'Enter' ? 'Enter' : `Digit${key}`,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    try {
      Object.defineProperty(event, 'keyCode', { get: () => code });
      Object.defineProperty(event, 'which', { get: () => code });
      Object.defineProperty(event, 'charCode', { get: () => (type === 'keypress' ? code : 0) });
    } catch {
      // Some browsers keep these readonly. The KeyboardEvent key/code still carries intent.
    }
    element.dispatchEvent(event);
    return !event.defaultPrevented;
  }

  function sendKey(element, key) {
    sendKeyboardEvent(element, 'keydown', key);
    sendKeyboardEvent(element, 'keypress', key);
    sendKeyboardEvent(element, 'keyup', key);
  }

  function setText(input, value, { pressEnter = false } = {}) {
    if (input.value !== value) {
      input.focus();
      input.value = value;
    }
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (pressEnter) sendKey(input, 'Enter');
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function clearInputLikeUser(input) {
    input.focus();
    input.select?.();
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function insertDigitLikeUser(input, digit) {
    sendKeyboardEvent(input, 'keydown', digit);
    sendKeyboardEvent(input, 'keypress', digit);
    const beforeInput = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      composed: true,
      data: digit,
      inputType: 'insertText'
    });
    input.dispatchEvent(beforeInput);
    if (!beforeInput.defaultPrevented) {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      input.setRangeText?.(digit, start, end, 'end');
      if (!input.setRangeText) input.value = `${input.value || ''}${digit}`;
    }
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: digit,
      inputType: 'insertText'
    }));
    sendKeyboardEvent(input, 'keyup', digit);
  }

  async function setDateText(input, value, label) {
    clearInputLikeUser(input);
    for (const digit of value) {
      insertDigitLikeUser(input, digit);
      await sleep(35);
    }
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(120);
    sendKey(input, 'Enter');
    await sleep(700);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(500);
    if (normalizeDateValue(input.value) !== value) {
      throw new Error(`Campo ${label} nao confirmou a data ${value}. Valor atual: ${input.value || 'vazio'}.`);
    }
    if (!isFormattedDate(input.value, value)) {
      throw new Error(`Campo ${label} recebeu ${value}, mas o HugMe nao formatou/confirmou com Enter. Valor atual: ${input.value || 'vazio'}.`);
    }
  }

  async function confirmRaSetup(fields) {
    await sleep(1000);
    const issues = [];
    if (normalizeComparable(selectedText(fields.company)) !== normalizeComparable(companyLabel)) {
      issues.push(`empresa=${selectedText(fields.company) || 'vazio'}`);
    }
    if (String(fields.titleInput.value || '').trim() !== title) {
      issues.push(`titulo=${fields.titleInput.value || 'vazio'}`);
    }
    if (!fields.periodRadio.checked) {
      issues.push('periodo A definir nao marcado');
    }
    if (normalizeDateValue(fields.startInput.value) !== startDate) {
      issues.push(`data inicial=${fields.startInput.value || 'vazio'}`);
    }
    if (normalizeDateValue(fields.endInput.value) !== endDate) {
      issues.push(`data final=${fields.endInput.value || 'vazio'}`);
    }
    if (normalizeComparable(selectedText(fields.order)) !== normalizeComparable(orderLabel)) {
      issues.push(`ordenacao=${selectedText(fields.order) || 'vazio'}`);
    }
    if (normalizeComparable(selectedText(fields.orderType)) !== normalizeComparable(orderTypeLabel)) {
      issues.push(`tipo ordenacao=${selectedText(fields.orderType) || 'vazio'}`);
    }
    if (!fields.selectAll.checked) {
      issues.push('selecionar todos nao marcado');
    }
    if (issues.length) {
      throw new Error(`HugMe nao confirmou os campos antes de gerar relatorio: ${issues.join('; ')}`);
    }
  }

  return (async () => {
    try {
      const company = await waitFor('select.empresa', 'empresa');
      selectByLabel(company, companyLabel);

      const titleInput = await waitFor('input.titulo', 'titulo');
      setText(titleInput, title);

      const periodRadio = await waitFor('#periodoADefinir', 'periodo A definir');
      if (!periodRadio.checked) periodRadio.click();

      const startInput = await waitFor('#starty', 'data inicial');
      const endInput = await waitFor('#endy', 'data final');
      const enableDeadline = Date.now() + waitMs;
      while ((startInput.disabled || endInput.disabled) && Date.now() < enableDeadline) {
        await sleep(250);
      }
      if (startInput.disabled || endInput.disabled) {
        throw new Error('Campos de periodo continuam desabilitados apos selecionar A definir.');
      }
      await setDateText(startInput, startDate, 'data inicial');
      await setDateText(endInput, endDate, 'data final');

      const order = await waitFor('select.order', 'ordenacao');
      selectByLabel(order, orderLabel);
      const orderType = await waitFor('select.order-type', 'tipo de ordenacao');
      selectByLabel(orderType, orderTypeLabel);

      const selectAll = await waitFor('#selAll', 'selecionar todos');
      if (!selectAll.checked) selectAll.click();
      await sleep(250);
      await confirmRaSetup({ company, titleInput, periodRadio, startInput, endInput, order, orderType, selectAll });

      const button = Array.from(document.querySelectorAll('button')).find((item) => {
        return visible(item) && item.textContent.trim().toLowerCase() === 'gerar relatório';
      });
      if (!button) throw new Error('Botao Gerar relatorio nao encontrado.');
      button.click();

      return {
        ok: true,
        stage: 'ra-form',
        title,
        startDate,
        endDate,
        orderLabel,
        orderTypeLabel
      };
    } catch (error) {
      result.reason = error?.message || String(error);
      return result;
    }
  })();
}

function inspectRaReportItemInPage(title) {
  function visible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && !element.closest('.ng-hide');
  }

  const items = Array.from(document.querySelectorAll('li.item'));
  const matches = items.filter((item) => {
    const heading = item.querySelector('h5');
    return heading && heading.textContent.trim() === title && visible(item);
  });

  if (!matches.length) {
    return { ok: true, stage: 'ra-processing', status: 'missing', title };
  }
  if (matches.length > 1) {
    return { ok: false, stage: 'ra-processing', reason: `Mais de um relatorio encontrado com o titulo ${title}.` };
  }

  const item = matches[0];
  const buttons = Array.from(item.querySelectorAll('button'));
  const downloadButton = buttons.find((button) => visible(button) && button.textContent.trim().toLowerCase() === 'download');
  const processingButton = buttons.find((button) => visible(button) && button.textContent.toLowerCase().includes('processando'));
  const idText = Array.from(item.querySelectorAll('.faded.id')).map((node) => node.textContent.trim()).find(Boolean) || '';
  const dateText = Array.from(item.querySelectorAll('.faded.date')).map((node) => node.textContent.trim()).find(Boolean) || '';

  if (downloadButton) {
    return { ok: true, stage: 'ra-processing', status: 'ready', title, idText, dateText };
  }
  if (processingButton) {
    return { ok: true, stage: 'ra-processing', status: 'processing', title, idText, dateText };
  }
  return { ok: true, stage: 'ra-processing', status: 'unknown', title, idText, dateText };
}

function clickRaReportDownloadInPage(title) {
  function visible(element) {
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && !element.closest('.ng-hide');
  }

  const items = Array.from(document.querySelectorAll('li.item')).filter((item) => {
    const heading = item.querySelector('h5');
    return heading && heading.textContent.trim() === title && visible(item);
  });
  if (items.length !== 1) {
    return { ok: false, stage: 'ra-download', reason: `Relatorio ${title} nao foi encontrado de forma unica para download.` };
  }
  const item = items[0];
  const button = Array.from(item.querySelectorAll('button')).find((item) => {
    return visible(item) && item.textContent.trim().toLowerCase() === 'download';
  });
  if (!button) return { ok: false, stage: 'ra-download', reason: `Botao Download nao esta visivel para ${title}.` };

  button.scrollIntoView({ block: 'center', inline: 'center' });
  button.focus();
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
    button.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  });

  const idText = Array.from(item.querySelectorAll('.faded.id')).map((node) => node.textContent.trim()).find(Boolean) || '';
  const reportId = (idText.match(/\d+/) || [])[0];
  return { ok: true, stage: 'ra-download', title, reportId };
}

async function waitForRaReportReady(tabId, title, pollingMs, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = null;

  while (Date.now() < deadline) {
    await setRaBiWorkflowStatus({
      running: true,
      activeText: 'Aguardando relatorio processar no HugMe...'
    });
    const inspection = await runFunctionInTab(tabId, inspectRaReportItemInPage, [title]);
    if (!inspection.ok) return inspection;
    lastStatus = inspection.status;
    if (inspection.status === 'ready') return inspection;
    await delay(pollingMs);
  }

  return {
    ok: false,
    stage: 'ra-processing',
    reason: `Relatorio ${title} nao ficou pronto em ate ${Math.round(timeoutMs / 1000)} segundos. Ultimo estado: ${lastStatus || 'indefinido'}.`
  };
}

async function prepareReclameAquiExport() {
  const settings = await getStoredSettings();
  await setRaBiWorkflowStatus({ running: true, activeText: 'Verificando abas...' });
  const tabs = await findRequiredWorkflowTabs(settings);
  if (!tabs.ok) return tabs;

  await setRaBiWorkflowStatus({ running: true, activeText: 'Aguardando HugMe carregar...' });
  await waitForTabComplete(tabs.raTab.id, 15000);

  const now = new Date();
  const lookbackDays = 45;
  const title = `RaBiToolRelatorio${formatReportTimeTag(now)}`;
  const startDate = formatDateInput(addDays(now, -lookbackDays));
  const endDate = formatDateInput(now);
  const pollingMs = 2000;
  const processingTimeoutMs = 420000;
  const downloadTimeoutMs = Number(settings.workflow?.downloadTimeoutMs) || 60000;

  await setRaBiWorkflowStatus({ running: true, activeText: 'Preparando relatorio no HugMe...' });
  const setup = await runFunctionInTab(tabs.raTab.id, setupRaReportFormInPage, [{
    companyLabel: 'Eduzz',
    title,
    startDate,
    endDate,
    orderLabel: 'Data Reclamação',
    orderTypeLabel: 'ascendente',
    waitMs: 15000
  }]);

  if (!setup.ok) return setup;

  const ready = await waitForRaReportReady(tabs.raTab.id, title, pollingMs, processingTimeoutMs);
  if (!ready.ok) return ready;

  await setRaBiWorkflowStatus({ running: true, activeText: 'Relatorio pronto. Clicando em Download...' });
  const clickedAtMs = Date.now();
  const clicked = await runFunctionInTab(tabs.raTab.id, clickRaReportDownloadInPage, [title]);
  if (!clicked.ok) return clicked;

  await setRaBiWorkflowStatus({ running: true, activeText: 'Baixando XLSX pelo Chrome...' });
  const download = await waitForMatchingDownload(title, clickedAtMs, downloadTimeoutMs);
  if (!download.ok) {
    return { ok: false, stage: 'download', reason: download.reason || 'Download nao encontrado.' };
  }

  return {
    ok: true,
    stage: 'download',
    title,
    startDate,
    endDate,
    downloadId: download.downloadId,
    filename: download.filename,
    message: `XLSX baixado e detectado: ${download.filename || title}`
  };
}

async function findLatestRaDownload() {
  if (!chrome.downloads?.search) {
    return { ok: false, stage: 'download', reason: 'Chrome downloads API is unavailable.' };
  }

  return new Promise((resolve) => {
    chrome.downloads.search({ limit: 10, orderBy: ['-startTime'] }, (downloads) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, stage: 'download', reason: chrome.runtime.lastError.message });
        return;
      }

      const latestXlsx = (downloads || []).find((item) => {
        const filename = String(item.filename || item.url || '').toLowerCase();
        return filename.endsWith('.xlsx') || filename.includes('.xlsx?');
      });

      if (!latestXlsx) {
        resolve({ ok: false, stage: 'download', reason: 'No recent XLSX download was found.' });
        return;
      }

      resolve({
        ok: true,
        stage: 'download',
        downloadId: latestXlsx.id,
        filename: latestXlsx.filename,
        state: latestXlsx.state
      });
    });
  });
}
