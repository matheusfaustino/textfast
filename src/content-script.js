/**
 * content-script.js — Firefox extension entry point.
 */

import { attachToDocument, createComplexEditorWarning, showNotification } from './core.js';

let replaceWords = {};
let settings = { capitalize: false, backspace: false };

function updateReplaceWords() {
  browser.runtime.sendMessage({ action: 'get_list' }).then((data) => {
    replaceWords = data || {};
    if (window.__textfast) window.__textfast.words = replaceWords;
  });
}

function loadSettings() {
  browser.storage.local.get(['can_capitalize', 'esc_cancel']).then((stored) => {
    settings = {
      capitalize: !stored.can_capitalize,
      backspace:  !!stored.esc_cancel,
    };
  });
}

updateReplaceWords();
loadSettings();

// Only react to keys this script reads; tf_warned_* writes don't need a reload.
browser.storage.onChanged.addListener((changes) => {
  if (!changes.list_words && !changes.can_capitalize && !changes.esc_cancel) return;
  updateReplaceWords();
  loadSettings();
});


window.__textfast = {
  version: '1.4.0',
  get words() { return replaceWords; },
};

const WARNED_KEY = 'tf_warned_' + location.hostname;

attachToDocument(
  () => replaceWords,
  () => settings,
  createComplexEditorWarning(
    () => browser.storage.local.get(WARNED_KEY).then((r) => r[WARNED_KEY]),
    () => browser.storage.local.set({ [WARNED_KEY]: true }),
  ),
);
