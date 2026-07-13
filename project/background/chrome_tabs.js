// RaBiTool service worker module.
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function queryTabs(queryInfo = {}) {
  return new Promise((resolve) => {
    chrome.tabs.query(queryInfo, (tabs) => resolve(tabs || []));
  });
}

function getTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(tab || null);
    });
  });
}

function activateTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.update(tabId, { active: true }, (tab) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(tab || null);
    });
  });
}

function updateTab(tabId, properties) {
  return new Promise((resolve) => {
    chrome.tabs.update(tabId, properties, (tab) => {
      if (chrome.runtime.lastError) return resolve(null);
      resolve(tab || null);
    });
  });
}

function focusWindow(windowId) {
  return new Promise((resolve) => {
    if (!Number.isInteger(windowId)) return resolve(false);
    chrome.windows.update(windowId, { focused: true }, () => {
      resolve(!chrome.runtime.lastError);
    });
  });
}

function waitForTabComplete(tabId, timeoutMs = 12000) {
  return new Promise(async (resolve) => {
    const current = await getTab(tabId);
    if (current?.status === 'complete') return resolve(true);

    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(false);
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(true);
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function runFunctionInTab(tabId, func, args = []) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({ target: { tabId }, func, args }, (results) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, reason: chrome.runtime.lastError.message || 'Não consegui acessar a aba.' });
        return;
      }
      resolve(results?.[0]?.result || { ok: false, reason: 'A aba não retornou resultado.' });
    });
  });
}

function runFunctionInTabFrames(tabId, func, args = []) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func, args }, (results) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, reason: chrome.runtime.lastError.message || 'Não consegui acessar os frames da aba.' });
        return;
      }
      resolve({
        ok: true,
        results: (results || []).map((item) => ({
          frameId: item.frameId,
          result: item.result || null
        }))
      });
    });
  });
}

function debuggerAttach(target, version = '1.3') {
  return new Promise((resolve) => {
    chrome.debugger.attach(target, version, () => {
      resolve(chrome.runtime.lastError
        ? { ok: false, reason: chrome.runtime.lastError.message }
        : { ok: true });
    });
  });
}

function debuggerDetach(target) {
  return new Promise((resolve) => {
    chrome.debugger.detach(target, () => resolve(!chrome.runtime.lastError));
  });
}

function debuggerSendCommand(target, method, params = {}) {
  return new Promise((resolve) => {
    chrome.debugger.sendCommand(target, method, params, (result) => {
      resolve(chrome.runtime.lastError
        ? { ok: false, reason: chrome.runtime.lastError.message }
        : { ok: true, result });
    });
  });
}

async function dispatchDebuggerKey(target, key, code, windowsVirtualKeyCode, options = {}) {
  const modifiers = (options.ctrl ? 2 : 0) + (options.shift ? 8 : 0);
  const base = { key, code, windowsVirtualKeyCode, nativeVirtualKeyCode: windowsVirtualKeyCode, modifiers };
  const down = await debuggerSendCommand(target, 'Input.dispatchKeyEvent', { ...base, type: 'rawKeyDown' });
  if (!down.ok) return down;
  await delay(options.holdMs || 35);
  return debuggerSendCommand(target, 'Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
}

async function dispatchDebuggerCtrlShortcut(target, key, code, windowsVirtualKeyCode) {
  const control = { key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17, modifiers: 2 };
  let result = await debuggerSendCommand(target, 'Input.dispatchKeyEvent', { ...control, type: 'rawKeyDown' });
  if (!result.ok) return result;
  await delay(40);
  result = await debuggerSendCommand(target, 'Input.dispatchKeyEvent', {
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
    modifiers: 2,
    type: 'rawKeyDown'
  });
  if (!result.ok) return result;
  await delay(40);
  result = await debuggerSendCommand(target, 'Input.dispatchKeyEvent', {
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
    modifiers: 2,
    type: 'keyUp'
  });
  if (!result.ok) return result;
  await delay(40);
  return debuggerSendCommand(target, 'Input.dispatchKeyEvent', { ...control, type: 'keyUp' });
}

async function dispatchDebuggerCtrlShiftKey(target, key, code, windowsVirtualKeyCode) {
  const control = { key: 'Control', code: 'ControlLeft', windowsVirtualKeyCode: 17, nativeVirtualKeyCode: 17, modifiers: 2 };
  const shift = { key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, nativeVirtualKeyCode: 16, modifiers: 10 };
  let result = await debuggerSendCommand(target, 'Input.dispatchKeyEvent', { ...control, type: 'rawKeyDown' });
  if (!result.ok) return result;
  await delay(35);
  result = await debuggerSendCommand(target, 'Input.dispatchKeyEvent', { ...shift, type: 'rawKeyDown' });
  if (!result.ok) return result;
  await delay(35);
  result = await debuggerSendCommand(target, 'Input.dispatchKeyEvent', {
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
    modifiers: 10,
    type: 'rawKeyDown'
  });
  if (!result.ok) return result;
  await delay(45);
  result = await debuggerSendCommand(target, 'Input.dispatchKeyEvent', {
    key,
    code,
    windowsVirtualKeyCode,
    nativeVirtualKeyCode: windowsVirtualKeyCode,
    modifiers: 10,
    type: 'keyUp'
  });
  if (!result.ok) return result;
  await delay(35);
  result = await debuggerSendCommand(target, 'Input.dispatchKeyEvent', { ...shift, modifiers: 2, type: 'keyUp' });
  if (!result.ok) return result;
  await delay(35);
  return debuggerSendCommand(target, 'Input.dispatchKeyEvent', { ...control, modifiers: 0, type: 'keyUp' });
}

async function dispatchDebuggerMouseClick(target, x, y) {
  const point = { x: Math.max(1, Math.round(x)), y: Math.max(1, Math.round(y)), button: 'left', clickCount: 1 };
  let result = await debuggerSendCommand(target, 'Input.dispatchMouseEvent', { ...point, type: 'mouseMoved' });
  if (!result.ok) return result;
  await delay(40);
  result = await debuggerSendCommand(target, 'Input.dispatchMouseEvent', { ...point, type: 'mousePressed' });
  if (!result.ok) return result;
  await delay(70);
  return debuggerSendCommand(target, 'Input.dispatchMouseEvent', { ...point, type: 'mouseReleased' });
}

function dispatchDebuggerInsertText(target, text) {
  return debuggerSendCommand(target, 'Input.insertText', { text: String(text ?? '') });
}

async function dispatchDebuggerTextInput(target, text) {
  const value = String(text ?? '');
  for (const char of value) {
    const upper = char.toUpperCase();
    const isDigit = /^[0-9]$/.test(char);
    const isLetter = /^[A-Z]$/.test(upper);
    const code = isDigit ? `Digit${char}` : (isLetter ? `Key${upper}` : '');
    const keyCode = isDigit || isLetter ? upper.charCodeAt(0) : char.charCodeAt(0);
    const key = isDigit || isLetter ? char : char;
    let result = await debuggerSendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code,
      text: char,
      unmodifiedText: char,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode
    });
    if (!result.ok) return result;
    await delay(25);
    result = await debuggerSendCommand(target, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode
    });
    if (!result.ok) return result;
    await delay(20);
  }
  return { ok: true };
}
