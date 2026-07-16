'use strict';

const SETTINGS_KEY = 'rabiToolSettings';
const WORKFLOW_STATUS_KEY = 'rabiToolWorkflowStatus';
const OPTIONS_POPUP_POS_KEY = 'rabiToolOptionsPopupPositionTopRightV2';
const LATEST_RELEASE_CACHE_KEY = 'rabiToolLatestReleaseInfoCache';
const EXTENSIONS_PAGE_URL = 'chrome://extensions';
const SHORTCUTS_PAGE_URL = 'chrome://extensions/shortcuts';
const RELEASE_REPO_SLUGS = ['LorenzoBerto-Eduzz/RaBiTool'];
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
  autorun: {
    enabled: false,
    time: '16:00',
    days: [1, 2, 3, 4, 5],
    lateGraceMinutes: 1
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
const autorunCardEl = document.getElementById('autorun-card');
const autorunEnabledEl = document.getElementById('autorun-enabled');
const autorunTimeEl = document.getElementById('autorun-time');
const autorunDaysEl = document.getElementById('autorun-days');
const versionCurrentEl = document.getElementById('version-current');
const versionLatestEl = document.getElementById('version-latest');
const downloadUpdateBtn = document.getElementById('btn-download-update');
const refreshExtensionLink = document.getElementById('link-refresh-extension');
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
let latestReleaseInfo = null;
let optionsSettings = withDefaultSettings();
let loadingAutorun = false;

const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
const DOWNLOAD_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>';
const SEARCH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>';
const SHORTCUT_WARNING_ICON_HTML = '<span class="sc-add-warning" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 21h22L12 3zm1 13h-2v-5h2v5zm0 3h-2v-2h2v2z"/></svg></span>';

function setUpdateButtonState({ text, disabled, icon }) {
  if (!downloadUpdateBtn) return;
  const iconMarkup = icon === 'download' ? DOWNLOAD_ICON : icon === 'search' ? SEARCH_ICON : CHECK_ICON;
  downloadUpdateBtn.innerHTML = `${iconMarkup}<span>${text}</span>`;
  downloadUpdateBtn.disabled = !!disabled;
}

function safeSetLocal(data) {
  try {
    if (!chrome?.storage?.local?.set) return;
    chrome.storage.local.set(data, () => {
      void chrome.runtime?.lastError;
    });
  } catch (_) {}
}

function withDefaultSettings(raw = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...(raw || {}),
    workflow: { ...DEFAULT_SETTINGS.workflow, ...(raw?.workflow || {}) },
    autorun: normalizeAutorunSettings(raw?.autorun),
    shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(raw?.shortcuts || {}) }
  };
}

