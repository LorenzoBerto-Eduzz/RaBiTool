'use strict';

(function (global) {
  const MARKUP = `
    <div class="csh-top-row">
      <div class="csh-spacer" aria-hidden="true"></div>
      <div class="csh-controls">
        <span class="csh-drag-handle" title="Arrastar" aria-label="Arrastar">
          <svg width="12" height="15" viewBox="0 0 12 14" fill="currentColor" style="display:block">
            <circle cx="3" cy="2.5" r="1.4"/>
            <circle cx="9" cy="2.5" r="1.4"/>
            <circle cx="3" cy="7" r="1.4"/>
            <circle cx="9" cy="7" r="1.4"/>
            <circle cx="3" cy="11.5" r="1.4"/>
            <circle cx="9" cy="11.5" r="1.4"/>
          </svg>
        </span>
        <button class="csh-btn" id="csh-btn-gear" title="Configurações" aria-label="Configurações" type="button">
          <svg width="15" height="15" viewBox="-1 -1 26 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;overflow:visible">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button class="csh-btn" id="csh-btn-close" title="Desativar" aria-label="Desativar" type="button">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" style="display:block">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="csh-body" aria-live="polite">
      <div class="csh-tab-row">
        <button class="csh-tab-btn csh-tab-ra" id="csh-btn-tab-ra" type="button" data-state="checking">
          <span>HugMe</span><span class="csh-tab-icon" data-kind="ra"></span>
        </button>
        <button class="csh-tab-btn csh-tab-bi" id="csh-btn-tab-bi" type="button" data-state="checking">
          <span>Planilha</span><span class="csh-tab-icon" data-kind="bi"></span>
        </button>
      </div>
      <button class="csh-run-btn" id="csh-btn-run" type="button">
        <span>RA &gt; BI</span><span class="csh-run-spinner" aria-hidden="true"></span>
      </button>
      <div class="csh-progress" id="csh-progress" hidden>
        <span class="csh-spinner" aria-hidden="true"></span>
        <span class="csh-progress-text" id="csh-progress-text">Aguardando...</span>
      </div>
      <div class="csh-status-stack" id="csh-status"></div>
    </div>
  `;

  const STYLE = `
    #rabi-tool-popup {
      all: initial;
      position: fixed;
      width: 190px;
      min-width: 190px;
      max-width: 190px;
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
    #rabi-tool-popup * {
      box-sizing: border-box;
      letter-spacing: 0;
    }
    .csh-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 22px;
      padding-bottom: 4px;
      border-bottom: 1px solid #d1d5db;
    }
    .csh-body {
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding-top: 8px;
    }
    .csh-run-btn {
      appearance: none;
      background: #16a34a;
      border: 1px solid #15803d;
      border-radius: 7px;
      color: #ffffff;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      font: 700 12px/1 'SF Mono','Consolas','Menlo',monospace;
      height: 30px;
      margin: 0;
      padding: 0 10px;
      text-align: center;
      text-transform: none;
      transition: background 0.12s, border-color 0.12s;
      width: 100%;
      white-space: nowrap;
    }
    .csh-run-btn:hover {
      background: #15803d;
      border-color: #166534;
    }
    .csh-test-btn {
      background: #2563eb;
      border-color: #1d4ed8;
    }
    .csh-test-btn:hover {
      background: #1d4ed8;
      border-color: #1e40af;
    }
    .csh-run-btn:disabled {
      background: #9ca3af;
      border-color: #9ca3af;
      cursor: wait;
    }
    .csh-run-spinner {
      animation: csh-spin 0.85s linear infinite;
      border: 2px solid rgba(37,99,235,0.25);
      border-top-color: #2563eb;
      border-radius: 999px;
      display: none;
      flex: 0 0 12px;
      height: 12px;
      min-height: 12px;
      min-width: 12px;
      width: 12px;
    }
    .csh-run-btn[data-running="true"] .csh-run-spinner {
      display: inline-block;
    }
    .csh-tab-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .csh-tab-btn {
      appearance: none;
      background: #ffffff;
      border: 1.5px solid #9ca3af;
      border-radius: 7px;
      color: #6b7280;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      font: 700 11px/1 'SF Mono','Consolas','Menlo',monospace;
      height: 26px;
      margin: 0;
      padding: 0 7px;
      text-align: center;
      text-transform: none;
      transition: background 0.12s, border-color 0.12s, color 0.12s, transform 0.12s;
      width: 100%;
      white-space: nowrap;
    }
    .csh-tab-btn:hover {
      background: #f8fafc;
    }
    .csh-tab-btn:active {
      transform: translateY(1px);
    }
    .csh-tab-btn[data-state="ready"] {
      border-color: #16a34a;
      color: #16a34a;
    }
    .csh-tab-btn[data-state="ready"]:hover { background: #f0fdf4; }
    .csh-tab-btn[data-state="checking"] {
      border-color: #2563eb;
      color: #2563eb;
    }
    .csh-tab-btn[data-state="checking"]:hover { background: #eff6ff; }
    .csh-tab-btn[data-state="error"] {
      border-color: #dc2626;
      color: #dc2626;
    }
    .csh-tab-btn[data-state="error"]:hover { background: #fef2f2; }
    .csh-tab-icon {
      display: inline-grid;
      place-items: center;
      min-width: 12px;
      min-height: 12px;
      color: currentColor;
      font-size: 11px;
      line-height: 1;
    }
    .csh-tab-btn[data-state="checking"] .csh-tab-icon {
      border: 2px solid rgba(37,99,235,0.25);
      border-top-color: currentColor;
      border-radius: 999px;
      font-size: 0;
      width: 12px;
      height: 12px;
      animation: csh-spin 0.85s linear infinite;
    }
    .csh-tab-btn[data-state="ready"] .csh-tab-icon::before { content: "\\2713"; }
    .csh-tab-btn[data-state="error"] .csh-tab-icon::before { content: "\\00d7"; }
    .csh-tab-btn[data-state="error"] .csh-tab-icon {
      font-size: 18px;
      font-weight: 900;
      line-height: 0.75;
    }
    .csh-tab-btn[data-state="unknown"] .csh-tab-icon::before { content: "..."; }
    .csh-progress {
      align-items: center;
      color: #4b5563;
      display: flex;
      font-size: 11px;
      gap: 7px;
      line-height: 1.35;
      min-height: 16px;
      overflow-wrap: anywhere;
    }
    .csh-progress[hidden] {
      display: none;
    }
    .csh-spinner {
      animation: csh-spin 0.85s linear infinite;
      border: 2px solid rgba(37,99,235,0.25);
      border-top-color: #2563eb;
      border-radius: 999px;
      display: inline-block;
      flex: 0 0 13px;
      height: 13px;
      min-height: 13px;
      min-width: 13px;
      width: 13px;
    }
    .csh-status-stack {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .csh-status-stack:empty { display: none; }
    .csh-status-item {
      align-items: flex-start;
      color: #6b7280;
      cursor: pointer;
      display: flex;
      font: 500 11px/1.35 'SF Mono','Consolas','Menlo',monospace;
      gap: 6px;
      overflow-wrap: anywhere;
    }
    .csh-status-item[data-level="error"] { color: #dc2626; }
    .csh-status-item[data-level="warn"] { color: #b45309; }
    .csh-status-item[data-level="info"] { color: #4b5563; }
    .csh-status-icon {
      flex: 0 0 auto;
      font-size: 11px;
      line-height: 1.35;
    }
    .csh-status-text {
      min-width: 0;
      user-select: text;
    }
    @keyframes csh-spin {
      to { transform: rotate(360deg); }
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
