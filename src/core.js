/**
 * core.js — shared text-replacement engine.
 */

// Constants
export const UNSUPPORTED_INPUT_TYPES = [
  'button', 'checkbox', 'color', 'date', 'datetime-local',
  'file', 'hidden', 'image', 'month', 'radio', 'range',
  'reset', 'submit', 'time', 'week',
];

// Editor widgets that intercept DOM events internally; direct textContent
// manipulation conflicts with their virtual-DOM / model layers.
export const COMPLEX_EDITOR_SELECTORS = [
  '.CodeMirror', '.monaco-editor', '.ace_editor',
];

// Text helpers
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

// In-page toast notification
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

// ContentEditable helpers (Selection / Range API)
export function getCursorInTextNode() {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (range.startContainer.nodeType !== Node.TEXT_NODE) return null;
  return { node: range.startContainer, offset: range.startOffset };
}

export function setCursorAt(textNode, offset) {
  const sel = window.getSelection();
  const range = document.createRange();
  range.setStart(textNode, Math.min(offset, textNode.textContent.length));
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

// Replace text[start..end) inside `node` with `replacement`. Splits on \n so
// multi-line expansions become real <br> breaks in contentEditable, instead of
// literal \n characters that the browser collapses to a space. Keeps the
// original node identity for the single-line fast path so sites that track
// nodes (React-based editors) stay consistent.
export function replaceInTextNode(node, start, end, replacement) {
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
    parent.insertBefore(document.createElement('br'), anchor);
    const t = document.createTextNode(parts[i]);
    parent.insertBefore(t, anchor);
    lastText = t;
  }

  const cursorOffset = lastText.textContent.length;
  if (after) lastText.textContent += after;
  setCursorAt(lastText, cursorOffset);
}

// Core replacement
export function textReplacer(element, wordsToReplace, typedWord, way_back, settings) {
  settings = settings || {};
  way_back = way_back || 0;
  if (typedWord.length === 0) return;

  const stringTyped = typedWord.join('');
  if (!(stringTyped in wordsToReplace)) return;

  // space_size = 1 accounts for the space/enter that triggered the replacement
  const SPACE_SIZE = 1;
  // unescape() kept for backward-compat with any URL-encoded values already stored
  const expansion = unescape(wordsToReplace[stringTyped]); // eslint-disable-line no-undef
  const cap = settings.capitalize;

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
    beforeWord = afterWord - typedWord.length;
    replacement = expansion;
    if (beforeWord === 0 || beforeIsPoint(value, 0, beforeWord, cap)) {
      replacement = capitalizeFirstLetter(replacement, cap);
    }
  }

  // setRangeText edits only the matched slice; the rest of element.value is
  // left byte-for-byte intact. Reassigning element.value would force the
  // browser to renormalize line endings (CRLF -> LF), which corrupted email
  // signatures and other CRLF-bearing content (issue #15).
  element.setRangeText(replacement, beforeWord, afterWord, 'end');
}

// Element support detection
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

// Keyboard handler factory
export function createKeyHandler(getWords, getSettings) {
  let word = [];
  let old_word = [];

  function s() { return getSettings ? getSettings() : {}; }

  function handler(event) {
    if (event.isComposing) return;

    const key = event.key;
    const superKey = event.metaKey || event.ctrlKey;
    const settings = s();

    switch (key) {
      case 'Backspace':
        if (settings.backspace && old_word.length > 0) {
          textReplacer(event.target, getWords(), old_word, 1, settings);
          old_word = word = [];
          event.preventDefault();
          return;
        }
        if (superKey) { word = []; break; }
        if (event.target.selectionStart !== undefined) {
          if (event.target.selectionStart !== event.target.selectionEnd) { word = []; break; }
        } else if (event.target.isContentEditable) {
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed) { word = []; break; }
        }
        if (word.length) word.pop();
        break;

      case 'Enter':
      case ' ':
        textReplacer(event.target, getWords(), word, 0, settings);
        old_word = word;
        word = [];
        break;

      case 'Escape':
        if (!settings.backspace && old_word.length > 0) {
          textReplacer(event.target, getWords(), old_word, 1, settings);
        }
        old_word = word = [];
        break;

      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        word = [];
        break;

      default:
        // Use spread to count Unicode code points instead of UTF-16 code units,
        // so single non-BMP characters (emoji, CJK extensions) aren't filtered
        // out as if they were named keys like "Enter" or "ArrowLeft".
        if ([...key].length === 1) {
          if (superKey && (key === 'a' || key === 'A')) { word = []; }
          else if (!superKey) { word.push(key); }
        }
        break;
    }
  }

  handler.reset = function () { word = []; old_word = []; };
  return handler;
}

// Document attachment
export function attachToDocument(getWords, getSettings, onComplexEditor) {
  const handler = createKeyHandler(getWords, getSettings);

  document.body.addEventListener('focus', function (e) {
    const elem = e.target;
    if (!isSupportedElement(elem)) return;

    if (isInsideComplexEditor(elem)) {
      if (onComplexEditor) onComplexEditor(elem);
      return;
    }

    handler.reset();
    elem.addEventListener('keydown', handler, true);
  }, true);

  document.body.addEventListener('blur', function (e) {
    const elem = e.target;
    if (isSupportedElement(elem)) {
      elem.removeEventListener('keydown', handler, true);
    }
  }, true);

  if (document.activeElement && isSupportedElement(document.activeElement)) {
    const elem = document.activeElement;
    if (!isInsideComplexEditor(elem)) {
      elem.addEventListener('keydown', handler, true);
      elem.addEventListener('blur', function (e) {
        e.target.removeEventListener('keydown', handler, true);
      }, { once: true });
    }
  }

  return handler;
}
