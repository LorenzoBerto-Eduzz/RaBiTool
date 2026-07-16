// Workspace tab launch/tracking for RA and BI pages.
const WORKSPACE_RETURN_COOLDOWN_MS = 5000;
const WORKSPACE_GROUP_TITLE = 'RaBiTool';
const WORKSPACE_GROUP_COLOR = 'green';

const WORKSPACE_TAB_DEFS = {
  ra: {
    label: 'HugMe',
    url: 'https://app.hugme.com.br/app.html#/dados/tickets/exportar/',
    readyUrlPart: 'app.hugme.com.br/app.html#/dados/tickets/exportar',
    loginHints: ['login', 'signin', 'entrar', 'auth', 'sso', 'oauth', 'account', 'conta']
  },
  bi: {
    label: 'Planilha',
    url: 'https://eduzz.sharepoint.com/:x:/s/BI/IQD6u3ZLO0KJTLwdN11bRG8ZAS5Nj2f5Nry7-F5WpL1iDnE?e=qQorVa',
    readyUrlParts: ['eduzz.sharepoint.com', 'excel.officeapps.live.com', 'officeapps.live.com'],
    loginHints: ['login.microsoftonline.com', 'signin', 'accessdenied', 'acesso negado', 'permission', 'permissao', 'permissão', 'requestaccess', 'solicitaracesso']
  }
};

function normalizeWorkspaceUrl(url) {
  return String(url || '').trim().toLowerCase();
}

function normalizeHint(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function getWorkspaceKindByTabId(tracked, tabId) {
  return Object.keys(WORKSPACE_TAB_DEFS).find((kind) => tracked?.[kind]?.tabId === tabId) || '';
}

function isWorkspaceTargetUrl(kind, url) {
  const def = WORKSPACE_TAB_DEFS[kind];
  const normalized = normalizeWorkspaceUrl(url);
  if (!def || !normalized) return false;
  if (kind === 'ra') return normalized.includes(def.readyUrlPart);
  return normalized.includes('iqd6u3zlo0kjtlwdn11brg8zas5nj2f5nry7-f5wpL1idne'.toLowerCase()) ||
    normalized.includes('excel.officeapps.live.com') ||
    normalized.includes('officeapps.live.com');
}

function isWorkspaceLoginUrl(kind, url) {
  const def = WORKSPACE_TAB_DEFS[kind];
  const normalized = normalizeWorkspaceUrl(url);
  const compact = normalizeHint(normalized);
  if (!def || !normalized) return false;
  return def.loginHints.some((hint) => compact.includes(normalizeHint(hint))) ||
    /login|signin|oauth|auth|sso/.test(compact);
}

function markWorkspaceEntry(entry, patch = {}) {
  return {
    ...(entry || {}),
    ...patch,
    updatedAt: new Date().toISOString()
  };
}

function getWorkspaceTabs() {
  return new Promise((resolve) => {
    chrome.storage.local.get(WORKSPACE_TABS_KEY, (data) => resolve(data?.[WORKSPACE_TABS_KEY] || {}));
  });
}

function setWorkspaceTabs(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [WORKSPACE_TABS_KEY]: value || {} }, () => resolve(!chrome.runtime.lastError));
  });
}

function removeChromeTabs(tabIds) {
  const ids = [...new Set((tabIds || []).filter((id) => Number.isInteger(id)))];
  if (!ids.length) return Promise.resolve({ ok: true, removedTabIds: [] });
  return new Promise((resolve) => {
    chrome.tabs.remove(ids, () => {
      resolve({
        ok: !chrome.runtime.lastError,
        removedTabIds: ids,
        reason: chrome.runtime.lastError?.message || ''
      });
    });
  });
}

async function closeTrackedWorkspaceTabs() {
  const tracked = await getWorkspaceTabs();
  const tabIds = [tracked?.ra?.tabId, tracked?.bi?.tabId].filter((id) => Number.isInteger(id));
  const removed = await removeChromeTabs(tabIds);
  await setWorkspaceTabs({});
  return {
    ok: removed.ok,
    stage: 'workspace-close',
    removedTabIds: removed.removedTabIds || tabIds,
    reason: removed.reason || ''
  };
}

