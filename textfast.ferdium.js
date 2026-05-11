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
  function addTextBetween(text, p1, p2, p3, p4, newPart) {
    return text.substr(p1, p2) + newPart + text.substr(p3, p4);
  }
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
        node.textContent = text.substring(0, start) + stringTyped + text.substring(offset);
        setCursorAt(node, start + stringTyped.length);
      } else {
        const start = offset - stringTyped.length;
        if (start < 0) return;
        if (text.substring(start, offset) !== stringTyped) return;
        let replacement2 = expansion;
        if (start === 0 || beforeIsPoint(text, 0, start, cap)) {
          replacement2 = capitalizeFirstLetter(replacement2, cap);
        }
        node.textContent = text.substring(0, start) + replacement2 + text.substring(offset);
        setCursorAt(node, start + replacement2.length);
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
    element.value = addTextBetween(value, 0, beforeWord, afterWord, element.textLength, replacement);
    const newCursor = way_back ? afterWord + (stringTyped.length - expansion.length) - SPACE_SIZE : afterWord + (replacement.length - stringTyped.length);
    element.setSelectionRange(newCursor, newCursor);
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
          if (key.length === 1) {
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
  var panelOpen = false;
  var panelEl = null;
  function inputStyle(extra) {
    return "background:#313244;border:1px solid #45475a;border-radius:6px;color:#cdd6f4;padding:6px 10px;outline:none;font-size:13px;box-sizing:border-box;" + (extra || "");
  }
  function btnStyle(bg) {
    return "background:" + bg + ";border:none;border-radius:6px;color:#1e1e2e;font-weight:600;padding:7px 14px;cursor:pointer;font-size:13px;white-space:nowrap";
  }
  function refreshTable(tbody) {
    tbody.innerHTML = "";
    const keys = Object.keys(replaceWords);
    if (keys.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="3" style="padding:14px 8px;color:#6c7086;text-align:center">No shortcuts yet. Add one above.</td>';
      tbody.appendChild(tr);
      return;
    }
    keys.forEach(function(key) {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #313244";
      const tdKey = document.createElement("td");
      tdKey.style.cssText = "padding:7px 8px;font-family:monospace;color:#f38ba8";
      tdKey.textContent = key;
      const tdVal = document.createElement("td");
      tdVal.style.cssText = "padding:7px 8px;word-break:break-word";
      tdVal.textContent = replaceWords[key];
      const tdDel = document.createElement("td");
      const delBtn = document.createElement("button");
      delBtn.textContent = "\u{1F5D1}";
      delBtn.title = "Delete";
      delBtn.style.cssText = "background:none;border:none;cursor:pointer;font-size:15px;padding:2px 6px;border-radius:4px;color:#f38ba8";
      delBtn.onclick = function() {
        delete replaceWords[key];
        storageSet(replaceWords);
        refreshTable(tbody);
        showNotification("Shortcut removed.");
      };
      tdDel.appendChild(delBtn);
      tr.append(tdKey, tdVal, tdDel);
      tbody.appendChild(tr);
    });
  }
  function exportJSON() {
    const arr = Object.entries(replaceWords).map(function(pair) {
      return { replace: pair[0], with: pair[1] };
    });
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
    input.onchange = function() {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        try {
          const arr = JSON.parse(ev.target.result);
          if (!Array.isArray(arr)) throw new Error("Expected a JSON array");
          arr.forEach(function(item) {
            if (item.replace && item.with) replaceWords[item.replace] = item.with;
          });
          storageSet(replaceWords);
          refreshTable(tbody);
          showNotification("Imported " + arr.length + " shortcut(s).");
        } catch (err) {
          showNotification("Import failed: " + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
  function buildPanel() {
    const overlay = document.createElement("div");
    overlay.id = "tf-panel-overlay";
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2147483646;display:flex;align-items:center;justify-content:center";
    const box = document.createElement("div");
    box.style.cssText = "background:#1e1e2e;color:#cdd6f4;border-radius:12px;padding:24px;width:540px;max-width:95vw;max-height:85vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.6);font:14px/1.5 system-ui,sans-serif;box-sizing:border-box";
    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:16px";
    const title = document.createElement("h2");
    title.textContent = "TextFast \u2014 Shortcuts";
    title.style.cssText = "margin:0;font-size:17px;color:#cba6f7";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "\u2715";
    closeBtn.style.cssText = "background:none;border:none;color:#cdd6f4;font-size:18px;cursor:pointer;line-height:1;padding:4px 8px;border-radius:6px";
    closeBtn.onclick = closePanel;
    header.append(title, closeBtn);
    const table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse;margin-bottom:14px";
    const thead = document.createElement("thead");
    thead.innerHTML = '<tr><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #45475a;color:#a6adc8;font-weight:600">Shortcut</th><th style="text-align:left;padding:6px 8px;border-bottom:1px solid #45475a;color:#a6adc8;font-weight:600">Expands to</th><th style="width:40px;border-bottom:1px solid #45475a"></th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    tbody.id = "tf-tbody";
    table.appendChild(tbody);
    const addRow = document.createElement("div");
    addRow.style.cssText = "display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap";
    const inShortcut = document.createElement("input");
    inShortcut.placeholder = "Shortcut (e.g. imc)";
    inShortcut.style.cssText = inputStyle("width:140px");
    const inExpand = document.createElement("input");
    inExpand.placeholder = "Expands to (e.g. I'm coming)";
    inExpand.style.cssText = inputStyle("flex:1;min-width:160px");
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add";
    addBtn.style.cssText = btnStyle("#40a02b");
    addBtn.onclick = function() {
      const k = inShortcut.value.trim();
      const v = inExpand.value.trim();
      if (!k || !v) {
        showNotification("Fill in both fields first.");
        return;
      }
      replaceWords[k] = v;
      storageSet(replaceWords);
      inShortcut.value = "";
      inExpand.value = "";
      refreshTable(tbody);
      showNotification("Shortcut added.");
    };
    inExpand.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        e.stopPropagation();
        addBtn.click();
      }
    });
    addRow.append(inShortcut, inExpand, addBtn);
    const footer = document.createElement("div");
    footer.style.cssText = "display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #45475a;padding-top:14px;flex-wrap:wrap";
    const importBtn = document.createElement("button");
    importBtn.textContent = "Import JSON";
    importBtn.style.cssText = btnStyle("#89b4fa");
    importBtn.onclick = function() {
      importFile(tbody);
    };
    const exportBtn = document.createElement("button");
    exportBtn.textContent = "Export JSON";
    exportBtn.style.cssText = btnStyle("#89dceb");
    exportBtn.onclick = exportJSON;
    const doneBtn = document.createElement("button");
    doneBtn.textContent = "Done";
    doneBtn.style.cssText = btnStyle("#cba6f7");
    doneBtn.onclick = closePanel;
    footer.append(importBtn, exportBtn, doneBtn);
    box.append(header, table, addRow, footer);
    overlay.appendChild(box);
    overlay.addEventListener("click", function(e) {
      if (e.target === overlay) closePanel();
    });
    overlay.addEventListener("keydown", function(e) {
      e.stopPropagation();
    }, true);
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
    if (panelEl) {
      panelEl.remove();
      panelEl = null;
    }
  }
  document.addEventListener("keydown", function(e) {
    if (e.altKey && e.shiftKey && e.key === "T") {
      panelOpen ? closePanel() : openPanel();
    }
  }, true);
  if (typeof GM_registerMenuCommand !== "undefined") {
    GM_registerMenuCommand("TextFast settings (Alt+Shift+T)", openPanel);
  }
})();
