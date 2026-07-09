// RaBiTool service worker module.
function mergeShortcuts(rawShortcuts = {}) {
  return { ...DEFAULT_SETTINGS.shortcuts, ...(rawShortcuts || {}) };
}

function withDefaultSettings(raw = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...(raw || {}) };
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

function handleInstalled(details = {}) {
  ensureDefaultSettings(() => {
    if (details.reason === 'install' || details.reason === 'update') {
      chrome.runtime.openOptionsPage();
    }
  });
}