function getWorkspaceRefreshMark() {
  return new Promise((resolve) => {
    chrome.storage.local.get(WORKSPACE_REFRESH_MARK_KEY, (data) => {
      resolve(String(data?.[WORKSPACE_REFRESH_MARK_KEY] || ''));
    });
  });
}

async function getLiveWorkspaceTab(kind, tracked) {
  const id = tracked?.[kind]?.tabId;
  if (!Number.isInteger(id)) return null;
  const tab = await getTab(id);
  if (!tab) return null;
  return tab;
}

function createInactiveSideTab(url, openerTab, offset) {
  return new Promise((resolve) => {
    const props = { url, active: false };
    if (Number.isInteger(openerTab?.id)) props.openerTabId = openerTab.id;
    if (Number.isInteger(openerTab?.index)) props.index = openerTab.index + offset;
    chrome.tabs.create(props, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        resolve({ ok: false, reason: chrome.runtime.lastError?.message || 'Não consegui abrir a aba.' });
        return;
      }
      resolve({ ok: true, tab });
    });
  });
}

async function groupWorkspaceTabs(tabs) {
  const tabIds = (tabs || [])
    .map((tab) => tab?.id)
    .filter((id) => Number.isInteger(id));
  if (tabIds.length < 2 || !chrome.tabs?.group || !chrome.tabGroups?.update) {
    return { ok: false, skipped: true };
  }

  return new Promise((resolve) => {
    chrome.tabs.group({ tabIds }, (groupId) => {
      if (chrome.runtime.lastError || !Number.isInteger(groupId)) {
        resolve({ ok: false, reason: chrome.runtime.lastError?.message || 'Não consegui agrupar as abas RaBiTool.' });
        return;
      }
      chrome.tabGroups.update(groupId, {
        title: WORKSPACE_GROUP_TITLE,
        color: WORKSPACE_GROUP_COLOR,
        collapsed: false
      }, () => {
        resolve(chrome.runtime.lastError
          ? { ok: false, groupId, reason: chrome.runtime.lastError.message }
          : { ok: true, groupId });
      });
    });
  });
}

async function getLiveWorkspaceTabsFromCurrentGroup(tracked, mark) {
  if (!mark || tracked?.groupCreatedForMark !== mark || !Number.isInteger(tracked?.groupId)) {
    return {};
  }

  const [raTab, biTab] = await Promise.all([
    getLiveWorkspaceTab('ra', tracked),
    getLiveWorkspaceTab('bi', tracked)
  ]);
  const tabs = {};
  if (raTab && raTab.groupId === tracked.groupId) tabs.ra = raTab;
  if (biTab && biTab.groupId === tracked.groupId) tabs.bi = biTab;
  return tabs;
}

async function refreshWorkspaceTabIfNeeded(kind, tab, tracked) {
  const mark = await getWorkspaceRefreshMark();
  if (!mark || !tab?.id) return { tab, refreshed: false };

  const entry = tracked[kind] || {};
  if (entry.refreshedForMark === mark) return { tab, refreshed: false };
  if (!isWorkspaceTargetUrl(kind, tab.url)) return { tab, refreshed: false };

  tracked[kind] = markWorkspaceEntry(entry, {
    tabId: tab.id,
    url: tab.url || '',
    status: 'loading',
    refreshedForMark: mark,
    refreshedAfterExtensionLoadAt: new Date().toISOString()
  });
  await setWorkspaceTabs(tracked);

  await new Promise((resolve) => {
    chrome.tabs.reload(tab.id, {}, () => resolve(!chrome.runtime.lastError));
  });

  return { tab: await getTab(tab.id) || tab, refreshed: true };
}

