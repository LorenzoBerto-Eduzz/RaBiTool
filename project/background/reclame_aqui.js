// Reclame Aqui source-page automation scaffold.
async function prepareReclameAquiExport() {
  return {
    ok: false,
    stage: 'reclame-aqui',
    reason: 'RA export steps are not configured yet.'
  };
}

async function findLatestRaDownload() {
  if (!chrome.downloads?.search) {
    return { ok: false, stage: 'download', reason: 'Chrome downloads API is unavailable.' };
  }

  return new Promise((resolve) => {
    chrome.downloads.search({ limit: 10, orderBy: ['-startTime'] }, (downloads) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, stage: 'download', reason: chrome.runtime.lastError.message });
        return;
      }

      const latestXlsx = (downloads || []).find((item) => {
        const filename = String(item.filename || item.url || '').toLowerCase();
        return filename.endsWith('.xlsx') || filename.includes('.xlsx?');
      });

      if (!latestXlsx) {
        resolve({ ok: false, stage: 'download', reason: 'No recent XLSX download was found.' });
        return;
      }

      resolve({
        ok: true,
        stage: 'download',
        downloadId: latestXlsx.id,
        filename: latestXlsx.filename,
        state: latestXlsx.state
      });
    });
  });
}
