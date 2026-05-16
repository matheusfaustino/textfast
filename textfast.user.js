// ==UserScript==
// @name         TextFast
// @namespace    https://github.com/matheusfaustino/textfast
// @version      1.4.0
// @description  Type a short alias and it expands to a full word, phrase or emoji. Open settings with Alt+Shift+T.
// @author       Matheus Faustino
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==
//
// Ferdium / Electron custom-JS users: paste everything below this block into
// the service's "Custom JS" field. GM_* APIs are not needed — the script falls
// back to localStorage automatically.

(() => {
  // src/core.js
  var UNSUPPORTED_INPUT_TYPES = [
    "button",
    "checkbox",
    "color",
    "date",
    "datetime-local",
    "file",
    "hidden",
    "image",
    "month",
    "radio",
    "range",
    "reset",
    "submit",
    "time",
    "week"
  ];
  var COMPLEX_EDITOR_SELECTORS = [
    ".CodeMirror",
    ".monaco-editor",
    ".ace_editor"
  ];
  function capitalizeFirstLetter(string, enabled) {
    if (enabled) return string[0].toUpperCase() + string.slice(1);
    return string;
  }
  function beforeIsPoint(string, start, end, enabled) {
    if (!enabled) return false;
    const s = string.slice(start, end).trim();
    return s.length > 0 && s[s.length - 1] === ".";
  }
  function showNotification(message, duration) {
    duration = duration || 4e3;
    const prev = document.getElementById("tf-notification");
    if (prev) prev.remove();
    const el = document.createElement("div");
    el.id = "tf-notification";
    el.textContent = message;
    el.style.cssText = "position:fixed;bottom:20px;right:20px;background:rgba(0,0,0,0.82);color:#fff;padding:8px 14px;border-radius:6px;font:13px/1.5 system-ui,sans-serif;z-index:2147483647;opacity:1;transition:opacity 0.4s;pointer-events:none;max-width:300px";
    document.body.appendChild(el);
    setTimeout(function() {
      el.style.opacity = "0";
      setTimeout(function() {
        if (el.parentNode) el.remove();
      }, 400);
    }, duration);
  }
  function getCursorInTextNode() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    if (range.startContainer.nodeType !== Node.TEXT_NODE) return null;
    return { node: range.startContainer, offset: range.startOffset };
  }
  function setCursorAt(textNode, offset) {
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(textNode, Math.min(offset, textNode.textContent.length));
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function replaceInTextNode(node, start, end, replacement) {
    const text = node.textContent;
    const before = text.substring(0, start);
    const after = text.substring(end);
    if (replacement.indexOf("\n") < 0) {
      node.textContent = before + replacement + after;
      setCursorAt(node, start + replacement.length);
      return;
    }
    const parts = replacement.split("\n");
    const parent = node.parentNode;
    const anchor = node.nextSibling;
    node.textContent = before + parts[0];
    let lastText = node;
    for (let i = 1; i < parts.length; i++) {
      parent.insertBefore(document.createElement("br"), anchor);
      const t = document.createTextNode(parts[i]);
      parent.insertBefore(t, anchor);
      lastText = t;
    }
    const cursorOffset = lastText.textContent.length;
    if (after) lastText.textContent += after;
    setCursorAt(lastText, cursorOffset);
  }
  function textReplacer(element, wordsToReplace, typedWord, way_back, settings2) {
    settings2 = settings2 || {};
    way_back = way_back || 0;
    if (typedWord.length === 0) return;
    const stringTyped = typedWord.join("");
    if (!(stringTyped in wordsToReplace)) return;
    const SPACE_SIZE = 1;
    const expansion = unescape(wordsToReplace[stringTyped]);
    const cap = settings2.capitalize;
    if (element.isContentEditable) {
      const cursor = getCursorInTextNode();
      if (!cursor || !element.contains(cursor.node)) return;
      const { node, offset } = cursor;
      const text = node.textContent;
      if (way_back) {
        const start = offset - expansion.length - SPACE_SIZE;
        if (start < 0) return;
        if (text.substring(start, start + expansion.length) !== expansion) return;
        replaceInTextNode(node, start, offset, stringTyped);
      } else {
        const start = offset - stringTyped.length;
        if (start < 0) return;
        if (text.substring(start, offset) !== stringTyped) return;
        let replacement2 = expansion;
        if (start === 0 || beforeIsPoint(text, 0, start, cap)) {
          replacement2 = capitalizeFirstLetter(replacement2, cap);
        }
        replaceInTextNode(node, start, offset, replacement2);
      }
      return;
    }
    const value = element.value;
    const afterWord = element.selectionStart;
    let beforeWord, replacement;
    if (way_back) {
      beforeWord = afterWord - expansion.length - SPACE_SIZE;
      replacement = stringTyped;
    } else {
      beforeWord = afterWord - typedWord.length;
      replacement = expansion;
      if (beforeWord === 0 || beforeIsPoint(value, 0, beforeWord, cap)) {
        replacement = capitalizeFirstLetter(replacement, cap);
      }
    }
    element.setRangeText(replacement, beforeWord, afterWord, "end");
  }
  function isSupportedElement(e) {
    if (!e || !e.tagName) return false;
    const tag = e.tagName.toLowerCase();
    if (tag === "input") {
      const type = (e.type || "text").toLowerCase();
      return UNSUPPORTED_INPUT_TYPES.indexOf(type) < 0;
    }
    return tag === "textarea" || !!e.isContentEditable;
  }
  function isInsideComplexEditor(element) {
    return COMPLEX_EDITOR_SELECTORS.some(function(selector) {
      try {
        return !!element.closest(selector);
      } catch (e) {
        return false;
      }
    });
  }
  function createKeyHandler(getWords, getSettings) {
    let word = [];
    let old_word = [];
    function s() {
      return getSettings ? getSettings() : {};
    }
    function handler(event) {
      if (event.isComposing) return;
      const key = event.key;
      const superKey = event.metaKey || event.ctrlKey;
      const settings2 = s();
      switch (key) {
        case "Backspace":
          if (settings2.backspace && old_word.length > 0) {
            textReplacer(event.target, getWords(), old_word, 1, settings2);
            old_word = word = [];
            event.preventDefault();
            return;
          }
          if (superKey) {
            word = [];
            break;
          }
          if (event.target.selectionStart !== void 0) {
            if (event.target.selectionStart !== event.target.selectionEnd) {
              word = [];
              break;
            }
          } else if (event.target.isContentEditable) {
            const sel = window.getSelection();
            if (sel && !sel.isCollapsed) {
              word = [];
              break;
            }
          }
          if (word.length) word.pop();
          break;
        case "Enter":
        case " ":
          textReplacer(event.target, getWords(), word, 0, settings2);
          old_word = word;
          word = [];
          break;
        case "Escape":
          if (!settings2.backspace && old_word.length > 0) {
            textReplacer(event.target, getWords(), old_word, 1, settings2);
          }
          old_word = word = [];
          break;
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown":
          word = [];
          break;
        default:
          if ([...key].length === 1) {
            if (superKey && (key === "a" || key === "A")) {
              word = [];
            } else if (!superKey) {
              word.push(key);
            }
          }
          break;
      }
    }
    handler.reset = function() {
      word = [];
      old_word = [];
    };
    return handler;
  }
  function attachToDocument(getWords, getSettings, onComplexEditor) {
    const handler = createKeyHandler(getWords, getSettings);
    document.body.addEventListener("focus", function(e) {
      const elem = e.target;
      if (!isSupportedElement(elem)) return;
      if (isInsideComplexEditor(elem)) {
        if (onComplexEditor) onComplexEditor(elem);
        return;
      }
      handler.reset();
      elem.addEventListener("keydown", handler, true);
    }, true);
    document.body.addEventListener("blur", function(e) {
      const elem = e.target;
      if (isSupportedElement(elem)) {
        elem.removeEventListener("keydown", handler, true);
      }
    }, true);
    if (document.activeElement && isSupportedElement(document.activeElement)) {
      const elem = document.activeElement;
      if (!isInsideComplexEditor(elem)) {
        elem.addEventListener("keydown", handler, true);
        elem.addEventListener("blur", function(e) {
          e.target.removeEventListener("keydown", handler, true);
        }, { once: true });
      }
    }
    return handler;
  }

  // src/panel-theme.js
  var C = {
    bg: "#f6f6fb",
    // page background (very slight lavender tint)
    surface: "#ffffff",
    // card / input background
    overlay: "#dde1f0",
    // borders
    text: "#18181f",
    // primary text
    muted: "#636380",
    // secondary text
    dim: "#a0a0c0",
    // placeholders
    accent: "#7c3aed",
    // vivid purple
    red: "#d63060",
    // shortcut labels / delete
    green: "#1a8a45",
    // add / success
    blue: "#2d6be4",
    // import
    teal: "#0a8e8e",
    // export
    yellow: "#c07c08"
    // warning
  };
  function inputStyle(extra) {
    return `background:${C.surface};border:1px solid ${C.overlay};border-radius:6px;color:${C.text};padding:6px 10px;outline:none;font-size:13px;box-sizing:border-box;font-family:inherit;${extra || ""}`;
  }
  function btnStyle(bg, fg) {
    fg = fg || "#ffffff";
    return `background:${bg};border:none;border-radius:6px;color:${fg};font-weight:600;padding:7px 14px;cursor:pointer;font-size:13px;white-space:nowrap;font-family:inherit`;
  }
  function tableHeaderStyle() {
    return `text-align:left;padding:6px 8px;border-bottom:1px solid ${C.overlay};color:${C.muted};font-weight:600`;
  }

  // src/settings-panel.js
  function createSettingsPanel(opts) {
    const { getWords, saveWords, notify = defaultNotify } = opts;
    let open = false;
    let overlay = null;
    function defaultNotify(msg) {
      const prev = document.getElementById("tf-notification");
      if (prev) prev.remove();
      const el = document.createElement("div");
      el.id = "tf-notification";
      el.textContent = msg;
      el.style.cssText = `position:fixed;bottom:20px;right:20px;background:rgba(0,0,0,0.82);color:${C.text};padding:8px 14px;border-radius:6px;font:13px/1.5 system-ui,sans-serif;z-index:2147483647;opacity:1;transition:opacity 0.4s;pointer-events:none;max-width:300px`;
      document.body.appendChild(el);
      setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 400);
      }, 3500);
    }
    function refreshTable(tbody) {
      while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
      const words = getWords();
      const keys = Object.keys(words);
      if (!keys.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 3;
        td.style.cssText = `padding:14px 8px;color:${C.dim};text-align:center`;
        td.textContent = "No shortcuts yet. Add one above.";
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
      }
      keys.forEach((key) => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = `1px solid ${C.surface}`;
        const tdKey = document.createElement("td");
        tdKey.style.cssText = `padding:7px 8px;font-family:monospace;color:${C.red}`;
        tdKey.textContent = key;
        const tdVal = document.createElement("td");
        tdVal.style.cssText = `padding:7px 8px;word-break:break-word;color:${C.text}`;
        tdVal.textContent = words[key];
        const tdDel = document.createElement("td");
        const delBtn = document.createElement("button");
        delBtn.textContent = "\xD7";
        delBtn.title = "Delete";
        delBtn.style.cssText = `background:none;border:none;cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;border-radius:4px;color:${C.red}`;
        delBtn.onclick = () => {
          const words2 = getWords();
          delete words2[key];
          saveWords(words2);
          refreshTable(tbody);
          notify("Shortcut removed.");
        };
        tdDel.appendChild(delBtn);
        tr.append(tdKey, tdVal, tdDel);
        tbody.appendChild(tr);
      });
    }
    function exportJSON() {
      const arr = Object.entries(getWords()).map(([k, v]) => ({ replace: k, with: v }));
      const blob = new Blob([JSON.stringify(arr, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "textfast-shortcuts.json";
      a.click();
      URL.revokeObjectURL(url);
    }
    function importFile(tbody) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const arr = JSON.parse(ev.target.result);
            if (!Array.isArray(arr)) throw new Error("Expected a JSON array");
            const words = getWords();
            arr.forEach((item) => {
              if (item.replace && item.with) words[item.replace] = item.with;
            });
            saveWords(words);
            refreshTable(tbody);
            notify(`Imported ${arr.length} shortcut(s).`);
          } catch (err) {
            notify("Import failed: " + err.message);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
    function build() {
      const ov = document.createElement("div");
      ov.id = "tf-panel-overlay";
      ov.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2147483646;display:flex;align-items:center;justify-content:center`;
      const box = document.createElement("div");
      box.style.cssText = `background:${C.bg};color:${C.text};border-radius:12px;padding:24px;width:560px;max-width:95vw;max-height:85vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.6);font:14px/1.5 system-ui,sans-serif;box-sizing:border-box`;
      const header = document.createElement("div");
      header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:18px";
      const title = document.createElement("h2");
      title.textContent = "TextFast \u2014 Shortcuts";
      title.style.cssText = `margin:0;font-size:17px;color:${C.accent}`;
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "\u2715";
      closeBtn.style.cssText = `background:none;border:none;color:${C.muted};font-size:18px;cursor:pointer;line-height:1;padding:4px 8px;border-radius:6px`;
      closeBtn.onclick = closePanel;
      header.append(title, closeBtn);
      const table = document.createElement("table");
      table.style.cssText = "width:100%;border-collapse:collapse;margin-bottom:14px";
      const thead = document.createElement("thead");
      const hStyle = tableHeaderStyle();
      const htr = document.createElement("tr");
      const thShortcut = document.createElement("th");
      thShortcut.style.cssText = hStyle;
      thShortcut.textContent = "Shortcut";
      const thExpands = document.createElement("th");
      thExpands.style.cssText = hStyle;
      thExpands.textContent = "Expands to";
      const thDel = document.createElement("th");
      thDel.style.cssText = `width:36px;border-bottom:1px solid ${C.overlay}`;
      htr.append(thShortcut, thExpands, thDel);
      thead.appendChild(htr);
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      table.appendChild(tbody);
      const addRow = document.createElement("div");
      addRow.style.cssText = "display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap";
      const inShortcut = document.createElement("input");
      inShortcut.placeholder = "Shortcut (e.g. imc)";
      inShortcut.style.cssText = inputStyle("width:150px");
      const inExpand = document.createElement("input");
      inExpand.placeholder = "Expands to (e.g. I'm coming)";
      inExpand.style.cssText = inputStyle("flex:1;min-width:160px");
      const addBtn = document.createElement("button");
      addBtn.textContent = "Add";
      addBtn.style.cssText = btnStyle(C.green);
      addBtn.onclick = () => {
        const k = inShortcut.value.trim();
        const v = inExpand.value.trim();
        if (!k || !v) {
          notify("Fill in both fields.");
          return;
        }
        const words = getWords();
        words[k] = v;
        saveWords(words);
        inShortcut.value = "";
        inExpand.value = "";
        refreshTable(tbody);
        notify("Shortcut added.");
      };
      inExpand.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          addBtn.click();
        }
      });
      addRow.append(inShortcut, inExpand, addBtn);
      const footer = document.createElement("div");
      footer.style.cssText = `display:flex;justify-content:flex-end;gap:8px;border-top:1px solid ${C.overlay};padding-top:14px;flex-wrap:wrap`;
      const importBtn = document.createElement("button");
      importBtn.textContent = "Import JSON";
      importBtn.style.cssText = btnStyle(C.blue);
      importBtn.onclick = () => importFile(tbody);
      const exportBtn = document.createElement("button");
      exportBtn.textContent = "Export JSON";
      exportBtn.style.cssText = btnStyle(C.teal);
      exportBtn.onclick = exportJSON;
      const doneBtn = document.createElement("button");
      doneBtn.textContent = "Done";
      doneBtn.style.cssText = btnStyle(C.accent);
      doneBtn.onclick = closePanel;
      footer.append(importBtn, exportBtn, doneBtn);
      box.append(header, table, addRow, footer);
      ov.appendChild(box);
      ov.addEventListener("click", (e) => {
        if (e.target === ov) closePanel();
      });
      ov.addEventListener("keydown", (e) => e.stopPropagation(), true);
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
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
    }
    function togglePanel() {
      open ? closePanel() : openPanel();
    }
    return { open: openPanel, close: closePanel, toggle: togglePanel };
  }

  // src/userscript.js
  var STORAGE_KEY = "textfast_list_words";
  function storageGet(defaultValue) {
    let raw;
    if (typeof GM_getValue !== "undefined") {
      raw = GM_getValue(STORAGE_KEY, null);
    } else {
      raw = localStorage.getItem(STORAGE_KEY);
    }
    if (!raw) return defaultValue;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return defaultValue;
    }
  }
  function storageSet(obj) {
    const json = JSON.stringify(obj);
    if (typeof GM_setValue !== "undefined") {
      GM_setValue(STORAGE_KEY, json);
    } else {
      localStorage.setItem(STORAGE_KEY, json);
    }
  }
  var replaceWords = storageGet({});
  var settings = { capitalize: false, backspace: false };
  attachToDocument(
    () => replaceWords,
    () => settings,
    () => showNotification("TextFast: This editor type may not support shortcuts.")
  );
  var panel = createSettingsPanel({
    getWords: () => replaceWords,
    saveWords: (obj) => {
      replaceWords = obj;
      storageSet(obj);
    },
    notify: (msg) => showNotification(msg)
  });
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.shiftKey && e.key === "T") panel.toggle();
  }, true);
  if (typeof GM_registerMenuCommand !== "undefined") {
    GM_registerMenuCommand("TextFast settings (Alt+Shift+T)", panel.open);
  }
})();
