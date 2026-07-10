// RaBiTool service worker module.
const SETTINGS_KEY = 'rabiToolSettings';
const WORKSPACE_TABS_KEY = 'rabiToolWorkspaceTabs';
const WORKFLOW_STATUS_KEY = 'rabiToolWorkflowStatus';
const DEFAULT_SETTINGS = {
  enabled: false,
  toolName: 'RaBiTool',
  reclameAquiUrl: 'https://app.hugme.com.br/app.html#/dados/tickets/exportar/',
  excelWorkbookUrl: 'https://eduzz.sharepoint.com/:x:/s/BI/IQD6u3ZLO0KJTLwdN11bRG8ZAS5Nj2f5Nry7-F5WpL1iDnE',
  excelWorksheetName: 'Relatório de Tickets',
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
