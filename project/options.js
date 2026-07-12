'use strict';

const SETTINGS_KEY = 'rabiToolSettings';
const WORKFLOW_STATUS_KEY = 'rabiToolWorkflowStatus';
const OPTIONS_POPUP_POS_KEY = 'rabiToolOptionsPopupPositionTopRightV2';
const SHORTCUTS_PAGE_URL = 'chrome://extensions/shortcuts';
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

const toggle = document.getElementById('toggle-enabled');
const toggleSwitch = toggle.closest('.switch');
const shortcutToggleEl = document.getElementById('sc-toggle');
const shortcutListEl = document.getElementById('sc-list');
let optionsPopup = null;
let optionsPopupAnchoredTopRight = false;
let shortcutRefreshTimer = null;
let workspaceRefreshTimer = null;
let optionsWorkflowRunning = false;
let lastOptionsWorkflowStatus = null;
let lastOptionsWorkspaceStatus = null;
let lastOptionsWorkspaceRenderSignature = '';
let lastOptionsRenderedNoticesSignature = '';
let lastOptionsProgressSignature = '';

const SHORTCUT_WARNING_ICON_HTML = '<span class="sc-add-warning" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 21h22L12 3zm1 13h-2v-5h2v5zm0 3h-2v-2h2v2z"/></svg></span>';

function withDefaultSettings(raw = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...(raw || {}),
    workflow: { ...DEFAULT_SETTINGS.workflow, ...(raw?.workflow || {}) },
    shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(raw?.shortcuts || {}) }
  };
}

function openShortcutSettings() {
  chrome.tabs.create({ url: SHORTCUTS_PAGE_URL });
  scheduleShortcutRefresh();
}

function renderShortcutButton(el, shortcut, { warn = false } = {}) {
  if (!el) return;
  const normalized = String(shortcut || '').trim();

  if (!normalized) {
    const warning = warn ? SHORTCUT_WARNING_ICON_HTML : '';
    el.innerHTML = `${warning}<button type="button" class="sc-key-btn is-empty"><span class="sc-add-label">Adicionar</span></button>`;
    return;
  }

  const parts = normalized.split('+').map((part) => part.trim()).filter(Boolean);
  el.innerHTML = `<button type="button" class="sc-key-btn" title="Editar atalho">${parts.map((part, index) => (
    `<kbd>${part}</kbd>${index < parts.length - 1 ? '<span class="plus">+</span>' : ''}`
  )).join('')}</button>`;
}

function loadShortcut() {
  if (!chrome.commands?.getAll) {
    renderShortcutButton(shortcutToggleEl, '', { warn: true });
    return;
  }
  chrome.commands.getAll((commands) => {
    const toggleCommand = commands.find((command) => command.name === '_execute_action') ||
      commands.find((command) => command.description === 'Toggle RaBiTool') ||
      commands.find((command) => command.shortcut);
    renderShortcutButton(shortcutToggleEl, toggleCommand?.shortcut || '', { warn: true });
  });
}

function scheduleShortcutRefresh() {
  clearTimeout(shortcutRefreshTimer);
  shortcutRefreshTimer = setTimeout(loadShortcut, 700);
}

function ensureOptionsPopup() {
  if (optionsPopup && optionsPopup.isConnected) return optionsPopup;

  const existing = document.getElementById('rabi-tool-popup');
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = 'rabi-tool-options-preview-styles';
  style.textContent = window.RaBiToolUI?.getStyle?.() || '';
  document.head.appendChild(style);

  optionsPopup = document.createElement('div');
  optionsPopup.id = 'rabi-tool-popup';
  optionsPopup.setAttribute('aria-hidden', 'true');
  optionsPopup.innerHTML = window.RaBiToolUI?.getMarkup?.() || '';
  document.body.appendChild(optionsPopup);
  optionsPopup.style.visibility = 'visible';
  lastOptionsWorkspaceRenderSignature = '';
  lastOptionsRenderedNoticesSignature = '';
  lastOptionsProgressSignature = '';

  bindOptionsPopupDragging();
  bindOptionsPopupButtons();
  placeOptionsPopup();
  return optionsPopup;
}

