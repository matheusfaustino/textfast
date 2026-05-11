/**
 * userscript.js — standalone entry point.
 */

import {
  attachToDocument,
  showNotification,
  isSupportedElement,
} from './core.js';

// Storage adapter
// Prefers GM_* when available (Tampermonkey), falls back to localStorage.
// Both paths store the same JSON blob under the key "textfast_list_words".
const STORAGE_KEY = 'textfast_list_words';

function storageGet(defaultValue) {
  let raw;
  if (typeof GM_getValue !== 'undefined') {
    raw = GM_getValue(STORAGE_KEY, null);
  } else {
    raw = localStorage.getItem(STORAGE_KEY);
  }
  if (!raw) return defaultValue;
  try { return JSON.parse(raw); } catch (e) { return defaultValue; }
}

function storageSet(obj) {
  const json = JSON.stringify(obj);
  if (typeof GM_setValue !== 'undefined') {
    GM_setValue(STORAGE_KEY, json);
  } else {
    localStorage.setItem(STORAGE_KEY, json);
  }
}

let replaceWords = storageGet({});
// Settings are managed through the panel; capitalize / backspace not exposed yet
const settings = { capitalize: false, backspace: false };

attachToDocument(
  () => replaceWords,
  () => settings,
  () => showNotification('TextFast: This editor type may not support shortcuts.'),
);

// Settings panel  (Alt+Shift+T  or Tampermonkey menu)
// Inline styles only — no external CSS dependency.
let panelOpen = false;
let panelEl = null;


function inputStyle(extra) {
  return 'background:#313244;border:1px solid #45475a;border-radius:6px;'
    + 'color:#cdd6f4;padding:6px 10px;outline:none;font-size:13px;'
    + 'box-sizing:border-box;' + (extra || '');
}

function btnStyle(bg) {
  return 'background:' + bg + ';border:none;border-radius:6px;color:#1e1e2e;'
    + 'font-weight:600;padding:7px 14px;cursor:pointer;font-size:13px;white-space:nowrap';
}


function refreshTable(tbody) {
  tbody.innerHTML = '';
  const keys = Object.keys(replaceWords);

  if (keys.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="3" style="padding:14px 8px;color:#6c7086;'
      + 'text-align:center">No shortcuts yet. Add one above.</td>';
    tbody.appendChild(tr);
    return;
  }

  keys.forEach(function (key) {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #313244';

    const tdKey = document.createElement('td');
    tdKey.style.cssText = 'padding:7px 8px;font-family:monospace;color:#f38ba8';
    tdKey.textContent = key;

    const tdVal = document.createElement('td');
    tdVal.style.cssText = 'padding:7px 8px;word-break:break-word';
    tdVal.textContent = replaceWords[key];

    const tdDel = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.title = 'Delete';
    delBtn.style.cssText = 'background:none;border:none;cursor:pointer;'
      + 'font-size:15px;padding:2px 6px;border-radius:4px;color:#f38ba8';
    delBtn.onclick = function () {
      delete replaceWords[key];
      storageSet(replaceWords);
      refreshTable(tbody);
      showNotification('Shortcut removed.');
    };
    tdDel.appendChild(delBtn);
    tr.append(tdKey, tdVal, tdDel);
    tbody.appendChild(tr);
  });
}


