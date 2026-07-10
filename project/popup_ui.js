'use strict';

(function (global) {
  const MARKUP = `
    <div class="csh-top-row">
      <div class="csh-spacer" aria-hidden="true"></div>
      <div class="csh-controls">
        <span class="csh-drag-handle" title="Drag" aria-label="Drag">
          <svg width="12" height="15" viewBox="0 0 12 14" fill="currentColor" style="display:block">
            <circle cx="3" cy="2.5" r="1.4"/>
            <circle cx="9" cy="2.5" r="1.4"/>
            <circle cx="3" cy="7" r="1.4"/>
            <circle cx="9" cy="7" r="1.4"/>
            <circle cx="3" cy="11.5" r="1.4"/>
            <circle cx="9" cy="11.5" r="1.4"/>
          </svg>
        </span>
        <button class="csh-btn" id="csh-btn-gear" title="Settings" aria-label="Settings" type="button">
          <svg width="15" height="15" viewBox="-1 -1 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;overflow:visible">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button class="csh-btn" id="csh-btn-close" title="Disable" aria-label="Disable" type="button">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" style="display:block">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="csh-body" aria-live="polite"></div>
  `;

  const STYLE = `
    #rabi-tool-popup {
      position: fixed;
      width: 356px;
      min-height: 42px;
      background: #ffffff;
      color: #374151;
      border-radius: 10px;
      font-size: 13px;
      font-family: 'SF Mono','Consolas','Menlo',monospace;
      z-index: 2147483647;
      box-shadow: 0 8px 28px rgba(15,23,42,0.18);
      padding: 6px 10px 8px;
      display: flex;
      flex-direction: column;
      gap: 0;
      visibility: hidden;
      user-select: none;
    }
    #rabi-tool-popup * { box-sizing: border-box; }
    .csh-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 22px;
      padding-bottom: 4px;
      border-bottom: 1px solid #d1d5db;
    }
    .csh-body {
      min-height: 8px;
    }
    .csh-spacer {
      flex: 1 1 auto;
      min-width: 0;
    }
    .csh-controls {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-shrink: 0;
      min-height: 21px;
    }
    .csh-drag-handle {
      cursor: move;
      color: #9ca3af;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px 1px;
      align-self: center;
    }
    .csh-drag-handle:hover { color: #22c55e; }
    .csh-btn {
      cursor: pointer;
      background: none;
      border: none;
      color: #9ca3af;
      padding: 0;
      line-height: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.12s;
      height: 21px;
      align-self: center;
    }
    .csh-btn svg { flex-shrink: 0; }
    .csh-btn:hover { color: #22c55e; }
  `;

  global.RaBiToolUI = {
    getMarkup: () => MARKUP,
    getStyle: () => STYLE
  };
})(typeof window !== 'undefined' ? window : globalThis);
