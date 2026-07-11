(async () => {
  const params = new URLSearchParams(location.search);
  const token = params.get('token') || '';

  async function readClipboard() {
    if (!navigator.clipboard?.readText) {
      return { ok: false, reason: 'navigator.clipboard.readText indisponivel no leitor focado.' };
    }

    try {
      window.focus();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const text = await navigator.clipboard.readText();
      return { ok: true, text: String(text || '') };
    } catch (error) {
      return {
        ok: false,
        reason: `navigator.clipboard.readText no leitor focado falhou: ${error?.name || 'Error'} ${error?.message || ''}`.trim()
      };
    }
  }

  const result = await readClipboard();
  chrome.runtime.sendMessage({
    action: 'RABITOOL_CLIPBOARD_READER_RESULT',
    token,
    result
  });
})();