async function ensureWorkspaceTab(kind, openerTab, offset, options = {}) {
  const tracked = await getWorkspaceTabs();
  const refreshMark = await getWorkspaceRefreshMark();
  const groupedTabs = await getLiveWorkspaceTabsFromCurrentGroup(tracked, refreshMark);
  const liveTracked = options.forceNew ? (groupedTabs[kind] || null) : (groupedTabs[kind] || await getLiveWorkspaceTab(kind, tracked));
  if (liveTracked) {
    const refreshed = await refreshWorkspaceTabIfNeeded(kind, liveTracked, tracked);
    return { ok: true, tab: refreshed.tab, reused: true, refreshed: refreshed.refreshed };
  }

  const created = await createInactiveSideTab(WORKSPACE_TAB_DEFS[kind].url, openerTab, offset);
  if (!created.ok) return created;
  tracked[kind] = markWorkspaceEntry(tracked[kind], {
    tabId: created.tab.id,
    url: created.tab.url || '',
    openedAt: new Date().toISOString(),
    reservedForRaBiTool: true,
    createdFresh: true,
    createdForMark: refreshMark,
    refreshedForMark: refreshMark,
    returnAfterAuth: false,
    authDetected: false
  });
  await setWorkspaceTabs(tracked);
  return { ok: true, tab: created.tab, reused: false };
}

async function handleWorkspaceTabUpdated(tabId, _changeInfo, tab) {
  const tracked = await getWorkspaceTabs();
  const kind = getWorkspaceKindByTabId(tracked, tabId);
  if (!kind) return;

  const def = WORKSPACE_TAB_DEFS[kind];
  const entry = tracked[kind] || {};
  const url = tab?.url || entry.url || '';
  const status = tab?.status || entry.status || '';
  const now = Date.now();
  const loginUrl = isWorkspaceLoginUrl(kind, url);
  const targetUrl = isWorkspaceTargetUrl(kind, url);
  let patch = {
    url,
    status,
    lastSeenAt: new Date().toISOString()
  };

  if (loginUrl) {
    patch = {
      ...patch,
      authDetected: true,
      returnAfterAuth: true,
      authDetectedAt: entry.authDetectedAt || new Date().toISOString()
    };
  }

  if (targetUrl) {
    patch = {
      ...patch,
      authDetected: false,
      returnAfterAuth: false,
      returningToTarget: false
    };
  }

  tracked[kind] = markWorkspaceEntry(entry, patch);
  await setWorkspaceTabs(tracked);

  const updatedEntry = tracked[kind];
  const cooldownOk = !updatedEntry.lastAutoReturnAt || now - updatedEntry.lastAutoReturnAt > WORKSPACE_RETURN_COOLDOWN_MS;
  if (updatedEntry.returnAfterAuth && status === 'complete' && cooldownOk && !loginUrl && !targetUrl) {
    updatedEntry.lastAutoReturnAt = now;
    updatedEntry.returningToTarget = true;
    updatedEntry.status = 'loading';
    updatedEntry.url = def.url;
    tracked[kind] = markWorkspaceEntry(updatedEntry);
    await setWorkspaceTabs(tracked);
    chrome.tabs.update(tabId, { url: def.url });
  }
}

async function handleWorkspaceTabRemoved(tabId) {
  const tracked = await getWorkspaceTabs();
  const kind = getWorkspaceKindByTabId(tracked, tabId);
  if (!kind) return;
  tracked[kind] = markWorkspaceEntry(tracked[kind], {
    closed: true,
    closedAt: new Date().toISOString()
  });
  await setWorkspaceTabs(tracked);
}

async function ensureWorkspaceTabs(openerTab, options = {}) {
  const ra = await ensureWorkspaceTab('ra', openerTab, 1, options);
  const bi = await ensureWorkspaceTab('bi', openerTab, 2, options);
  const group = ra.ok && bi.ok ? await groupWorkspaceTabs([ra.tab, bi.tab]) : { ok: false, skipped: true };
  if (group.ok) {
    const tracked = await getWorkspaceTabs();
    const refreshMark = await getWorkspaceRefreshMark();
    tracked.groupId = group.groupId;
    tracked.groupTitle = WORKSPACE_GROUP_TITLE;
    tracked.groupColor = WORKSPACE_GROUP_COLOR;
    tracked.groupCreatedForMark = refreshMark;
    tracked.groupUpdatedAt = new Date().toISOString();
    await setWorkspaceTabs(tracked);
  }
  return {
    ok: !!ra.ok && !!bi.ok,
    stage: 'workspace-tabs',
    ra: ra.ok ? { tabId: ra.tab.id, reused: !!ra.reused, refreshed: !!ra.refreshed } : { error: ra.reason },
    bi: bi.ok ? { tabId: bi.tab.id, reused: !!bi.reused, refreshed: !!bi.refreshed } : { error: bi.reason },
    group,
    reason: !ra.ok || !bi.ok ? 'Não consegui abrir/rastrear as abas HugMe e Planilha.' : ''
  };
}