function setOptionsPopupVisible(visible) {
  const popup = ensureOptionsPopup();
  popup.style.display = visible ? 'flex' : 'none';
  popup.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function placeOptionsPopup() {
  const popup = ensureOptionsPopup();
  chrome.storage.local.get(OPTIONS_POPUP_POS_KEY, (data) => {
    const pos = data?.[OPTIONS_POPUP_POS_KEY];
    if (pos && Number.isFinite(pos.left) && Number.isFinite(pos.top)) {
      optionsPopupAnchoredTopRight = false;
      popup.style.left = `${pos.left}px`;
      popup.style.top = `${pos.top}px`;
      popup.style.right = 'auto';
      popup.style.bottom = 'auto';
    } else {
      const margin = 10;
      optionsPopupAnchoredTopRight = true;
      popup.style.left = 'auto';
      popup.style.right = `${margin}px`;
      popup.style.top = `${margin}px`;
      popup.style.bottom = 'auto';
    }
    clampOptionsPopup();
  });
}

function clampOptionsPopup(save = false) {
  if (!optionsPopup) return;
  const margin = 10;
  if (optionsPopupAnchoredTopRight) {
    optionsPopup.style.left = 'auto';
    optionsPopup.style.right = `${margin}px`;
    optionsPopup.style.top = `${margin}px`;
    optionsPopup.style.bottom = 'auto';
    return;
  }
  const rect = optionsPopup.getBoundingClientRect();
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - rect.width - margin));
  const top = Math.max(margin, Math.min(rect.top, window.innerHeight - rect.height - margin));
  optionsPopup.style.left = `${left}px`;
  optionsPopup.style.top = `${top}px`;
  optionsPopup.style.right = 'auto';
  optionsPopup.style.bottom = 'auto';
  if (save) chrome.storage.local.set({ [OPTIONS_POPUP_POS_KEY]: { left, top } });
}

function bindOptionsPopupDragging() {
  const popup = optionsPopup;
  const handle = popup?.querySelector('.csh-drag-handle');
  if (!popup || !handle) return;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  handle.addEventListener('mousedown', (event) => {
    event.preventDefault();
    dragging = true;
    const rect = popup.getBoundingClientRect();
    optionsPopupAnchoredTopRight = false;
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
    clampOptionsPopup(true);
  });
}

function bindOptionsPopupButtons() {
  optionsPopup?.querySelector('#csh-btn-close')?.addEventListener('click', () => {
    toggle.checked = false;
    saveEnabled(false);
  });

  optionsPopup?.querySelector('#csh-btn-gear')?.addEventListener('click', () => {
    window.focus();
  });

  optionsPopup?.querySelector('#csh-btn-run')?.addEventListener('click', () => {
    runOptionsWorkflowButton('RABITOOL_START_RA_TO_EXCEL', 'Verificando abas...');
  });
  optionsPopup?.querySelector('#csh-btn-tab-ra')?.addEventListener('click', () => focusOptionsWorkspaceTab('ra'));
  optionsPopup?.querySelector('#csh-btn-tab-bi')?.addEventListener('click', () => focusOptionsWorkspaceTab('bi'));
}