function normalizeAutorunSettings(raw = {}) {
  const time = String(raw?.time || DEFAULT_SETTINGS.autorun.time || '16:00').trim().replace(/h$/i, '');
  const normalizedTime = /^([01]?\d|2[0-3]):[0-5]\d$/.test(time)
    ? time.replace(/^(\d):/, '0$1:')
    : DEFAULT_SETTINGS.autorun.time;
  const days = Array.isArray(raw?.days) ? raw.days : DEFAULT_SETTINGS.autorun.days;
  return {
    ...DEFAULT_SETTINGS.autorun,
    ...(raw || {}),
    enabled: raw?.enabled === true,
    time: normalizedTime,
    days: [...new Set(days.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b)
  };
}

function formatAutorunTimeInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  const formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return digits.length === 4 ? `${formatted}h` : formatted;
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

function getSelectedAutorunDays() {
  return Array.from(autorunDaysEl?.querySelectorAll('.autorun-day[aria-pressed="true"]') || [])
    .map((button) => Number(button.dataset.day))
    .filter((day) => Number.isInteger(day));
}

function renderAutorunSettings(settings) {
  const autorun = normalizeAutorunSettings(settings?.autorun);
  loadingAutorun = true;
  if (autorunEnabledEl) autorunEnabledEl.checked = autorun.enabled;
  if (autorunTimeEl) autorunTimeEl.value = `${autorun.time}h`;
  autorunDaysEl?.querySelectorAll('.autorun-day').forEach((button) => {
    const day = Number(button.dataset.day);
    button.setAttribute('aria-pressed', autorun.days.includes(day) ? 'true' : 'false');
  });
  autorunCardEl?.classList.add('is-ready');
  loadingAutorun = false;
}

async function saveAutorunSettings() {
  if (loadingAutorun) return;
  const next = withDefaultSettings(optionsSettings);
  next.enabled = toggle.checked === true;
  next.autorun = normalizeAutorunSettings({
    enabled: autorunEnabledEl?.checked === true,
    time: autorunTimeEl?.value || DEFAULT_SETTINGS.autorun.time,
    days: getSelectedAutorunDays()
  });
  optionsSettings = next;
  const response = await sendRuntimeMessage({ action: 'SAVE_RABITOOL_SETTINGS', settings: next });
  if (!response?.ok) {
    setOptionsPopupStatus('Não foi possível salvar a execução automática.', 'error');
  }
}

function optionNoticeIcon(level) {
  if (level === 'error') return '!';
  if (level === 'warn') return '!';
  return 'i';
}

function optionNoticeHash(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

function optionNoticeCodePart(value, fallback = 'LOG') {
  const text = String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
  return (text || fallback).slice(0, 28);
}

function optionNoticeDebugCode(item, scope = 'options') {
  if (item?.code) return String(item.code).trim();
  const level = optionNoticeCodePart(item?.level || 'info', 'INFO').slice(0, 4);
  const stage = optionNoticeCodePart(item?.stage || scope || 'log', 'LOG');
  const text = String(item?.text || '').trim();
  return `RBT-${level}-${stage}-${optionNoticeHash(`${level}|${stage}|${text}`)}`;
}

async function copyOptionsLogText(text, code, item = {}) {
  const parts = [String(text || '').trim()];
  parts.push(`C\u00f3digo: ${code}`);
  const value = parts.filter(Boolean).join(' | ');
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (_) {}

  const area = document.createElement('textarea');
  area.value = value;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  area.style.top = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (_) {
    ok = false;
  }
  area.remove();
  return ok;
}

function uniqueOptionsNotices(notices = []) {
  const seen = new Set();
  const unique = [];
  for (const item of notices) {
    const text = String(item?.text || '').trim();
    if (!text) continue;
    const level = item.level || 'info';
    const stage = item.stage || '';
    const code = optionNoticeDebugCode({ ...item, level, text, stage }, 'notice');
    const key = `${level}:${stage}:${code}:${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...item, level, text, stage, code });
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
      row.dataset.code = item.code || '';
      row.title = item.extensionOverlayPrimaryId
        ? 'Clique para abrir a extensão interferente'
        : 'Clique para copiar o log';
      const icon = document.createElement('span');
      icon.className = 'csh-status-icon';
      icon.textContent = optionNoticeIcon(item.level);
      const text = document.createElement('span');
      text.className = 'csh-status-text';
      text.textContent = String(item.text || '').trim();
      row.addEventListener('click', async () => {
        if (item.extensionOverlayPrimaryId) {
          const opened = await sendRuntimeMessage({
            action: 'OPEN_EXTENSION_DETAILS',
            extensionId: item.extensionOverlayPrimaryId
          });
          if (opened?.ok) return;
        }
        const copied = await copyOptionsLogText(item.text, item.code, item);
        if (!copied) return;
        row.dataset.copied = 'true';
        window.setTimeout(() => {
          if (row.isConnected) delete row.dataset.copied;
        }, 900);
      });
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
    .map((item) => ({
      level: 'warn',
      stage: `workspace-${String(item.kind || item.label || 'tab').toLowerCase()}`,
      text: `${item.label}: ${item.reason}`,
      extensionOverlayPrimaryId: item.extensionOverlayPrimaryId || '',
      extensionOverlayIds: item.extensionOverlayIds || []
    }));
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
  if (!response?.ok) setOptionsPopupStatus(response?.reason || `Não consegui abrir a aba ${label}.`, 'error');
}

function normalizeVersion(version) {
  return String(version || '').trim().replace(/^v/i, '');
}

function compareVersions(a, b) {
  const aParts = normalizeVersion(a).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const bParts = normalizeVersion(b).split('.').map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(aParts.length, bParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (aParts[index] || 0) - (bParts[index] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }

  return 0;
}

function findZipAsset(assets) {
  if (!Array.isArray(assets)) return null;

  const exact = assets.find((asset) => String(asset.name || '').toLowerCase() === 'rabitool.zip');
  if (exact) return exact;

  const namedZip = assets.find((asset) => {
    const name = String(asset.name || '').toLowerCase();
    return name.includes('rabitool') && name.endsWith('.zip');
  });
  if (namedZip) return namedZip;

  return assets.find((asset) => String(asset.name || '').toLowerCase().endsWith('.zip')) || null;
}

function parseReleasePayload(payload) {
  const zipAsset = findZipAsset(payload?.assets);
  return {
    version: normalizeVersion(payload?.tag_name),
    assetUrl: zipAsset ? zipAsset.browser_download_url : '',
    assetName: zipAsset ? zipAsset.name : 'RaBiTool.zip',
    releasePageUrl: payload?.html_url || 'https://github.com/LorenzoBerto-Eduzz/RaBiTool/releases'
  };
}

async function fetchJsonWithTimeout(url, timeoutMs = 4500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Falha ao verificar release (${response.status})`);
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchLatestReleaseFromRepo(repoSlug) {
  try {
    const latestPayload = await fetchJsonWithTimeout(`https://api.github.com/repos/${repoSlug}/releases/latest`);
    return parseReleasePayload(latestPayload);
  } catch (latestError) {
    const listPayload = await fetchJsonWithTimeout(`https://api.github.com/repos/${repoSlug}/releases?per_page=1`);
    const release = Array.isArray(listPayload) ? listPayload[0] : null;
    if (!release) throw latestError;
    return parseReleasePayload(release);
  }
}

async function fetchLatestRelease() {
  return Promise.any(RELEASE_REPO_SLUGS.map((repoSlug) => fetchLatestReleaseFromRepo(repoSlug)));
}

function getLocalValue(key) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(key, (data) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(data?.[key] || null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

async function loadCachedLatestRelease() {
  const cached = await getLocalValue(LATEST_RELEASE_CACHE_KEY);
  if (!cached?.version) return null;
  return cached;
}

function rememberLatestRelease(info) {
  if (!info?.version) return;
  safeSetLocal({ [LATEST_RELEASE_CACHE_KEY]: { ...info, cachedAt: Date.now() } });
}

function applyVersionState(currentVersion, releaseInfo, { fromCache = false } = {}) {
  latestReleaseInfo = releaseInfo;
  if (versionLatestEl) versionLatestEl.textContent = releaseInfo.version || 'Indisponível';

  if (!releaseInfo.version) {
    setUpdateButtonState({ text: 'Não foi possível verificar versões', disabled: true, icon: 'search' });
    return;
  }

  const versionComparison = compareVersions(currentVersion, releaseInfo.version);
  if (versionComparison === 0) {
    setUpdateButtonState({ text: fromCache ? 'Confirmando versão...' : 'Versão mais recente em uso', disabled: true, icon: 'check' });
    return;
  }

  if (!releaseInfo.assetUrl) {
    setUpdateButtonState({ text: 'Versão encontrada sem pacote', disabled: true, icon: 'search' });
    return;
  }

  setUpdateButtonState({
    text: fromCache ? 'Verificando versão mais recente' : 'Baixar versão mais recente no GitHub',
    disabled: !!fromCache,
    icon: fromCache ? 'search' : 'download'
  });
}

async function checkVersionAndUpdateState() {
  if (!versionCurrentEl || !versionLatestEl || !downloadUpdateBtn) return;
  const currentVersion = normalizeVersion(chrome.runtime.getManifest().version);
  versionCurrentEl.textContent = currentVersion;
  versionLatestEl.textContent = 'Verificando...';
  setUpdateButtonState({ text: 'Pesquisando versões', disabled: true, icon: 'search' });

  const cachedRelease = await loadCachedLatestRelease();
  if (cachedRelease?.version) {
    applyVersionState(currentVersion, cachedRelease, { fromCache: true });
  }

  try {
    const releaseInfo = await fetchLatestRelease();
    rememberLatestRelease(releaseInfo);
    applyVersionState(currentVersion, releaseInfo);
  } catch (error) {
    console.error('Version check failed:', error);
    if (latestReleaseInfo?.version) {
      applyVersionState(currentVersion, latestReleaseInfo);
      return;
    }
    versionLatestEl.textContent = 'Indisponível';
    setUpdateButtonState({ text: 'Não foi possível verificar versões', disabled: true, icon: 'search' });
  }
}

function closeOptionsTab() {
  chrome.tabs.getCurrent((tab) => {
    if (tab && typeof tab.id === 'number') {
      chrome.tabs.remove(tab.id);
      return;
    }
    window.close();
  });
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
    setOptionsPopupStatus('Não foi possível falar com o service worker.', 'error');
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
    setOptionsPopupStatus('Não foi possível atualizar o estado da extensão.', 'error');
  }
}

function loadEnabled() {
  chrome.storage.local.get(['enabled', SETTINGS_KEY], (data) => {
    const settings = withDefaultSettings(data?.[SETTINGS_KEY]);
    optionsSettings = settings;
    renderAutorunSettings(settings);
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
autorunEnabledEl?.addEventListener('change', saveAutorunSettings);
autorunTimeEl?.addEventListener('input', () => {
  const formatted = formatAutorunTimeInput(autorunTimeEl.value);
  if (autorunTimeEl.value !== formatted) autorunTimeEl.value = formatted;
});
autorunTimeEl?.addEventListener('change', saveAutorunSettings);
autorunTimeEl?.addEventListener('blur', () => {
  const normalized = normalizeAutorunSettings({ time: autorunTimeEl.value }).time;
  autorunTimeEl.value = `${normalized}h`;
  saveAutorunSettings();
});
autorunDaysEl?.addEventListener('click', (event) => {
  const button = event.target.closest('.autorun-day');
  if (!button) return;
  const pressed = button.getAttribute('aria-pressed') === 'true';
  button.setAttribute('aria-pressed', pressed ? 'false' : 'true');
  saveAutorunSettings();
});
shortcutListEl?.addEventListener('click', (event) => {
  const shortcutButton = event.target.closest('.sc-key-btn');
  if (!shortcutButton) return;
  openShortcutSettings();
});

refreshExtensionLink?.addEventListener('click', (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: EXTENSIONS_PAGE_URL });
});

downloadUpdateBtn?.addEventListener('click', () => {
  if (!latestReleaseInfo?.assetUrl) return;

  setUpdateButtonState({ text: 'Baixando versão mais recente...', disabled: true, icon: 'download' });
  chrome.downloads.download(
    {
      url: latestReleaseInfo.assetUrl,
      filename: latestReleaseInfo.assetName || 'RaBiTool.zip',
      saveAs: false,
      conflictAction: 'uniquify'
    },
    (downloadId) => {
      if (chrome.runtime.lastError || !downloadId) {
        console.error('Download failed:', chrome.runtime.lastError);
        setUpdateButtonState({ text: 'Baixar versão mais recente no GitHub', disabled: false, icon: 'download' });
        return;
      }

      chrome.downloads.show(downloadId);
      chrome.tabs.create({ url: EXTENSIONS_PAGE_URL });
      setUpdateButtonState({ text: 'Baixar versão mais recente no GitHub', disabled: false, icon: 'download' });
      closeOptionsTab();
    }
  );
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled) {
    toggle.checked = changes.enabled.newValue === true;
    setOptionsPopupVisible(changes.enabled.newValue === true);
  }
  if (changes[SETTINGS_KEY]) {
    optionsSettings = withDefaultSettings(changes[SETTINGS_KEY].newValue);
    renderAutorunSettings(optionsSettings);
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
checkVersionAndUpdateState();
startOptionsWorkspaceRefresh();
refreshOptionsWorkflowStatus();