function inspectWorkspacePage(kind) {
  const text = `${document.title || ''}\n${document.body?.innerText || ''}`.toLowerCase();
  const url = String(location.href || '').toLowerCase();
  if (kind === 'ra') {
    const exportReady = text.includes('gerar relat') || text.includes('meus relat') ||
      !!document.querySelector('select.empresa, input.titulo, #periodoADefinir, #selAll');
    const login = !exportReady && (
      /login|entrar|senha|email|e-mail|autentica|auth|sso|oauth/.test(text) ||
      /login|signin|auth|sso|oauth/.test(url)
    );
    return {
      ok: true,
      login,
      title: document.title,
      textHit: exportReady
    };
  }
  const blocked = /access denied|permission|permissao|permissão|sem permiss|acesso negado|solicitar acesso|request access/.test(text);
  const login = /login|signin|senha|entrar|microsoft/.test(text) && /login|signin|oauth|auth/.test(url);
  const excelLikeDom = !!document.querySelector('[aria-label*="Excel"], [data-automation-id*="Grid"], [role="grid"], canvas');
  const extensionOverlayIds = Array.from(document.querySelectorAll('iframe, frame, embed, object')).filter((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 &&
      rect.width > 0 && rect.height > 0;
  }).map((element) => {
    const source = String(element.getAttribute('src') || element.getAttribute('data') || '').trim().toLowerCase();
    return source.match(/^chrome-extension:\/\/([^/]+)/)?.[1] || '';
  }).filter(Boolean).filter((id, index, list) => list.indexOf(id) === index);
  const extensionOverlayCount = extensionOverlayIds.length;
  return {
    ok: true,
    login,
    blocked,
    extensionOverlayCount,
    extensionOverlayIds,
    title: document.title,
    textHit: text.includes('relatório de tickets') || text.includes('relatorio de tickets') ||
      text.includes('excel') || excelLikeDom
  };
}