function sendRuntimeMessage(message) {
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

function optionNoticeIcon(level) {
  if (level === 'error') return '!';
  if (level === 'warn') return '!';
  return 'i';
}

function uniqueOptionsNotices(notices = []) {
  const seen = new Set();
  const unique = [];
  for (const item of notices) {
    const text = String(item?.text || '').trim();
    if (!text) continue;
    const level = item.level || 'info';
    const key = `${level}:${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ level, text });
  }
  return unique;
}

function optionsNoticeSignature(notices = []) {
  return JSON.stringify(uniqueOptionsNotices(notices));
}

function setOptionsPopupNotices(notices = []) {
  const status = optionsPopup?.querySelector('#csh-status');
  if (!status) return;
  const signature = optionsNoticeSignature(notices);
  if (signature === lastOptionsRenderedNoticesSignature) return;
  lastOptionsRenderedNoticesSignature = signature;
  status.textContent = '';
  uniqueOptionsNotices(notices)
    .forEach((item) => {
      const row = document.createElement('div');
      row.className = 'csh-status-item';
      row.dataset.level = item.level || 'info';
      const icon = document.createElement('span');
      icon.className = 'csh-status-icon';
      icon.textContent = optionNoticeIcon(item.level);
      const text = document.createElement('span');
      text.textContent = String(item.text || '').trim();
      row.append(icon, text);
      status.appendChild(row);
    });
}

function setOptionsPopupStatus(text, level = 'info') {
  setOptionsPopupNotices(text ? [{ level, text }] : []);
}

function setOptionsPopupProgress(active, text = '') {
  const progress = optionsPopup?.querySelector('#csh-progress');
  const progressText = optionsPopup?.querySelector('#csh-progress-text');
  const buttons = optionsPopup?.querySelectorAll('.csh-run-btn') || [];
  const nextText = text || 'Aguardando...';
  const signature = JSON.stringify({ active: !!active, text: nextText });
  if (signature === lastOptionsProgressSignature) return;
  lastOptionsProgressSignature = signature;
  if (progress) progress.hidden = !active;
  if (progressText) progressText.textContent = nextText;
  buttons.forEach((button) => {
    button.disabled = !!active;
    button.dataset.running = active ? 'true' : 'false';
  });
}

function setOptionsWorkspaceButton(kind, info = {}) {
  const button = optionsPopup?.querySelector(`#csh-btn-tab-${kind}`);
  const icon = optionsPopup?.querySelector(`.csh-tab-icon[data-kind="${kind}"]`);
  if (!button || !icon) return;
  const state = info.state || 'unknown';
  const nextState = state === 'unknown' ? 'checking' : state;
  const nextTitle = info.reason || (state === 'ready' ? 'Pronto' : 'Verificando');
  if (button.dataset.state !== nextState) button.dataset.state = nextState;
  if (button.title !== nextTitle) button.title = nextTitle;
  if (icon.textContent) icon.textContent = '';
}

function optionsWorkspaceNotices(status) {
  return [status?.ra, status?.bi]
    .filter((item) => item && item.state === 'error')
    .map((item) => ({ level: 'warn', text: `${item.label}: ${item.reason}` }));
}

function optionsWorkflowNotices(status) {
  const notices = Array.isArray(status?.notices) ? status.notices : [];
  if (!notices.length) return [];
  const specificWorkspaceNotices = optionsWorkspaceNotices(lastOptionsWorkspaceStatus);
  const workspaceReady = [lastOptionsWorkspaceStatus?.ra, lastOptionsWorkspaceStatus?.bi]
    .every((item) => item?.state === 'ready');
  return notices.filter((item) => {
    if (item?.stage !== 'tabs') return true;
    return !workspaceReady && !specificWorkspaceNotices.length;
  });
}

function renderOptionsCombinedNotices() {
  if (!optionsPopup) return;
  setOptionsPopupNotices([
    ...optionsWorkspaceNotices(lastOptionsWorkspaceStatus),
    ...optionsWorkflowNotices(lastOptionsWorkflowStatus)
  ]);
}

function renderOptionsWorkspaceStatus(status) {
  lastOptionsWorkspaceStatus = status || null;
  setOptionsWorkspaceButton('ra', status?.ra);
  setOptionsWorkspaceButton('bi', status?.bi);
  renderOptionsCombinedNotices();
}

function optionsWorkspaceStatusSignature(status) {
  return JSON.stringify({
    ra: status?.ra ? {
      state: status.ra.state || '',
      reason: status.ra.reason || '',
      tabId: status.ra.tabId || null
    } : null,
    bi: status?.bi ? {
      state: status.bi.state || '',
      reason: status.bi.reason || '',
      tabId: status.bi.tabId || null
    } : null
  });
}

async function refreshOptionsWorkspaceStatus() {
  if (!optionsPopup || optionsPopup.style.display === 'none') return;
  const status = await sendRuntimeMessage({ action: 'GET_WORKSPACE_STATUS' });
  if (!status?.ok) return;
  const signature = optionsWorkspaceStatusSignature(status);
  if (signature === lastOptionsWorkspaceRenderSignature) return;
  lastOptionsWorkspaceRenderSignature = signature;
  renderOptionsWorkspaceStatus(status);
}

function startOptionsWorkspaceRefresh() {
  clearInterval(workspaceRefreshTimer);
  refreshOptionsWorkspaceStatus();
  workspaceRefreshTimer = setInterval(refreshOptionsWorkspaceStatus, 2000);
}

async function focusOptionsWorkspaceTab(kind) {
  const response = await sendRuntimeMessage({ action: 'FOCUS_WORKSPACE_TAB', kind });
  const label = kind === 'ra' ? 'HugMe' : 'Planilha';
  if (!response?.ok) setOptionsPopupStatus(response?.reason || `Nao consegui abrir a aba ${label}.`, 'error');
}

function renderOptionsWorkflowStatus(status) {
  lastOptionsWorkflowStatus = status || null;
  if (!optionsPopup) return;
  const active = !!status?.running || !!status?.activeText;
  setOptionsPopupProgress(active, status?.activeText || '');
  optionsWorkflowRunning = !!status?.running;
  renderOptionsCombinedNotices();
}

function refreshOptionsWorkflowStatus() {
  chrome.storage.local.get(WORKFLOW_STATUS_KEY, (data) => {
    renderOptionsWorkflowStatus(data?.[WORKFLOW_STATUS_KEY] || null);
  });
}

async function runOptionsWorkflowButton(action, activeText = 'Verificando abas...') {
  optionsWorkflowRunning = true;
  setOptionsPopupProgress(true, activeText);
  setOptionsPopupNotices([]);
  const response = await sendRuntimeMessage({ action });
  refreshOptionsWorkflowStatus();
  if (!response) {
    optionsWorkflowRunning = false;
    setOptionsPopupProgress(false);
    setOptionsPopupStatus('Nao foi possivel falar com o service worker.', 'error');
    return;
  }
}

async function saveEnabled(enabled) {
  const nextEnabled = !!enabled;
  setOptionsPopupVisible(nextEnabled);
  if (nextEnabled) {
    requestAnimationFrame(() => {
      optionsPopup?.querySelector('#csh-btn-run')?.focus({ preventScroll: true });
    });
  }
  const response = await sendRuntimeMessage({ action: 'SET_ENABLED', enabled: nextEnabled });
  if (!response?.ok) {
    toggle.checked = !nextEnabled;
    setOptionsPopupVisible(!nextEnabled);
    setOptionsPopupStatus('Nao foi possivel atualizar o estado da extensao.', 'error');
  }
}

function loadEnabled() {
  chrome.storage.local.get(['enabled', SETTINGS_KEY], (data) => {
    const settings = withDefaultSettings(data?.[SETTINGS_KEY]);
    const enabled = data.enabled === true && settings.enabled !== false;
    toggle.checked = enabled;
    setOptionsPopupVisible(enabled);
    toggleSwitch.classList.add('is-ready');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => document.body.classList.remove('no-toggle-anim'));
    });
  });
}

toggle.addEventListener('change', () => saveEnabled(toggle.checked));
shortcutListEl?.addEventListener('click', (event) => {
  const shortcutButton = event.target.closest('.sc-key-btn');
  if (!shortcutButton) return;
  openShortcutSettings();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled) {
    toggle.checked = changes.enabled.newValue === true;
    setOptionsPopupVisible(changes.enabled.newValue === true);
  }
  if (changes[WORKFLOW_STATUS_KEY]) renderOptionsWorkflowStatus(changes[WORKFLOW_STATUS_KEY].newValue || null);
});

window.addEventListener('focus', loadShortcut);
window.addEventListener('pageshow', loadShortcut);
window.addEventListener('resize', () => clampOptionsPopup(false));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') loadShortcut();
});

setInterval(() => {
  if (document.visibilityState === 'visible') loadShortcut();
}, 1500);

loadEnabled();
loadShortcut();
startOptionsWorkspaceRefresh();
refreshOptionsWorkflowStatus();
