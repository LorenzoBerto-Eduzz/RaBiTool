// RaBiTool service worker module.
let offscreenCreating = null;

async function ensureOffscreenDocument() {
  if (!chrome.offscreen?.createDocument) {
    return { ok: false, reason: 'Offscreen documents are not available in this Chrome version.' };
  }

  if (chrome.offscreen.hasDocument && await chrome.offscreen.hasDocument()) {
    return { ok: true };
  }

  if (!offscreenCreating) {
    offscreenCreating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['CLIPBOARD'],
      justification: 'Prepare extension-generated text for the clipboard.'
    }).finally(() => {
      offscreenCreating = null;
    });
  }

  try {
    await offscreenCreating;
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error?.message || String(error) };
  }
}

async function copyText(text) {
  const ready = await ensureOffscreenDocument();
  if (!ready.ok) return ready;

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'OFFSCREEN_COPY_TEXT', value: text }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, reason: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, reason: 'No clipboard response.' });
    });
  });
}

function waitForClipboardReaderResult(token, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      resolve({ ok: false, reason: 'Leitor de clipboard focado demorou demais para responder.' });
    }, timeoutMs);

    function listener(message) {
      if (message?.action !== 'RABITOOL_CLIPBOARD_READER_RESULT' || message.token !== token) return;
      clearTimeout(timeout);
      chrome.runtime.onMessage.removeListener(listener);
      resolve(message.result || { ok: false, reason: 'Leitor de clipboard focado nao retornou resultado.' });
    }

    chrome.runtime.onMessage.addListener(listener);
  });
}

async function readTextWithFocusedTab(returnTabId = null) {
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const url = chrome.runtime.getURL(`clipboard_reader.html?token=${encodeURIComponent(token)}`);
  const readerTab = await new Promise((resolve) => {
    chrome.tabs.create({ url, active: true }, (tab) => {
      resolve(chrome.runtime.lastError ? null : tab);
    });
  });

  if (!readerTab?.id) {
    return { ok: false, reason: 'Nao consegui abrir o leitor focado de clipboard da extensao.' };
  }

  const result = await waitForClipboardReaderResult(token);

  await new Promise((resolve) => {
    chrome.tabs.remove(readerTab.id, () => resolve(!chrome.runtime.lastError));
  });

  if (Number.isInteger(returnTabId)) {
    await activateTab(returnTabId);
    await delay(350);
  }

  return result.ok
    ? { ...result, method: 'focused-extension-tab' }
    : result;
}

async function readText(options = {}) {
  const ready = await ensureOffscreenDocument();
  if (!ready.ok && Number.isInteger(options.returnTabId)) {
    return readTextWithFocusedTab(options.returnTabId);
  }
  if (!ready.ok) return ready;

  const offscreenResult = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'OFFSCREEN_READ_TEXT' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, reason: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, reason: 'No clipboard read response.' });
    });
  });

  if (offscreenResult.ok || !Number.isInteger(options.returnTabId)) return offscreenResult;
  return readTextWithFocusedTab(options.returnTabId);
}
