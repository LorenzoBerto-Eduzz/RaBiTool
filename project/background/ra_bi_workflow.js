// RaBiTool workflow orchestration scaffold.
const RABITOOL_ACTIONS = {
  START_RA_TO_EXCEL: 'RABITOOL_START_RA_TO_EXCEL',
  PREPARE_RA_EXPORT: 'RABITOOL_PREPARE_RA_EXPORT',
  CHECK_RA_DOWNLOAD: 'RABITOOL_CHECK_RA_DOWNLOAD',
  PREPARE_EXCEL_IMPORT: 'RABITOOL_PREPARE_EXCEL_IMPORT'
};

async function startRaToExcelWorkflow() {
  return {
    ok: false,
    stage: 'alignment',
    reason: 'Workflow steps still need the exact RA page actions and Excel placement rules.'
  };
}

async function prepareRaExportWorkflow() {
  return prepareReclameAquiExport();
}

async function checkRaDownloadWorkflow() {
  return findLatestRaDownload();
}

async function prepareExcelImportWorkflow() {
  return prepareExcelWorkbook();
}
