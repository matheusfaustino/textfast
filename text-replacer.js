let replaceWords = {};
let USE_CAPITALIZE_WORDS = false;
let USE_BACKSPACE_INSTEAD_ESC = false;

function updateReplaceWords() {
  browser.runtime.sendMessage({'action': 'get_list'}).then((data) => {
    replaceWords = data;
  });
}

function canCapitalize() {
  browser.storage.local.get('can_capitalize')
  .then(can_capitalize => {
    USE_CAPITALIZE_WORDS = !can_capitalize.can_capitalize;
  });
}

function useBackspaceInsteadEsc() {
  browser.storage.local.get('esc_cancel')
  .then(esc_cancel => {
    USE_BACKSPACE_INSTEAD_ESC = esc_cancel.esc_cancel;
  });
}

// @see https://stackoverflow.com/a/33704783
function capitalizeFirstLetter(string) {
  if (USE_CAPITALIZE_WORDS)
    return string[0].toUpperCase() + string.slice(1);
  return string;
}

function beforeIsPoint(string, start, end) {
  if (!USE_CAPITALIZE_WORDS) return false;
  const s = string.slice(start, end).trim();
  return s.length > 0 && s[s.length - 1] === '.';
}

updateReplaceWords();
canCapitalize();
useBackspaceInsteadEsc();

browser.storage.onChanged.addListener(() => {
  updateReplaceWords();
  canCapitalize();
  useBackspaceInsteadEsc();
});

function addTextBetween(text, p1, p2, p3, p4, newPart) {
  return text.substr(p1, p2) + newPart + text.substr(p3, p4);
}

// ---------------------------------------------------------------------------
// In-page notification
// Shows a small non-intrusive toast at the bottom-right of the viewport when
// the extension cannot reliably capture input (e.g. complex editor detected).
// ---------------------------------------------------------------------------
function showInPageNotification(message, duration) {
  duration = duration || 4000;
  const prev = document.getElementById('tf-notification');
  if (prev) prev.remove();

  const el = document.createElement('div');
  el.id = 'tf-notification';
  el.textContent = message;
  el.style.cssText = 'position:fixed;bottom:20px;right:20px;background:rgba(0,0,0,0.82);'
    + 'color:#fff;padding:8px 14px;border-radius:6px;font:13px/1.5 sans-serif;'
    + 'z-index:2147483647;opacity:1;transition:opacity 0.4s;pointer-events:none;max-width:300px';

  document.body.appendChild(el);
  setTimeout(function() {
    el.style.opacity = '0';
    setTimeout(function() { if (el.parentNode) el.remove(); }, 400);
  }, duration);
}

// ---------------------------------------------------------------------------
// ContentEditable helpers
// Work at the individual text-node level so HTML structure is never destroyed.
// ---------------------------------------------------------------------------

/**
 * Returns { node, offset } for the caret inside a text node, or null if the
 * selection is not collapsed or not anchored in a TEXT_NODE.
 */
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

// ---------------------------------------------------------------------------
// Core replacement logic
// ---------------------------------------------------------------------------

var textReplacer = function(element, wordsToReplace, typedWord, way_back) {
  'use strict';

  way_back = way_back || 0;
  if (typedWord.length === 0) return;

  const stringTyped = typedWord.join('');

  // O(1) hash lookup (was O(n) indexOf in previous versions)
  if (!(stringTyped in wordsToReplace)) return;

  // space_size accounts for the space / enter that triggered the replacement
  const space_size = 1;
  const expansion = unescape(wordsToReplace[stringTyped]);

  if (element.isContentEditable) {
    const cursor = getCursorInTextNode();
    // Bail out if the caret is not inside a text node owned by this element
    if (!cursor || !element.contains(cursor.node)) return;

    const { node, offset } = cursor;
    const text = node.textContent;

    if (way_back) {
      // Revert: the cursor sits after "expansion + trigger-char".
      // Replace that region with the original shortcut.
      const start = offset - expansion.length - space_size;
      if (start < 0) return;
      if (text.substring(start, start + expansion.length) !== expansion) return;

      node.textContent = text.substring(0, start) + stringTyped + text.substring(offset);
      setCursorAt(node, start + stringTyped.length);
    } else {
      // Forward: the cursor sits right after the typed shortcut.
      // Replace shortcut with expansion.
      const start = offset - stringTyped.length;
      if (start < 0) return;
      if (text.substring(start, offset) !== stringTyped) return;

      let replacement = expansion;
      if (start === 0 || beforeIsPoint(text, 0, start)) {
        replacement = capitalizeFirstLetter(replacement);
      }

      node.textContent = text.substring(0, start) + replacement + text.substring(offset);
      setCursorAt(node, start + replacement.length);
    }
    return;
  }

  // ---- Regular <input> / <textarea> ----

  const value = element.value;
  const initialPoint = 0;
  const finalPoint = element.textLength;
  const afterWord = element.selectionStart;
  let beforeWord, replacement;

  if (way_back) {
    beforeWord = afterWord - expansion.length - space_size;
    replacement = stringTyped;
  } else {
    beforeWord = afterWord - typedWord.length;
    replacement = expansion;
    if (beforeWord === initialPoint || beforeIsPoint(value, initialPoint, beforeWord)) {
      replacement = capitalizeFirstLetter(replacement);
    }
  }

  element.value = addTextBetween(value, initialPoint, beforeWord, afterWord, finalPoint, replacement);

  const newCursor = way_back
    ? afterWord + (stringTyped.length - expansion.length) - space_size
    : afterWord + (replacement.length - stringTyped.length);

  element.setSelectionRange(newCursor, newCursor);
};

