'use strict';

const SETTINGS_KEY = 'rabiToolSettings';
const OPTIONS_POPUP_POS_KEY = 'rabiToolOptionsPopupPosition';
const SHORTCUTS_PAGE_URL = 'chrome://extensions/shortcuts';
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

const toggle = document.getElementById('toggle-enabled');
const toggleSwitch = toggle.closest('.switch');
const shortcutToggleEl = document.getElementById('sc-toggle');
const shortcutListEl = document.getElementById('sc-list');
let optionsPopup = null;
let shortcutRefreshTimer = null;

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
      popup.style.left = `${pos.left}px`;
      popup.style.top = `${pos.top}px`;
    } else {
      const margin = 10;
      const width = popup.offsetWidth || 356;
      const height = popup.offsetHeight || 42;
      popup.style.left = `${Math.max(margin, window.innerWidth - width - margin)}px`;
      popup.style.top = `${Math.max(margin, window.innerHeight - height - margin)}px`;
    }
    clampOptionsPopup();
  });
}

function clampOptionsPopup(save = false) {
  if (!optionsPopup) return;
  const margin = 10;
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
}

function saveEnabled(enabled) {
  setOptionsPopupVisible(!!enabled);
  chrome.storage.local.get(SETTINGS_KEY, (data) => {
    const settings = withDefaultSettings(data?.[SETTINGS_KEY]);
    settings.enabled = !!enabled;
    chrome.storage.local.set({ enabled: !!enabled, [SETTINGS_KEY]: settings });
  });
}

function loadEnabled() {
  chrome.storage.local.get(['enabled', SETTINGS_KEY], (data) => {
    const settings = withDefaultSettings(data?.[SETTINGS_KEY]);
    const enabled = data.enabled !== false && settings.enabled !== false;
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
  if (area !== 'local' || !changes.enabled) return;
  toggle.checked = changes.enabled.newValue !== false;
  setOptionsPopupVisible(changes.enabled.newValue !== false);
});

window.addEventListener('focus', loadShortcut);
window.addEventListener('pageshow', loadShortcut);
window.addEventListener('resize', () => clampOptionsPopup(true));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') loadShortcut();
});

setInterval(() => {
  if (document.visibilityState === 'visible') loadShortcut();
}, 1500);

loadEnabled();
loadShortcut();
