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
