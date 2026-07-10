(() => {
  if (window.__rabiToolLoaded) return;
  window.__rabiToolLoaded = true;

  const POPUP_ID = 'rabi-tool-popup';
  const POSITION_KEY = 'rabiToolPopupPositionTopRightV2';
  const SETTINGS_KEY = 'rabiToolSettings';
  const WORKFLOW_STATUS_KEY = 'rabiToolWorkflowStatus';
  const DEFAULT_SETTINGS = {
    enabled: false,
    toolName: 'RaBiTool',
    reclameAquiUrl: '',
    excelWorkbookUrl: '',
    excelWorksheetName: '',
    targetHosts: 'Reclame Aqui; Excel Web',
    notes: '',
    workflow: {
      mode: 'ui-automation',
      importStrategy: 'replace-or-append-rows',
      reportLookbackDays: 45,
      reportPollingMs: 2000,
      reportProcessingTimeoutMs: 420000,
      downloadTimeoutMs: 60000
    },
    shortcuts: {
      togglePopup: '',
      openOptions: ''
    }
  };

  let enabled = true;
  let popup = null;
  let popupAnchoredTopRight = false;
  let workspacePollTimer = null;
  let workflowRunning = false;
  let lastWorkflowStatus = null;
  let lastWorkspaceStatus = null;
  let settings = { ...DEFAULT_SETTINGS, shortcuts: { ...DEFAULT_SETTINGS.shortcuts } };

  function isSupportedPage() {
    return ['http:', 'https:', 'file:'].includes(location.protocol);
  }

  function normalizeShortcut(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  }

  function normalizeKey(key) {
    const raw = String(key || '').trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    const aliases = {
      ' ': 'space',
      esc: 'escape',
      arrowup: 'up',
      arrowdown: 'down',
      arrowleft: 'left',
      arrowright: 'right'
    };
    return aliases[lower] || lower;
  }

  function eventToShortcut(event) {
    const parts = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    if (event.metaKey) parts.push('meta');
    const key = normalizeKey(event.key);
    if (!key || ['control', 'alt', 'shift', 'meta'].includes(key)) return '';
    parts.push(key);
    return parts.join('+');
  }

  function withDefaultSettings(raw = {}) {
    return {
      ...DEFAULT_SETTINGS,
      ...(raw || {}),
      workflow: { ...DEFAULT_SETTINGS.workflow, ...(raw?.workflow || {}) },
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(raw?.shortcuts || {}) }
    };
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) return resolve(null);
          resolve(response || null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  function ensureStyle() {
    if (document.getElementById(`${POPUP_ID}-styles`)) return;
    const style = document.createElement('style');
    style.id = `${POPUP_ID}-styles`;
    style.textContent = window.RaBiToolUI?.getStyle?.() || '';
    document.documentElement.appendChild(style);
  }

  function clampPopup(save = false) {
    if (!popup) return;
    const margin = 10;
    if (popupAnchoredTopRight) {
      popup.style.left = 'auto';
      popup.style.right = `${margin}px`;
      popup.style.top = `${margin}px`;
      popup.style.bottom = 'auto';
      return;
    }
    const rect = popup.getBoundingClientRect();
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - rect.width - margin));
    const top = Math.max(margin, Math.min(rect.top, window.innerHeight - rect.height - margin));
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.right = 'auto';
    popup.style.bottom = 'auto';
    if (save) chrome.storage.local.set({ [POSITION_KEY]: { left, top } });
  }

  function bindDragging() {
    const handle = popup.querySelector('.csh-drag-handle');
    if (!handle) return;
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener('mousedown', (event) => {
      event.preventDefault();
      dragging = true;
      const rect = popup.getBoundingClientRect();
      popupAnchoredTopRight = false;
      popup.style.left = `${rect.left}px`;
      popup.style.top = `${rect.top}px`;
      popup.style.right = 'auto';
      popup.style.bottom = 'auto';
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (event) => {
      if (!dragging) return;
      popup.style.left = `${event.clientX - offsetX}px`;
      popup.style.top = `${event.clientY - offsetY}px`;
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = '';
      clampPopup(true);
    });
  }

  function bindButtons() {
    popup.querySelector('#csh-btn-close')?.addEventListener('click', async () => {
      await sendMessage({ action: 'SET_ENABLED', enabled: false });
      removePopup();
    });
    popup.querySelector('#csh-btn-gear')?.addEventListener('click', () => sendMessage({ action: 'OPEN_OPTIONS' }));
    popup.querySelector('#csh-btn-run')?.addEventListener('click', () => runWorkflowButton('RABITOOL_START_RA_TO_EXCEL'));
    popup.querySelector('#csh-btn-tab-ra')?.addEventListener('click', () => focusWorkspaceTab('ra'));
    popup.querySelector('#csh-btn-tab-bi')?.addEventListener('click', () => focusWorkspaceTab('bi'));
  }

  function noticeIcon(level) {
    if (level === 'error') return '!';
    if (level === 'warn') return '!';
    return 'i';
  }

  function setNotices(notices = []) {
    const status = popup?.querySelector('#csh-status');
    if (!status) return;
    status.textContent = '';
    notices
      .filter((item) => item && String(item.text || '').trim())
      .forEach((item) => {
        const row = document.createElement('div');
        row.className = 'csh-status-item';
        row.dataset.level = item.level || 'info';
        const icon = document.createElement('span');
        icon.className = 'csh-status-icon';
        icon.textContent = noticeIcon(item.level);
        const text = document.createElement('span');
        text.textContent = String(item.text || '').trim();
        row.append(icon, text);
        status.appendChild(row);
      });
  }

  function setStatus(text, level = 'info') {
    setNotices(text ? [{ level, text }] : []);
  }

  function setProgress(active, text = '') {
    const progress = popup?.querySelector('#csh-progress');
    const progressText = popup?.querySelector('#csh-progress-text');
    const runButton = popup?.querySelector('#csh-btn-run');
    if (progress) progress.hidden = !active;
    if (progressText) progressText.textContent = text || 'Aguardando...';
    if (runButton) {
      runButton.disabled = !!active;
      runButton.dataset.running = active ? 'true' : 'false';
    }
  }

  function setWorkspaceButton(kind, info = {}) {
    const button = popup?.querySelector(`#csh-btn-tab-${kind}`);
    const icon = popup?.querySelector(`.csh-tab-icon[data-kind="${kind}"]`);
    if (!button || !icon) return;
    const state = info.state || 'unknown';
    button.dataset.state = state === 'unknown' ? 'checking' : state;
    button.title = info.reason || (state === 'ready' ? 'Pronto' : 'Verificando');
    icon.textContent = state === 'checking' ? '' : '';
  }

  function workspaceNotices(status) {
    return [status?.ra, status?.bi]
      .filter((item) => item && item.state === 'error')
      .map((item) => ({ level: 'warn', text: `${item.label}: ${item.reason}` }));
  }

  function workflowNotices(status) {
    const notices = Array.isArray(status?.notices) ? status.notices : [];
    if (!notices.length) return [];
    const specificWorkspaceNotices = workspaceNotices(lastWorkspaceStatus);
    const workspaceReady = [lastWorkspaceStatus?.ra, lastWorkspaceStatus?.bi]
      .every((item) => item?.state === 'ready');
    return notices.filter((item) => {
      if (item?.stage !== 'tabs') return true;
      return !workspaceReady && !specificWorkspaceNotices.length;
    });
  }

  function renderCombinedNotices() {
    if (!popup) return;
    const notices = [
      ...workspaceNotices(lastWorkspaceStatus),
      ...workflowNotices(lastWorkflowStatus)
    ];
    setNotices(notices);
  }

  function renderWorkspaceStatus(status) {
    lastWorkspaceStatus = status || null;
    setWorkspaceButton('ra', status?.ra);
    setWorkspaceButton('bi', status?.bi);
    renderCombinedNotices();
  }

  async function refreshWorkspaceStatus() {
    if (!popup) return;
    const status = await sendMessage({ action: 'GET_WORKSPACE_STATUS' });
    if (status?.ok) renderWorkspaceStatus(status);
  }

  function startWorkspacePolling() {
    stopWorkspacePolling();
    refreshWorkspaceStatus();
    workspacePollTimer = window.setInterval(refreshWorkspaceStatus, 2000);
  }

  function stopWorkspacePolling() {
    if (workspacePollTimer) window.clearInterval(workspacePollTimer);
    workspacePollTimer = null;
  }

  function renderWorkflowStatus(status) {
    lastWorkflowStatus = status || null;
    if (!popup) return;
    const active = !!status?.running || !!status?.activeText;
    setProgress(active, status?.activeText || '');
    workflowRunning = !!status?.running;
    renderCombinedNotices();
  }

  function refreshWorkflowStatus() {
    chrome.storage.local.get(WORKFLOW_STATUS_KEY, (data) => {
      renderWorkflowStatus(data?.[WORKFLOW_STATUS_KEY] || null);
    });
  }

  async function focusWorkspaceTab(kind) {
    const response = await sendMessage({ action: 'FOCUS_WORKSPACE_TAB', kind });
    const label = kind === 'ra' ? 'HugMe' : 'Planilha';
    if (!response?.ok) setStatus(response?.reason || `Nao consegui abrir a aba ${label}.`, 'error');
  }

  async function runWorkflowButton(action) {
    workflowRunning = true;
    setProgress(true, 'Verificando abas...');
    setNotices([]);
    const response = await sendMessage({ action });
    refreshWorkflowStatus();
    if (!response) {
      workflowRunning = false;
      setProgress(false);
      setStatus('Nao foi possivel falar com o service worker.', 'error');
      return;
    }
  }

  function createPopup() {
    if (!enabled || popup || !document.body || !isSupportedPage()) return;
    ensureStyle();
    document.getElementById(POPUP_ID)?.remove();
    popup = document.createElement('div');
    popup.id = POPUP_ID;
    popup.style.visibility = 'hidden';
    popup.innerHTML = window.RaBiToolUI?.getMarkup?.() || '';
    document.body.appendChild(popup);

    chrome.storage.local.get(POSITION_KEY, (data) => {
      const pos = data?.[POSITION_KEY];
      if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
        popupAnchoredTopRight = false;
        popup.style.left = `${pos.left}px`;
        popup.style.top = `${pos.top}px`;
        popup.style.right = 'auto';
        popup.style.bottom = 'auto';
      } else {
        popupAnchoredTopRight = true;
        popup.style.left = 'auto';
        popup.style.right = '10px';
        popup.style.top = '10px';
        popup.style.bottom = 'auto';
      }
      popup.style.visibility = 'visible';
      clampPopup();
    });

    bindDragging();
    bindButtons();
    startWorkspacePolling();
    refreshWorkflowStatus();
  }

  function removePopup() {
    popup?.remove();
    popup = null;
    popupAnchoredTopRight = false;
    stopWorkspacePolling();
  }

  function togglePopup() {
    if (popup) removePopup();
    else createPopup();
  }

  function runShortcut(actionId) {
    if (actionId === 'togglePopup') return togglePopup();
    if (actionId === 'openOptions') return sendMessage({ action: 'OPEN_OPTIONS' });
  }

  function handleShortcut(event) {
    if (!enabled || !isSupportedPage()) return;
    const pressed = normalizeShortcut(eventToShortcut(event));
    if (!pressed) return;
    const shortcuts = settings.shortcuts || {};
    const actionId = Object.keys(shortcuts).find((id) => normalizeShortcut(shortcuts[id]) === pressed);
    if (!actionId) return;
    event.preventDefault();
    event.stopPropagation();
    runShortcut(actionId);
  }

  function loadInitialState() {
    chrome.storage.local.get(['enabled', SETTINGS_KEY], (data) => {
      settings = withDefaultSettings(data[SETTINGS_KEY]);
      enabled = data.enabled === true && settings.enabled !== false;
      if (enabled) createPopup();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[SETTINGS_KEY]) settings = withDefaultSettings(changes[SETTINGS_KEY].newValue);
    if (changes[WORKFLOW_STATUS_KEY]) renderWorkflowStatus(changes[WORKFLOW_STATUS_KEY].newValue || null);
    if (changes.enabled) {
      enabled = changes.enabled.newValue === true;
      if (enabled) createPopup();
      else removePopup();
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'REFRESH_RABITOOL_POPUP') {
      sendResponse({ ok: true });
      return true;
    }
    if (message?.action === 'TOGGLE_RABITOOL_POPUP') {
      togglePopup();
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });

  document.addEventListener('keydown', handleShortcut, true);
  window.addEventListener('resize', () => clampPopup(false));
  loadInitialState();
})();
