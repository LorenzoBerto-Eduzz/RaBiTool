// RaBiTool workflow orchestration scaffold.
const RABITOOL_ACTIONS = {
  START_RA_TO_EXCEL: 'RABITOOL_START_RA_TO_EXCEL',
  PREPARE_RA_EXPORT: 'RABITOOL_PREPARE_RA_EXPORT',
  CHECK_RA_DOWNLOAD: 'RABITOOL_CHECK_RA_DOWNLOAD',
  PREPARE_EXCEL_IMPORT: 'RABITOOL_PREPARE_EXCEL_IMPORT'
};

let raBiWorkflowLock = null;

function raBiDiagnosticHash(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6);
}

function raBiDiagnosticPart(value, fallback = 'LOG') {
  const text = String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();
  return (text || fallback).slice(0, 32);
}

function raBiDiagnosticCode({ level = 'info', stage = 'workflow', text = '', seed = '' } = {}) {
  const levelPart = raBiDiagnosticPart(level, 'INFO').slice(0, 4);
  const stagePart = raBiDiagnosticPart(stage, 'WORKFLOW');
  return `RBT-${levelPart}-${stagePart}-${raBiDiagnosticHash(`${levelPart}|${stagePart}|${text}|${seed}`)}`;
}

function compactDiagnosticValue(value, depth = 0) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (depth >= 2) return Array.isArray(value) ? `[${value.length} itens]` : '[objeto]';
  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => compactDiagnosticValue(item, depth + 1)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .slice(0, 12)
      .map(([key, item]) => {
        const compact = compactDiagnosticValue(item, depth + 1);
        return compact ? `${key}=${compact}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }
  return '';
}

function workflowResultDiagnostic(result = {}) {
  const diagnostic = {};
  const keys = [
    'stage',
    'cancelled',
    'skipped',
    'title',
    'filename',
    'downloadId',
    'reportRowCount',
    'reportFirstId',
    'reportLastId',
    'reportFirstDate',
    'reportLastDate',
    'targetAnchorId'
  ];
  keys.forEach((key) => {
    if (result[key] != null && result[key] !== '') diagnostic[key] = result[key];
  });
  if (result.excelResult) {
    diagnostic.excel = {
      stage: result.excelResult.stage || '',
      targetAnchorId: result.excelResult.targetAnchorId || '',
      reportRowCount: result.excelResult.reportRowCount || '',
      reportColumnCount: result.excelResult.reportColumnCount || '',
      usedKeyboardFallback: result.excelResult.usedKeyboardFallback
    };
  }
  if (result.diagnostic || result.diagnostics || result.evidence) {
    diagnostic.details = result.diagnostic || result.diagnostics || result.evidence;
  }
  return diagnostic;
}

function isRaBiWorkflowRunning() {
  return !!raBiWorkflowLock;
}

function getRaBiWorkflowCancellationResult(stage = 'workflow-cancel') {
  if (!raBiWorkflowLock?.cancelled) return null;
  return {
    ok: false,
    cancelled: true,
    stage,
    reason: raBiWorkflowLock.cancelReason || 'RA > BI cancelado pelo usuário.'
  };
}

async function requestRaBiWorkflowCancel(reason = 'RA > BI cancelado pelo usuário.') {
  if (!raBiWorkflowLock) {
    return { ok: true, cancelled: false, stage: 'workflow-cancel', reason: 'Nenhum RA > BI em execução.' };
  }
  raBiWorkflowLock.cancelled = true;
  raBiWorkflowLock.cancelReason = reason;
  await setRaBiWorkflowStatus({
    running: false,
    activeText: '',
    notices: [{ level: 'warn', stage: 'workflow-cancel', text: reason }]
  });
  return { ok: true, cancelled: true, stage: 'workflow-cancel', reason };
}

function normalizeWorkflowNotice(notice) {
  if (!notice) return null;
  const text = String(notice.text || notice.reason || notice.message || '').trim();
  if (!text) return null;
  const level = notice.level || 'info';
  const stage = notice.stage || '';
  const diagnostic = notice.diagnostic || null;
  const code = notice.code || raBiDiagnosticCode({
    level,
    stage,
    text,
    seed: compactDiagnosticValue(diagnostic)
  });
  return {
    code,
    diagnostic,
    level: notice.level || 'info',
    text,
    stage,
    at: notice.at || new Date().toISOString()
  };
}

function setRaBiWorkflowStatus(patch = {}) {
  return new Promise((resolve) => {
    chrome.storage.local.get(WORKFLOW_STATUS_KEY, (data) => {
      const current = data?.[WORKFLOW_STATUS_KEY] || {};
      const next = {
        ...current,
        ...patch,
        notices: Array.isArray(patch.notices)
          ? patch.notices.map(normalizeWorkflowNotice).filter(Boolean)
          : (Array.isArray(current.notices) ? current.notices : []),
        updatedAt: new Date().toISOString()
      };
      chrome.storage.local.set({ [WORKFLOW_STATUS_KEY]: next }, () => resolve(next));
    });
  });
}

function clearFinishedRaBiWorkflowStatus() {
  chrome.storage.local.get(WORKFLOW_STATUS_KEY, (data) => {
    const current = data?.[WORKFLOW_STATUS_KEY] || {};
    if (current.running) return;
    chrome.storage.local.set({
      [WORKFLOW_STATUS_KEY]: {
        running: false,
        activeText: '',
        notices: [],
        updatedAt: new Date().toISOString()
      }
    });
  });
}

function workflowNoticeFromResult(result) {
  if (!result) return { level: 'error', text: 'Workflow terminou sem resposta.' };
  const text = result.ok
    ? (result.message || result.reason || `Etapa ${result.stage || 'workflow'} concluida.`)
    : (result.reason || `Etapa ${result.stage || 'workflow'} bloqueada.`);
  const level = result.ok ? 'info' : ((result.cancelled || result.skipped) ? 'warn' : 'error');
  const diagnostic = workflowResultDiagnostic(result);
  const code = result.code || raBiDiagnosticCode({
    level,
    stage: result.stage || '',
    text,
    seed: compactDiagnosticValue(diagnostic)
  });
  if (result.ok) {
    return {
      code,
      diagnostic,
      level,
      stage: result.stage || '',
      text
    };
  }
  return {
    code,
    diagnostic,
    level,
    stage: result.stage || '',
    text
  };
}

async function beginRaBiWorkflow(activeText) {
  await setRaBiWorkflowStatus({
    running: true,
    activeText,
    notices: [],
    startedAt: new Date().toISOString(),
    finishedAt: ''
  });
}

async function finishRaBiWorkflow(result) {
  await setRaBiWorkflowStatus({
    running: false,
    activeText: '',
    finishedAt: new Date().toISOString(),
    notices: [workflowNoticeFromResult(result)]
  });
}

function workflowAlreadyRunningResult() {
  return {
    ok: false,
    skipped: true,
    stage: 'workflow-lock',
    reason: 'RA > BI já está em execução.'
  };
}

async function runExclusiveRaBiWorkflow(activeText, worker) {
  if (raBiWorkflowLock) {
    const result = workflowAlreadyRunningResult();
    await setRaBiWorkflowStatus({
      running: true,
      notices: [{
        level: 'warn',
        stage: result.stage,
        text: result.reason
      }]
    });
    return result;
  }

  raBiWorkflowLock = { startedAt: new Date().toISOString(), cancelled: false, cancelReason: '' };
  try {
    await beginRaBiWorkflow(activeText);
    const result = await worker();
    const finalResult = getRaBiWorkflowCancellationResult() || result;
    await finishRaBiWorkflow(finalResult);
    return finalResult;
  } catch (error) {
    const result = getRaBiWorkflowCancellationResult() ||
      { ok: false, stage: 'workflow', reason: error?.message || String(error) || 'Erro inesperado no workflow.' };
    await finishRaBiWorkflow(result);
    return result;
  } finally {
    raBiWorkflowLock = null;
  }
}

async function startRaToExcelWorkflow() {
  return runExclusiveRaBiWorkflow('Verificando abas...', prepareReclameAquiExport);
}

async function prepareRaExportWorkflow() {
  return runExclusiveRaBiWorkflow('Preparando para gerar relat\u00f3rio...', prepareReclameAquiExport);
}

async function checkRaDownloadWorkflow() {
  return findLatestRaDownload();
}

async function prepareExcelImportWorkflow() {
  return prepareExcelWorkbook();
}
