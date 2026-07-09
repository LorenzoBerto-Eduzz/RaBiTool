// Excel Web destination automation scaffold.
async function prepareExcelWorkbook() {
  return {
    ok: false,
    stage: 'excel',
    reason: 'Excel destination steps are not configured yet.'
  };
}

async function copyPreparedRowsToClipboard(rowsText) {
  const text = String(rowsText || '').trim();
  if (!text) {
    return { ok: false, stage: 'clipboard', reason: 'No prepared rows were provided.' };
  }

  const result = await copyText(text);
  return { ...result, stage: 'clipboard' };
}
