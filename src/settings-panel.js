import { C, inputStyle, btnStyle, tableHeaderStyle } from './panel-theme.js';

export function createSettingsPanel(opts) {
  const { getWords, saveWords, notify = defaultNotify } = opts;

  let open = false;
  let overlay = null;

  function defaultNotify(msg) {
    const prev = document.getElementById('tf-notification');
    if (prev) prev.remove();
    const el = document.createElement('div');
    el.id = 'tf-notification';
    el.textContent = msg;
    el.style.cssText = `position:fixed;bottom:20px;right:20px;background:rgba(0,0,0,0.82);`
      + `color:${C.text};padding:8px 14px;border-radius:6px;font:13px/1.5 system-ui,sans-serif;`
      + `z-index:2147483647;opacity:1;transition:opacity 0.4s;pointer-events:none;max-width:300px`;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 3500);
  }

  function refreshTable(tbody) {
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    const words = getWords();
    const keys = Object.keys(words);

    if (!keys.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.style.cssText = `padding:14px 8px;color:${C.dim};text-align:center`;
      td.textContent = 'No shortcuts yet. Add one above.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    keys.forEach((key) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = `1px solid ${C.surface}`;

      const tdKey = document.createElement('td');
      tdKey.style.cssText = `padding:7px 8px;font-family:monospace;color:${C.red}`;
      tdKey.textContent = key;

      const tdVal = document.createElement('td');
      tdVal.style.cssText = `padding:7px 8px;word-break:break-word;color:${C.text}`;
      tdVal.textContent = words[key];

      const tdDel = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.textContent = '×';
      delBtn.title = 'Delete';
      delBtn.style.cssText = `background:none;border:none;cursor:pointer;font-size:18px;`
        + `line-height:1;padding:2px 6px;border-radius:4px;color:${C.red}`;
      delBtn.onclick = () => {
        const words2 = getWords();
        delete words2[key];
        saveWords(words2);
        refreshTable(tbody);
        notify('Shortcut removed.');
      };
      tdDel.appendChild(delBtn);
      tr.append(tdKey, tdVal, tdDel);
      tbody.appendChild(tr);
    });
  }

  function exportJSON() {
    const arr = Object.entries(getWords()).map(([k, v]) => ({ replace: k, with: v }));
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
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const arr = JSON.parse(ev.target.result);
          if (!Array.isArray(arr)) throw new Error('Expected a JSON array');
          const words = getWords();
          arr.forEach((item) => { if (item.replace && item.with) words[item.replace] = item.with; });
          saveWords(words);
          refreshTable(tbody);
          notify(`Imported ${arr.length} shortcut(s).`);
        } catch (err) {
          notify('Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function build() {
    const ov = document.createElement('div');
    ov.id = 'tf-panel-overlay';
    ov.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.55);`
      + `z-index:2147483646;display:flex;align-items:center;justify-content:center`;

    const box = document.createElement('div');
    box.style.cssText = `background:${C.bg};color:${C.text};border-radius:12px;`
      + `padding:24px;width:560px;max-width:95vw;max-height:85vh;overflow-y:auto;`
      + `box-shadow:0 8px 32px rgba(0,0,0,0.6);font:14px/1.5 system-ui,sans-serif;`
      + `box-sizing:border-box`;

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:18px';
    const title = document.createElement('h2');
    title.textContent = 'TextFast — Shortcuts';
    title.style.cssText = `margin:0;font-size:17px;color:${C.accent}`;
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `background:none;border:none;color:${C.muted};font-size:18px;`
      + `cursor:pointer;line-height:1;padding:4px 8px;border-radius:6px`;
    closeBtn.onclick = closePanel;
    header.append(title, closeBtn);

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;margin-bottom:14px';
    const thead = document.createElement('thead');
    const hStyle = tableHeaderStyle();
    const htr = document.createElement('tr');
    const thShortcut = document.createElement('th');
    thShortcut.style.cssText = hStyle;
    thShortcut.textContent = 'Shortcut';
    const thExpands = document.createElement('th');
    thExpands.style.cssText = hStyle;
    thExpands.textContent = 'Expands to';
    const thDel = document.createElement('th');
    thDel.style.cssText = `width:36px;border-bottom:1px solid ${C.overlay}`;
    htr.append(thShortcut, thExpands, thDel);
    thead.appendChild(htr);
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);

    const addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap';

    const inShortcut = document.createElement('input');
    inShortcut.placeholder = 'Shortcut (e.g. imc)';
    inShortcut.style.cssText = inputStyle('width:150px');

    const inExpand = document.createElement('input');
    inExpand.placeholder = "Expands to (e.g. I'm coming)";
    inExpand.style.cssText = inputStyle('flex:1;min-width:160px');

    const addBtn = document.createElement('button');
    addBtn.textContent = 'Add';
    addBtn.style.cssText = btnStyle(C.green);
    addBtn.onclick = () => {
      const k = inShortcut.value.trim();
      const v = inExpand.value.trim();
      if (!k || !v) { notify('Fill in both fields.'); return; }
      const words = getWords();
      words[k] = v;
      saveWords(words);
      inShortcut.value = '';
      inExpand.value = '';
      refreshTable(tbody);
      notify('Shortcut added.');
    };

    inExpand.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.stopPropagation(); addBtn.click(); }
    });

    addRow.append(inShortcut, inExpand, addBtn);

    const footer = document.createElement('div');
    footer.style.cssText = `display:flex;justify-content:flex-end;gap:8px;`
      + `border-top:1px solid ${C.overlay};padding-top:14px;flex-wrap:wrap`;

    const importBtn = document.createElement('button');
    importBtn.textContent = 'Import JSON';
    importBtn.style.cssText = btnStyle(C.blue);
    importBtn.onclick = () => importFile(tbody);

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export JSON';
    exportBtn.style.cssText = btnStyle(C.teal);
    exportBtn.onclick = exportJSON;

    const doneBtn = document.createElement('button');
    doneBtn.textContent = 'Done';
    doneBtn.style.cssText = btnStyle(C.accent);
    doneBtn.onclick = closePanel;

    footer.append(importBtn, exportBtn, doneBtn);

    box.append(header, table, addRow, footer);
    ov.appendChild(box);

    // close on backdrop click; stop panel keys from leaking to page replacer
    ov.addEventListener('click', (e) => { if (e.target === ov) closePanel(); });
    ov.addEventListener('keydown', (e) => e.stopPropagation(), true);

    refreshTable(tbody);
    return ov;
  }

  function openPanel() {
    if (open) return;
    open = true;
    overlay = build();
    document.body.appendChild(overlay);
  }

  function closePanel() {
    open = false;
    if (overlay) { overlay.remove(); overlay = null; }
  }

  function togglePanel() {
    open ? closePanel() : openPanel();
  }

  return { open: openPanel, close: closePanel, toggle: togglePanel };
}
