/**
 * core.js — shared text-replacement engine.
 */

export const UNSUPPORTED_INPUT_TYPES = [
  'button', 'checkbox', 'color', 'date', 'datetime-local',
  'file', 'hidden', 'image', 'month', 'radio', 'range',
  'reset', 'submit', 'time', 'week',
];

// These editors manage their own DOM and conflict with direct text edits.
export const COMPLEX_EDITOR_SELECTORS = [
  '.CodeMirror', '.monaco-editor', '.ace_editor',
];

export function addTextBetween(text, p1, p2, p3, p4, newPart) {
  return text.substr(p1, p2) + newPart + text.substr(p3, p4);
}

export function capitalizeFirstLetter(string, enabled) {
  if (enabled) return string[0].toUpperCase() + string.slice(1);
  return string;
}

export function beforeIsPoint(string, start, end, enabled) {
  if (!enabled) return false;
  const s = string.slice(start, end).trim();
  return s.length > 0 && s[s.length - 1] === '.';
}

export function showNotification(message, duration) {
  duration = duration || 4000;
  const prev = document.getElementById('tf-notification');
  if (prev) prev.remove();

  const el = document.createElement('div');
  el.id = 'tf-notification';
  el.textContent = message;
  el.style.cssText = 'position:fixed;bottom:20px;right:20px;'
    + 'background:rgba(0,0,0,0.82);color:#fff;padding:8px 14px;'
    + 'border-radius:6px;font:13px/1.5 system-ui,sans-serif;'
    + 'z-index:2147483647;opacity:1;transition:opacity 0.4s;'
    + 'pointer-events:none;max-width:300px';

  document.body.appendChild(el);
  setTimeout(function () {
    el.style.opacity = '0';
    setTimeout(function () { if (el.parentNode) el.remove(); }, 400);
  }, duration);
}

export function getCursorInTextNode(doc = document) {
  const sel = doc.defaultView.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return null;
  return { node: range.startContainer, offset: range.startOffset };
}

export function setCursorAt(textNode, offset) {
  const doc = textNode.ownerDocument;
  const sel = doc.defaultView.getSelection();
  const range = doc.createRange();
  range.setStart(textNode, Math.min(offset, textNode.textContent.length));
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

// Use <br> for newlines and preserve node identity for single-line edits.
export function replaceInTextNode(node, start, end, replacement) {
  const doc = node.ownerDocument;
  const text = node.textContent;
  const before = text.substring(0, start);
  const after = text.substring(end);

  if (replacement.indexOf('\n') < 0) {
    node.textContent = before + replacement + after;
    setCursorAt(node, start + replacement.length);
    return;
  }

  const parts = replacement.split('\n');
  const parent = node.parentNode;
  const anchor = node.nextSibling;

  node.textContent = before + parts[0];
  let lastText = node;
  for (let i = 1; i < parts.length; i++) {
    parent.insertBefore(doc.createElement('br'), anchor);
    const t = doc.createTextNode(parts[i]);
    parent.insertBefore(t, anchor);
    lastText = t;
  }

  const cursorOffset = lastText.textContent.length;
  if (after) lastText.textContent += after;
  setCursorAt(lastText, cursorOffset);
}

export function textReplacer(element, wordsToReplace, typedWord, way_back, settings) {
  settings = settings || {};
  way_back = way_back || 0;
  if (typedWord.length === 0) return;

  const stringTyped = typedWord.join('');
  // Ignore inherited keys such as "toString" that are not user shortcuts.
  if (!Object.prototype.hasOwnProperty.call(wordsToReplace, stringTyped)) return;

  // A consumed trigger was never inserted, so undo must not count it.
  const SPACE_SIZE = settings.trigger_consumed ? 0 : 1;
  // Keep imported values literal; unescape() corrupts legitimate percent text.
  const expansion = String(wordsToReplace[stringTyped]);
  const cap = settings.capitalize;

  if (element.isContentEditable) {
    const cursor = getCursorInTextNode(element.ownerDocument);
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

      let replacement = expansion;
      if (start === 0 || beforeIsPoint(text, 0, start, cap)) {
        replacement = capitalizeFirstLetter(replacement, cap);
      }
      replaceInTextNode(node, start, offset, replacement);
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
    // element.value uses UTF-16 offsets, so use string length rather than the
    // code-point count used while collecting typedWord.
    beforeWord = afterWord - stringTyped.length;
    replacement = expansion;
    if (beforeWord === 0 || beforeIsPoint(value, 0, beforeWord, cap)) {
      replacement = capitalizeFirstLetter(replacement, cap);
    }
  }

  // Editing only the match preserves line endings elsewhere in the value.
  element.setRangeText(replacement, beforeWord, afterWord, 'end');
}

export function isSupportedElement(e) {
  if (!e || !e.tagName) return false;
  const tag = e.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (e.type || 'text').toLowerCase();
    return UNSUPPORTED_INPUT_TYPES.indexOf(type) < 0;
  }
  return tag === 'textarea' || !!e.isContentEditable;
}

