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
        resolve({ ok: false, reason: chrome.runtime.lastError.message || 'Could not access the tab.' });
        return;
      }
      resolve(results?.[0]?.result || { ok: false, reason: 'The tab did not return a result.' });
    });
  });
}
