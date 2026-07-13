chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'OFFSCREEN_READ_TEXT') {
    (async () => {
      if (!navigator.clipboard?.readText) {
        sendResponse({ ok: false, reason: 'navigator.clipboard.readText indisponível no documento offscreen.' });
        return;
      }
      try {
        const text = await navigator.clipboard.readText();
        sendResponse({ ok: true, text: String(text || '') });
      } catch (error) {
        sendResponse({
          ok: false,
          reason: `navigator.clipboard.readText falhou: ${error?.name || 'Error'} ${error?.message || ''}`.trim()
        });
      }
    })();
    return true;
  }

  if (message?.action !== 'OFFSCREEN_COPY_TEXT') return false;

  const text = String(message.value || '');

  async function copyWithClipboardApi() {
    if (!navigator.clipboard?.writeText) {
      return { ok: false, reason: 'navigator.clipboard.writeText indisponível no documento offscreen.' };
    }
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: 'navigator.clipboard.writeText' };
    } catch (error) {
      return {
        ok: false,
        reason: `navigator.clipboard.writeText falhou: ${error?.name || 'Error'} ${error?.message || ''}`.trim()
      };
    }
  }

  function copyWithExecCommand() {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok
        ? { ok: true, method: 'document.execCommand' }
        : { ok: false, reason: 'document.execCommand retornou falso.' };
    } catch (error) {
      return {
        ok: false,
        reason: `document.execCommand falhou: ${error?.message || error}`
      };
    }
  }

  (async () => {
    const clipboardApiResult = await copyWithClipboardApi();
    if (clipboardApiResult.ok) {
      sendResponse(clipboardApiResult);
      return;
    }

    const execCommandResult = copyWithExecCommand();
    if (execCommandResult.ok) {
      sendResponse({ ...execCommandResult, fallbackFrom: clipboardApiResult.reason });
      return;
    }

    sendResponse({
      ok: false,
      reason: `${clipboardApiResult.reason} / ${execCommandResult.reason}`
    });
  })();

  return true;
});
