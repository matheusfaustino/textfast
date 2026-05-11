/**
 * userscript.js — standalone entry point.
 *
 * Works in two contexts from the same built file:
 *
 *  1. Tampermonkey / Violentmonkey / Greasemonkey
 *     Install textfast.user.js as a userscript. GM_getValue / GM_setValue
 *     are used for persistent storage.
 *
 *  2. Ferdium (or any Electron app) custom JS injection
 *     Paste the contents of textfast.user.js into the service's "Custom JS"
 *     field, or require() textfast.ferdium.js from the recipe's user.js.
 *     GM_* APIs are not available there; the script falls back to localStorage.
 *
 * Open the settings panel with Alt+Shift+T (or via the Tampermonkey menu).
 */

import { attachToDocument, showNotification } from './core.js';
import { createSettingsPanel } from './settings-panel.js';

// ---------------------------------------------------------------------------
// Storage adapter
// Prefers GM_* when available (Tampermonkey), falls back to localStorage.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'textfast_list_words';

function storageGet(defaultValue) {
  let raw;
  if (typeof GM_getValue !== 'undefined') {        // eslint-disable-line no-undef
    raw = GM_getValue(STORAGE_KEY, null);          // eslint-disable-line no-undef
  } else {
    raw = localStorage.getItem(STORAGE_KEY);
  }
  if (!raw) return defaultValue;
  try { return JSON.parse(raw); } catch (e) { return defaultValue; }
}

function storageSet(obj) {
  const json = JSON.stringify(obj);
  if (typeof GM_setValue !== 'undefined') {        // eslint-disable-line no-undef
    GM_setValue(STORAGE_KEY, json);               // eslint-disable-line no-undef
  } else {
    localStorage.setItem(STORAGE_KEY, json);
  }
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let replaceWords = storageGet({});
const settings = { capitalize: false, backspace: false };

// ---------------------------------------------------------------------------
// Attach replacement engine
// ---------------------------------------------------------------------------

attachToDocument(
  () => replaceWords,
  () => settings,
  () => showNotification('TextFast: This editor type may not support shortcuts.'),
);

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

const panel = createSettingsPanel({
  getWords:  () => replaceWords,
  saveWords: (obj) => { replaceWords = obj; storageSet(obj); },
  notify:    (msg) => showNotification(msg),
});

// Alt+Shift+T
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.shiftKey && e.key === 'T') panel.toggle();
}, true);

// Tampermonkey menu entry (silently skipped if API is unavailable)
if (typeof GM_registerMenuCommand !== 'undefined') { // eslint-disable-line no-undef
  GM_registerMenuCommand('TextFast settings (Alt+Shift+T)', panel.open); // eslint-disable-line no-undef
}
