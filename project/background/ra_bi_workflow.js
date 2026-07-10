// RaBiTool workflow orchestration scaffold.
const RABITOOL_ACTIONS = {
  START_RA_TO_EXCEL: 'RABITOOL_START_RA_TO_EXCEL',
  PREPARE_RA_EXPORT: 'RABITOOL_PREPARE_RA_EXPORT',
  CHECK_RA_DOWNLOAD: 'RABITOOL_CHECK_RA_DOWNLOAD',
  PREPARE_EXCEL_IMPORT: 'RABITOOL_PREPARE_EXCEL_IMPORT'
};

function normalizeWorkflowNotice(notice) {
  if (!notice) return null;
  const text = String(notice.text || notice.reason || notice.message || '').trim();
  if (!text) return null;
  return {
    level: notice.level || 'info',
    text,
    stage: notice.stage || '',
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
  if (result.ok) {
    return {
      level: 'info',
      stage: result.stage || '',
      text: result.message || result.reason || `Etapa ${result.stage || 'workflow'} concluida.`
    };
  }
  return {
    level: 'error',
    stage: result.stage || '',
    text: result.reason || `Etapa ${result.stage || 'workflow'} bloqueada.`
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

async function startRaToExcelWorkflow() {
  await beginRaBiWorkflow('Verificando abas...');
  try {
    const result = await prepareReclameAquiExport();
    await finishRaBiWorkflow(result);
    return result;
  } catch (error) {
    const result = { ok: false, stage: 'workflow', reason: error?.message || String(error) || 'Erro inesperado no workflow.' };
    await finishRaBiWorkflow(result);
    return result;
  }
}

async function prepareRaExportWorkflow() {
  await beginRaBiWorkflow('Preparando relatorio no HugMe...');
  const result = await prepareReclameAquiExport();
  await finishRaBiWorkflow(result);
  return result;
}

async function checkRaDownloadWorkflow() {
  return findLatestRaDownload();
}

async function prepareExcelImportWorkflow() {
  return prepareExcelWorkbook();
}
