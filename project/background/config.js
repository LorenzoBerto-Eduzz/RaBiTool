// RaBiTool service worker module.
const SETTINGS_KEY = 'rabiToolSettings';
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