export function isInsideComplexEditor(element) {
  return COMPLEX_EDITOR_SELECTORS.some(function (selector) {
    try { return !!element.closest(selector); } catch (e) { return false; }
  });
}

export function createKeyHandler(getWords, getSettings) {
  let word = [];
  let old_word = [];
  // Undo must know whether the last replacement consumed its trigger key.
  let triggerConsumed = false;

  function s() { return getSettings ? getSettings() : {}; }

  function handler(event) {
    if (event.isComposing) return;

    const key = event.key;
    const superKey = event.metaKey || event.ctrlKey;
    const settings = s();

    switch (key) {
      case 'Backspace':
        if (settings.backspace && old_word.length > 0) {
          textReplacer(event.target, getWords(), old_word, 1,
            { ...settings, trigger_consumed: triggerConsumed });
          old_word = word = [];
          triggerConsumed = false;
          event.preventDefault();
          return;
        }
        if (superKey) { word = []; break; }
        if (event.target.selectionStart !== undefined) {
          if (event.target.selectionStart !== event.target.selectionEnd) { word = []; break; }
        } else if (event.target.isContentEditable) {
          const sel = event.target.ownerDocument.defaultView.getSelection();
          if (sel && !sel.isCollapsed) { word = []; break; }
        }
        if (word.length) word.pop();
        break;

      case 'Enter':
      case ' ': {
        const typed = word.join('');
        const matched = word.length > 0 &&
          Object.prototype.hasOwnProperty.call(getWords(), typed);
        // A matched Enter must not submit the surrounding form.
        if (matched && settings.no_trailing_space) {
          textReplacer(event.target, getWords(), word, 0,
            { ...settings, trigger_consumed: true });
          old_word = word;
          word = [];
          triggerConsumed = true;
          event.preventDefault();
        } else {
          textReplacer(event.target, getWords(), word, 0, settings);
          old_word = word;
          word = [];
          triggerConsumed = false;
        }
        break;
      }

      case 'Escape':
        if (!settings.backspace && old_word.length > 0) {
          textReplacer(event.target, getWords(), old_word, 1,
            { ...settings, trigger_consumed: triggerConsumed });
        }
        old_word = word = [];
        triggerConsumed = false;
        break;

      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        word = [];
        triggerConsumed = false;
        break;

      default:
        // Count code points so non-BMP characters are treated as single keys.
        if ([...key].length === 1) {
          if (superKey && (key === 'a' || key === 'A')) { word = []; }
          else if (!superKey) { word.push(key); }
        }
        break;
    }
  }

  handler.reset = function () { word = []; old_word = []; triggerConsumed = false; };
  return handler;
}

// Check the preference before showing or persisting the per-site warning.
export function createComplexEditorWarning(read, write, enabled = () => true) {
  let started = false;
  return function () {
    if (started) return;
    started = true;
    Promise.resolve().then(read).then(function (seen) {
      if (seen) return;
      return Promise.resolve(enabled()).then(function (on) {
        if (!on) return;
        showNotification('TextFast: This editor type may not support shortcuts.', 3500);
        return write();
      });
    }).catch(function () {});
  };
}

export function attachToDocument(getWords, getSettings, onComplexEditor, targetDocument = document) {
  const handler = createKeyHandler(getWords, getSettings);

  targetDocument.addEventListener('focus', function (e) {
    const elem = e.target;
    if (!isSupportedElement(elem)) return;

    if (isInsideComplexEditor(elem)) {
      if (onComplexEditor) onComplexEditor(elem);
      return;
    }

    handler.reset();
    elem.addEventListener('keydown', handler, true);
  }, true);

  targetDocument.addEventListener('blur', function (e) {
    const elem = e.target;
    if (isSupportedElement(elem)) {
      elem.removeEventListener('keydown', handler, true);
    }
  }, true);

  if (targetDocument.activeElement && isSupportedElement(targetDocument.activeElement)) {
    const elem = targetDocument.activeElement;
    if (!isInsideComplexEditor(elem)) {
      elem.addEventListener('keydown', handler, true);
      elem.addEventListener('blur', function (e) {
        e.target.removeEventListener('keydown', handler, true);
      }, { once: true });
    }
  }

  return handler;
}
