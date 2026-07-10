// Runtime message routing and workflow registration.
const WORKFLOW_RUNNERS = {
  [RABITOOL_ACTIONS.START_RA_TO_EXCEL]: startRaToExcelWorkflow,
  [RABITOOL_ACTIONS.PREPARE_RA_EXPORT]: prepareRaExportWorkflow,
  [RABITOOL_ACTIONS.CHECK_RA_DOWNLOAD]: checkRaDownloadWorkflow,
  [RABITOOL_ACTIONS.PREPARE_EXCEL_IMPORT]: prepareExcelImportWorkflow
};

function runWorkflowAction(action, message, sender) {
  const runner = WORKFLOW_RUNNERS[action];
  return typeof runner === 'function' ? runner(message, sender) : null;
}

function openSideTab(url, openerTab, callback) {
  const safeUrl = String(url || '').trim();
  if (!safeUrl) return callback?.({ ok: false, reason: 'NO_URL' });
  const props = { url: safeUrl, active: false };
  if (Number.isInteger(openerTab?.id)) props.openerTabId = openerTab.id;
  if (Number.isInteger(openerTab?.index)) props.index = openerTab.index + 1;
  chrome.tabs.create(props, (tab) => {
    if (chrome.runtime.lastError || !tab) return callback?.({ ok: false, reason: 'OPEN_FAILED' });
    callback?.({ ok: true, tabId: tab.id });
  });
}

function sendToTab(tabId, message, callback) {
  if (!Number.isInteger(tabId)) return callback?.({ ok: false, reason: 'NO_TAB' });
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) return callback?.({ ok: false, reason: 'CONTENT_UNAVAILABLE' });
    callback?.(response || { ok: true });
  });
}

chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.runtime.onStartup?.addListener(setStartupDisabled);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  handleWorkspaceTabUpdated(tabId, changeInfo, tab);
});
chrome.tabs.onRemoved.addListener((tabId) => {
  handleWorkspaceTabRemoved(tabId);
});

chrome.action?.onClicked?.addListener((tab) => {
  chrome.storage.local.get(['enabled', SETTINGS_KEY], ({ enabled, [SETTINGS_KEY]: rawSettings }) => {
    const nextEnabled = !enabled;
    const settings = withDefaultSettings(rawSettings);
    settings.enabled = nextEnabled;
    chrome.storage.local.set({ enabled: nextEnabled, [SETTINGS_KEY]: settings }, () => {
      if (nextEnabled) {
        clearFinishedRaBiWorkflowStatus();
        ensureWorkspaceTabs(tab);
      }
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }

  if (message?.action === 'SET_ENABLED') {
    chrome.storage.local.get(SETTINGS_KEY, (data) => {
      const enabled = message.enabled !== false;
      const settings = withDefaultSettings(data?.[SETTINGS_KEY]);
      settings.enabled = enabled;
      chrome.storage.local.set({ enabled, [SETTINGS_KEY]: settings }, () => {
        if (enabled) {
          clearFinishedRaBiWorkflowStatus();
          ensureWorkspaceTabs(sender.tab);
        }
        sendResponse({ ok: !chrome.runtime.lastError });
      });
    });
    return true;
  }

  if (message?.action === 'GET_WORKSPACE_STATUS') {
    getWorkspaceStatus().then(sendResponse);
    return true;
  }

  if (message?.action === 'GET_WORKFLOW_STATUS') {
    chrome.storage.local.get(WORKFLOW_STATUS_KEY, (data) => {
      sendResponse({ ok: true, status: data?.[WORKFLOW_STATUS_KEY] || null });
    });
    return true;
  }

  if (message?.action === 'FOCUS_WORKSPACE_TAB') {
    focusWorkspaceTab(message.kind).then(sendResponse);
    return true;
  }

  if (message?.action === 'OPEN_SIDE_TAB') {
    openSideTab(message.url, sender.tab, sendResponse);
    return true;
  }

  const workflowPromise = runWorkflowAction(message?.action, message, sender);
  if (workflowPromise) {
    workflowPromise
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          stage: 'workflow',
          reason: error?.message || String(error) || 'Erro inesperado no workflow.'
        });
      });
    return true;
  }

  if (message?.action === 'GET_RABITOOL_SETTINGS') {
    chrome.storage.local.get([SETTINGS_KEY, 'enabled'], (data) => {
      sendResponse({ ok: true, enabled: data.enabled === true, settings: withDefaultSettings(data[SETTINGS_KEY]) });
    });
    return true;
  }

  if (message?.action === 'SAVE_RABITOOL_SETTINGS') {
    const settings = withDefaultSettings(message.settings);
    chrome.storage.local.set({ enabled: settings.enabled !== false, [SETTINGS_KEY]: settings }, () => {
      sendResponse({ ok: !chrome.runtime.lastError });
    });
    return true;
  }

  return false;
});
