// Scheduled RA > BI execution.
const AUTORUN_ALARM_NAME = 'rabiToolAutoRun';
const AUTORUN_META_KEY = 'rabiToolAutorunMeta';
const AUTORUN_DAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function normalizeAutorunTime(value) {
  const match = String(value || '').trim().replace(/h$/i, '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return DEFAULT_SETTINGS.autorun.time;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return DEFAULT_SETTINGS.autorun.time;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeAutorunDays(days) {
  const raw = Array.isArray(days) ? days : DEFAULT_SETTINGS.autorun.days;
  const unique = [...new Set(raw.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  return unique.sort((a, b) => a - b);
}

function normalizeAutorunSettings(raw = {}) {
  const base = DEFAULT_SETTINGS.autorun || {};
  return {
    ...base,
    ...(raw || {}),
    enabled: raw?.enabled === true,
    time: normalizeAutorunTime(raw?.time || base.time),
    days: normalizeAutorunDays(raw?.days),
    lateGraceMinutes: Math.max(1, Number(raw?.lateGraceMinutes || base.lateGraceMinutes || 1))
  };
}

function getAutorunSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (data) => {
      resolve(withDefaultSettings(data?.[SETTINGS_KEY]).autorun);
    });
  });
}

function getAutorunMeta() {
  return new Promise((resolve) => {
    chrome.storage.local.get(AUTORUN_META_KEY, (data) => resolve(data?.[AUTORUN_META_KEY] || {}));
  });
}

function setAutorunMeta(patch = {}) {
  return new Promise((resolve) => {
    chrome.storage.local.get(AUTORUN_META_KEY, (data) => {
      const next = {
        ...(data?.[AUTORUN_META_KEY] || {}),
        ...patch,
        updatedAt: new Date().toISOString()
      };
      chrome.storage.local.set({ [AUTORUN_META_KEY]: next }, () => resolve(next));
    });
  });
}

function clearAutorunAlarm() {
  return new Promise((resolve) => {
    if (!chrome.alarms?.clear) return resolve(false);
    chrome.alarms.clear(AUTORUN_ALARM_NAME, () => resolve(!chrome.runtime.lastError));
  });
}

function createAutorunAlarm(when) {
  return new Promise((resolve) => {
    if (!chrome.alarms?.create) return resolve(false);
    chrome.alarms.create(AUTORUN_ALARM_NAME, { when });
    resolve(true);
  });
}

function getNextAutorunDate(autorun, fromDate = new Date()) {
  const days = normalizeAutorunDays(autorun?.days);
  if (!autorun?.enabled || !days.length) return null;

  const [hours, minutes] = normalizeAutorunTime(autorun.time).split(':').map(Number);
  const start = new Date(fromDate);
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset);
    candidate.setHours(hours, minutes, 0, 0);
    if (!days.includes(candidate.getDay())) continue;
    if (candidate.getTime() > fromDate.getTime() + 1000) return candidate;
  }
  return null;
}

async function syncAutoRunAlarm(settings) {
  const autorun = normalizeAutorunSettings(settings?.autorun || (await getAutorunSettings()));
  if (!autorun.enabled || !autorun.days.length) {
    await clearAutorunAlarm();
    await setAutorunMeta({
      enabled: autorun.enabled,
      scheduledFor: '',
      scheduledForMs: 0,
      reason: autorun.enabled ? 'Nenhum dia selecionado para execucao automatica.' : 'Execucao automatica desligada.'
    });
    return { ok: true, scheduled: false };
  }

  const next = getNextAutorunDate(autorun);
  if (!next) {
    await clearAutorunAlarm();
    await setAutorunMeta({
      enabled: true,
      scheduledFor: '',
      scheduledForMs: 0,
      reason: 'Nao consegui calcular a proxima execucao automatica.'
    });
    return { ok: false, scheduled: false };
  }

  await createAutorunAlarm(next.getTime());
  await setAutorunMeta({
    enabled: true,
    time: autorun.time,
    days: autorun.days,
    dayLabels: autorun.days.map((day) => AUTORUN_DAY_LABELS[day]).join(' '),
    scheduledFor: next.toISOString(),
    scheduledForMs: next.getTime(),
    reason: ''
  });
  return { ok: true, scheduled: true, scheduledFor: next.toISOString() };
}

async function enablePopupForAutoRun() {
  return new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (data) => {
      const settings = withDefaultSettings(data?.[SETTINGS_KEY]);
      settings.enabled = true;
      chrome.storage.local.set({ enabled: true, [SETTINGS_KEY]: settings }, () => resolve(!chrome.runtime.lastError));
    });
  });
}

async function runScheduledRaBiWorkflow(meta = {}) {
  const current = await new Promise((resolve) => {
    chrome.storage.local.get(WORKFLOW_STATUS_KEY, (data) => resolve(data?.[WORKFLOW_STATUS_KEY] || {}));
  });
  if (current.running) {
    await setAutorunMeta({
      lastRunAt: new Date().toISOString(),
      lastResult: 'skipped',
      lastReason: 'RA > BI ja estava em execucao.'
    });
    return { ok: false, skipped: true, reason: 'RA > BI ja estava em execucao.' };
  }

  await enablePopupForAutoRun();
  await setRaBiWorkflowStatus({
    running: true,
    activeText: 'Execucao automatica RA > BI...',
    notices: [{
      level: 'info',
      stage: 'autorun',
      text: 'Execucao automatica iniciada.'
    }],
    autoRun: true,
    autoRunScheduledFor: meta.scheduledFor || ''
  });
  const result = await startRaToExcelWorkflow({ source: 'autorun' });
  await setAutorunMeta({
    lastRunAt: new Date().toISOString(),
    lastResult: result?.ok ? 'ok' : 'blocked',
    lastReason: result?.message || result?.reason || '',
    lastStage: result?.stage || ''
  });
  return result;
}

async function handleAutoRunAlarm(alarm) {
  if (alarm?.name !== AUTORUN_ALARM_NAME) return;

  const settings = await new Promise((resolve) => {
    chrome.storage.local.get(SETTINGS_KEY, (data) => resolve(withDefaultSettings(data?.[SETTINGS_KEY])));
  });
  const autorun = normalizeAutorunSettings(settings.autorun);
  const meta = await getAutorunMeta();
  await syncAutoRunAlarm(settings);

  if (!autorun.enabled || !autorun.days.includes(new Date().getDay())) return;

  const scheduledForMs = Number(meta.scheduledForMs || alarm.scheduledTime || 0);
  const lateByMs = scheduledForMs ? Date.now() - scheduledForMs : 0;
  const graceMs = Number(autorun.lateGraceMinutes || 1) * 60000;
  if (lateByMs > graceMs) {
    const reason = `Execucao automatica perdida: Chrome/dispositivo acordou ${Math.round(lateByMs / 60000)} min depois do horario.`;
    await setAutorunMeta({
      lastRunAt: new Date().toISOString(),
      lastResult: 'missed',
      lastReason: reason
    });
    await setRaBiWorkflowStatus({
      running: false,
      activeText: '',
      notices: [{ level: 'warn', stage: 'autorun', text: reason }]
    });
    return;
  }

  await runScheduledRaBiWorkflow(meta);
}