async function inspectWorkspaceTabStatus(kind, tab, wasTracked = false) {
  const def = WORKSPACE_TAB_DEFS[kind];
  if (!tab) {
    return {
      kind,
      label: def.label,
      state: wasTracked ? 'error' : 'checking',
      reason: wasTracked ? 'Aba rastreada foi fechada ou não encontrada.' : 'Aguardando abertura da aba...'
    };
  }

  const url = String(tab.url || '').toLowerCase();
  if (tab.status === 'loading') {
    return { kind, label: def.label, state: 'checking', tabId: tab.id, reason: 'Carregando...' };
  }

  if (kind === 'ra') {
    if (!isWorkspaceTargetUrl(kind, url)) {
      const inspection = await runFunctionInTab(tab.id, inspectWorkspacePage, [kind]);
      const login = isWorkspaceLoginUrl(kind, url) || inspection?.login;
      return {
        kind,
        label: def.label,
        state: login || tab.status === 'complete' ? 'error' : 'checking',
        tabId: tab.id,
        reason: login ? 'HugMe está na tela de login.' : 'HugMe abriu fora da página de exportação.'
      };
    }
  } else if (!isWorkspaceTargetUrl(kind, url)) {
    const login = isWorkspaceLoginUrl(kind, url);
    return {
      kind,
      label: def.label,
      state: login || tab.status === 'complete' ? 'error' : 'checking',
      tabId: tab.id,
      reason: login ? 'Planilha pediu login ou permissão.' : 'Planilha abriu fora do arquivo alvo.'
    };
  }

  const inspection = await runFunctionInTab(tab.id, inspectWorkspacePage, [kind]);
  if (!inspection.ok) {
    return {
      kind,
      label: def.label,
      state: 'checking',
      tabId: tab.id,
      reason: 'Aba aberta, aguardando página ficar legível.'
    };
  }

  if (kind === 'ra' && isWorkspaceTargetUrl(kind, url)) {
    if (inspection.login) {
      return { kind, label: def.label, state: 'error', tabId: tab.id, reason: 'HugMe está na tela de login.' };
    }
    return {
      kind,
      label: def.label,
      state: inspection.textHit ? 'ready' : 'checking',
      tabId: tab.id,
      reason: inspection.textHit ? 'Pronto.' : 'HugMe aberto; aguardando formulário de exportação.'
    };
  }

  if (kind === 'ra' && inspection.login) {
    return { kind, label: def.label, state: 'error', tabId: tab.id, reason: 'HugMe pediu login.' };
  }
  if (kind === 'bi' && (inspection.login || inspection.blocked)) {
    return { kind, label: def.label, state: 'error', tabId: tab.id, reason: inspection.blocked ? 'Planilha sem permissão/acesso.' : 'Planilha pediu login.' };
  }

  if (kind === 'bi' && inspection.extensionOverlayCount > 0) {
    const ids = (inspection.extensionOverlayIds || []).filter(Boolean);
    const idText = ids.length ? ` ${ids[0].slice(0, 8)}...` : '';
    return {
      kind,
      label: def.label,
      state: 'error',
      tabId: tab.id,
      extensionOverlayIds: ids,
      extensionOverlayPrimaryId: ids[0] || '',
      reason: `Extensão interfere na Planilha${idText}. Clique para abrir e desativar.`
    };
    return {
      kind,
      label: def.label,
      state: 'error',
      tabId: tab.id,
      extensionOverlayIds: ids,
      extensionOverlayPrimaryId: ids[0] || '',
      reason: `Planilha com overlay de outra extensão ativo (${inspection.extensionOverlayCount}).${idText} Clique neste aviso para abrir a página da extensão e pause/desative antes de rodar RA > BI.`
    };
  }

  if (kind === 'bi' && isWorkspaceTargetUrl(kind, url)) {
    return {
      kind,
      label: def.label,
      state: 'ready',
      tabId: tab.id,
      reason: inspection.textHit ? 'Pronto.' : 'Planilha aberta; Excel Web carregado.'
    };
  }

  return {
    kind,
    label: def.label,
    state: inspection.textHit ? 'ready' : 'checking',
    tabId: tab.id,
    reason: inspection.textHit ? 'Pronto.' : 'Aberta, aguardando tela terminar de carregar.'
  };
}

async function getWorkspaceStatus() {
  const tracked = await getWorkspaceTabs();
  const raTab = await getLiveWorkspaceTab('ra', tracked);
  const biTab = await getLiveWorkspaceTab('bi', tracked);
  const [ra, bi] = await Promise.all([
    inspectWorkspaceTabStatus('ra', raTab, !!tracked.ra?.tabId),
    inspectWorkspaceTabStatus('bi', biTab, !!tracked.bi?.tabId)
  ]);
  return { ok: true, stage: 'workspace-status', ra, bi };
}

async function focusWorkspaceTab(kind) {
  const tracked = await getWorkspaceTabs();
  const tab = await getLiveWorkspaceTab(kind, tracked);
  const label = WORKSPACE_TAB_DEFS[kind]?.label || kind.toUpperCase();
  if (!tab) return { ok: false, stage: 'workspace-focus', reason: `Aba ${label} não encontrada.` };
  await focusWindow(tab.windowId);
  const focused = await activateTab(tab.id);
  return focused
    ? { ok: true, stage: 'workspace-focus', tabId: tab.id }
    : { ok: false, stage: 'workspace-focus', reason: `Não consegui focar a aba ${label}.` };
}
