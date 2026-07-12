// RaBiTool service worker module.
function mergeShortcuts(rawShortcuts = {}) {
  return { ...DEFAULT_SETTINGS.shortcuts, ...(rawShortcuts || {}) };
}

function withDefaultSettings(raw = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  merged.workflow = { ...DEFAULT_SETTINGS.workflow, ...(raw?.workflow || {}) };
  merged.shortcuts = mergeShortcuts(raw?.shortcuts);
  return merged;
}

function ensureDefaultSettings(callback) {
  chrome.storage.local.get([SETTINGS_KEY, 'enabled'], (data) => {
    const settings = withDefaultSettings(data[SETTINGS_KEY]);
    const patch = { [SETTINGS_KEY]: settings };
    if (typeof data.enabled !== 'boolean') patch.enabled = settings.enabled !== false;
    chrome.storage.local.set(patch, () => callback?.());
  });
}

function setStartupDisabled(callback) {
  chrome.storage.local.get(SETTINGS_KEY, (data) => {
    const settings = withDefaultSettings(data?.[SETTINGS_KEY]);
    settings.enabled = false;
    chrome.storage.local.set({ enabled: false, [SETTINGS_KEY]: settings }, () => callback?.());
  });
}

function handleInstalled(details = {}) {
  setStartupDisabled(() => {
    if (details.reason === 'install' || details.reason === 'update') {
      chrome.storage.local.set({ [WORKSPACE_REFRESH_MARK_KEY]: new Date().toISOString() });
    }
    if (details.reason === 'install' || details.reason === 'update') {
      chrome.runtime.openOptionsPage();
    }
  });
}
