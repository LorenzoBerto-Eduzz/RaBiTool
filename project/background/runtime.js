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
  if (!safeUrl) return callback?.({ ok: false, reason: 'URL não informada.' });
  const props = { url: safeUrl, active: false };
  if (Number.isInteger(openerTab?.id)) props.openerTabId = openerTab.id;
  if (Number.isInteger(openerTab?.index)) props.index = openerTab.index + 1;
  chrome.tabs.create(props, (tab) => {
    if (chrome.runtime.lastError || !tab) return callback?.({ ok: false, reason: 'Não consegui abrir a aba solicitada.' });
    callback?.({ ok: true, tabId: tab.id });
  });
}

function sendToTab(tabId, message, callback) {
  if (!Number.isInteger(tabId)) return callback?.({ ok: false, reason: 'Aba não informada.' });
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (chrome.runtime.lastError) return callback?.({ ok: false, reason: 'Popup/conteúdo da aba não está disponível.' });
    callback?.(response || { ok: true });
  });
}

function getLocalStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (data) => resolve(data || {}));
  });
}

function setLocalStorage(patch) {
  return new Promise((resolve) => {
    chrome.storage.local.set(patch, () => {
      resolve({ ok: !chrome.runtime.lastError, reason: chrome.runtime.lastError?.message || '' });
    });
  });
}

async function setRaBiToolEnabled(enabled, openerTab = null) {
  const nextEnabled = enabled !== false;
  const data = await getLocalStorage(SETTINGS_KEY);
  const settings = withDefaultSettings(data?.[SETTINGS_KEY]);
  settings.enabled = nextEnabled;
  const saved = await setLocalStorage({ enabled: nextEnabled, [SETTINGS_KEY]: settings });
  if (!saved.ok) return saved;

  if (nextEnabled) {
    clearFinishedRaBiWorkflowStatus();
    await ensureWorkspaceTabs(openerTab, { forceNew: true });
    return { ok: true, enabled: true };
  }

  await requestRaBiWorkflowCancel('RA > BI cancelado pelo usuário.');
  const closed = await closeTrackedWorkspaceTabs();
  return {
    ok: closed.ok,
    enabled: false,
    cancelledWorkflow: true,
    closedWorkspaceTabs: true,
    removedTabIds: closed.removedTabIds || [],
    reason: closed.reason || ''
  };
}

chrome.runtime.onInstalled.addListener((details) => {
  handleInstalled(details, () => syncAutoRunAlarm());
});
chrome.runtime.onStartup?.addListener(() => {
  setStartupDisabled(() => syncAutoRunAlarm());
});
chrome.alarms?.onAlarm?.addListener(handleAutoRunAlarm);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  handleWorkspaceTabUpdated(tabId, changeInfo, tab);
});
chrome.tabs.onRemoved.addListener((tabId) => {
  handleWorkspaceTabRemoved(tabId);
});

chrome.action?.onClicked?.addListener((tab) => {
  chrome.storage.local.get(['enabled'], ({ enabled }) => {
    setRaBiToolEnabled(!enabled, tab);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }

  if (message?.action === 'SET_ENABLED') {
    setRaBiToolEnabled(message.enabled !== false, sender.tab).then(sendResponse);
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
      syncAutoRunAlarm(settings);
      sendResponse({ ok: !chrome.runtime.lastError });
    });
    return true;
  }

  return false;
});