// ---------------------------------------------------------------------------
// Element support detection
// ---------------------------------------------------------------------------

// These editor widgets intercept DOM events internally; our direct textContent
// manipulation conflicts with their virtual-DOM / model layers.
const COMPLEX_EDITOR_SELECTORS = ['.CodeMirror', '.monaco-editor', '.ace_editor'];

function isInsideComplexEditor(element) {
  return COMPLEX_EDITOR_SELECTORS.some(function(selector) {
    try { return !!element.closest(selector); } catch(e) { return false; }
  });
}

// Input types that do not accept freeform text and should be ignored
const UNSUPPORTED_INPUT_TYPES = [
  'button', 'checkbox', 'color', 'date', 'datetime-local',
  'file', 'hidden', 'image', 'month', 'radio', 'range',
  'reset', 'submit', 'time', 'week'
];

function isSupportedElement(e) {
  if (!e || !e.tagName) return false;
  const tag = e.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (e.type || 'text').toLowerCase();
    return UNSUPPORTED_INPUT_TYPES.indexOf(type) < 0;
  }
  return tag === 'textarea' || !!e.isContentEditable;
}

// ---------------------------------------------------------------------------
// Keyboard handler
// Switched from keypress to keydown so that Backspace / Escape / Arrow keys
// fire reliably in contentEditable (keypress does not fire for Backspace there).
// event.key is used in place of the deprecated event.which / charCode.
// ---------------------------------------------------------------------------

var settingUpReplacer = function() {
  'use strict';

  let word = [];
  let old_word = [];

  function handler(event) {
    // Skip synthetic events fired during IME composition (CJK input methods)
    if (event.isComposing) return;

    const key = event.key;
    const superKey = event.metaKey || event.ctrlKey;

    switch (key) {
      case 'Backspace':
        if (USE_BACKSPACE_INSTEAD_ESC && old_word.length > 0) {
          textReplacer(event.target, replaceWords, old_word, 1);
          old_word = word = [];
          event.preventDefault();
          return;
        }

        if (superKey) {
          // Ctrl/Cmd + Backspace deletes a word — our buffer is stale
          word = [];
          break;
        }

        // If the user had text selected, the selection is deleted — buffer is stale
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
        textReplacer(event.target, replaceWords, word);
        old_word = word;
        word = [];
        break;

      case 'Escape':
        if (!USE_BACKSPACE_INSTEAD_ESC && old_word.length > 0) {
          textReplacer(event.target, replaceWords, old_word, 1);
        }
        old_word = word = [];
        break;

      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        // Cursor moved — typed prefix is no longer at the caret
        word = [];
        break;

      default:
        if (key.length === 1) {
          if (superKey && (key === 'a' || key === 'A')) {
            // Ctrl/Cmd+A selects all — buffer is stale
            word = [];
          } else if (!superKey) {
            word.push(key);
          }
        }
        break;
    }
  }

  // Called when focus moves to a different element so stale prefixes don't
  // carry over and trigger accidental replacements in the new element.
  handler.reset = function() {
    word = [];
    old_word = [];
  };

  return handler;
};

const replacerFnc = settingUpReplacer();

document.body.addEventListener('focus', function(e) {
  const elem = e.target;
  if (!isSupportedElement(elem)) return;

  if (isInsideComplexEditor(elem)) {
    // Notify the user instead of silently doing nothing (old behavior was to
    // skip the element entirely via the hard-coded site block list).
    showInPageNotification('TextFast: This editor type may not support shortcuts.');
    return;
  }

  replacerFnc.reset();
  elem.addEventListener('keydown', replacerFnc, true);
}, true);

document.body.addEventListener('blur', function(e) {
  const elem = e.target;
  if (isSupportedElement(elem)) {
    elem.removeEventListener('keydown', replacerFnc, true);
  }
}, true);

// Handle the element that already has focus when the script is injected
if (document.activeElement && isSupportedElement(document.activeElement)) {
  const elem = document.activeElement;
  if (!isInsideComplexEditor(elem)) {
    elem.addEventListener('keydown', replacerFnc, true);
    elem.addEventListener('blur', function(e) {
      e.target.removeEventListener('keydown', replacerFnc, true);
    }, { once: true });
  }
}