function exportJSON() {
  const arr = Object.entries(replaceWords).map(function (pair) {
    return { replace: pair[0], with: pair[1] };
  });
  const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'textfast-shortcuts.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importFile(tbody) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = function () {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (ev) {
      try {
        const arr = JSON.parse(ev.target.result);
        if (!Array.isArray(arr)) throw new Error('Expected a JSON array');
        arr.forEach(function (item) {
          if (item.replace && item.with) replaceWords[item.replace] = item.with;
        });
        storageSet(replaceWords);
        refreshTable(tbody);
        showNotification('Imported ' + arr.length + ' shortcut(s).');
      } catch (err) {
        showNotification('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}


function buildPanel() {
  const overlay = document.createElement('div');
  overlay.id = 'tf-panel-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);'
    + 'z-index:2147483646;display:flex;align-items:center;justify-content:center';

  const box = document.createElement('div');
  box.style.cssText = 'background:#1e1e2e;color:#cdd6f4;border-radius:12px;'
    + 'padding:24px;width:540px;max-width:95vw;max-height:85vh;overflow-y:auto;'
    + 'box-shadow:0 8px 32px rgba(0,0,0,0.6);font:14px/1.5 system-ui,sans-serif;'
    + 'box-sizing:border-box';

  // header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px';
  const title = document.createElement('h2');
  title.textContent = 'TextFast — Shortcuts';
  title.style.cssText = 'margin:0;font-size:17px;color:#cba6f7';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = 'background:none;border:none;color:#cdd6f4;font-size:18px;'
    + 'cursor:pointer;line-height:1;padding:4px 8px;border-radius:6px';
  closeBtn.onclick = closePanel;
  header.append(title, closeBtn);

  // table
  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;margin-bottom:14px';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr>'
    + '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid #45475a;'
    + 'color:#a6adc8;font-weight:600">Shortcut</th>'
    + '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid #45475a;'
    + 'color:#a6adc8;font-weight:600">Expands to</th>'
    + '<th style="width:40px;border-bottom:1px solid #45475a"></th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  tbody.id = 'tf-tbody';
  table.appendChild(tbody);

  // add-row
  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap';

  const inShortcut = document.createElement('input');
  inShortcut.placeholder = 'Shortcut (e.g. imc)';
  inShortcut.style.cssText = inputStyle('width:140px');

  const inExpand = document.createElement('input');
  inExpand.placeholder = "Expands to (e.g. I'm coming)";
  inExpand.style.cssText = inputStyle('flex:1;min-width:160px');

  const addBtn = document.createElement('button');
  addBtn.textContent = 'Add';
  addBtn.style.cssText = btnStyle('#40a02b');
  addBtn.onclick = function () {
    const k = inShortcut.value.trim();
    const v = inExpand.value.trim();
    if (!k || !v) { showNotification('Fill in both fields first.'); return; }
    replaceWords[k] = v;
    storageSet(replaceWords);
    inShortcut.value = '';
    inExpand.value = '';
    refreshTable(tbody);
    showNotification('Shortcut added.');
  };

  // allow Enter in the expand field to submit
  inExpand.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.stopPropagation(); addBtn.click(); }
  });

  addRow.append(inShortcut, inExpand, addBtn);

  // footer
  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;'
    + 'border-top:1px solid #45475a;padding-top:14px;flex-wrap:wrap';

  const importBtn = document.createElement('button');
  importBtn.textContent = 'Import JSON';
  importBtn.style.cssText = btnStyle('#89b4fa');
  importBtn.onclick = function () { importFile(tbody); };

  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Export JSON';
  exportBtn.style.cssText = btnStyle('#89dceb');
  exportBtn.onclick = exportJSON;

  const doneBtn = document.createElement('button');
  doneBtn.textContent = 'Done';
  doneBtn.style.cssText = btnStyle('#cba6f7');
  doneBtn.onclick = closePanel;

  footer.append(importBtn, exportBtn, doneBtn);

  box.append(header, table, addRow, footer);
  overlay.appendChild(box);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closePanel();
  });

  // Prevent the panel's own key events from leaking into the page replacer
  overlay.addEventListener('keydown', function (e) { e.stopPropagation(); }, true);

  refreshTable(tbody);
  return overlay;
}

function openPanel() {
  if (panelOpen) return;
  panelOpen = true;
  panelEl = buildPanel();
  document.body.appendChild(panelEl);
}

function closePanel() {
  panelOpen = false;
  if (panelEl) { panelEl.remove(); panelEl = null; }
}

// Alt+Shift+T
document.addEventListener('keydown', function (e) {
  if (e.altKey && e.shiftKey && e.key === 'T') {
    panelOpen ? closePanel() : openPanel();
  }
}, true);

// Tampermonkey menu entry (silently skipped if API unavailable)
if (typeof GM_registerMenuCommand !== 'undefined') {
  GM_registerMenuCommand('TextFast settings (Alt+Shift+T)', openPanel);
}
