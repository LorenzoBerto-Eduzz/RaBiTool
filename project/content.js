(() => {
  if (window.__rabiToolLoaded) return;
  window.__rabiToolLoaded = true;

  const POPUP_ID = 'rabi-tool-popup';
  const POSITION_KEY = 'rabiToolPopupPosition';
  const SETTINGS_KEY = 'rabiToolSettings';
  const DEFAULT_SETTINGS = {
    enabled: true,
    toolName: 'RaBiTool',
    reclameAquiUrl: '',
    excelWorkbookUrl: '',
    excelWorksheetName: '',
    targetHosts: 'Reclame Aqui; Excel Web',
    notes: '',
    workflow: {
      mode: 'ui-automation',
      importStrategy: 'replace-or-append-rows'
    },
    shortcuts: {
      togglePopup: '',
      openOptions: ''
    }
  };

  let enabled = true;
  let popup = null;
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
    popup.querySelector('#csh-btn-ra')?.addEventListener('click', () => runWorkflowButton('RABITOOL_PREPARE_RA_EXPORT'));
    popup.querySelector('#csh-btn-excel')?.addEventListener('click', () => runWorkflowButton('RABITOOL_PREPARE_EXCEL_IMPORT'));
  }

  function setStatus(text) {
    const status = popup?.querySelector('#csh-status');
    if (status) status.textContent = text;
  }

  async function runWorkflowButton(action) {
    setStatus('Executando...');
    const response = await sendMessage({ action });
    if (!response) {
      setStatus('Nao foi possivel falar com o service worker.');
      return;
    }
    if (response.ok) {
      setStatus(response.reason || `Etapa ${response.stage || 'workflow'} concluida.`);
      return;
    }
    setStatus(response.reason || `Etapa ${response.stage || 'workflow'} ainda nao configurada.`);
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
        popup.style.left = `${pos.left}px`;
        popup.style.top = `${pos.top}px`;
      } else {
        popup.style.left = `${window.innerWidth - 356}px`;
        popup.style.top = `${window.innerHeight - 116}px`;
      }
      popup.style.visibility = 'visible';
      clampPopup();
    });

    bindDragging();
    bindButtons();
  }

  function removePopup() {
    popup?.remove();
    popup = null;
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
      enabled = data.enabled !== false && settings.enabled !== false;
      if (enabled) createPopup();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[SETTINGS_KEY]) settings = withDefaultSettings(changes[SETTINGS_KEY].newValue);
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
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
  window.addEventListener('resize', () => clampPopup(true));
  loadInitialState();
})();
