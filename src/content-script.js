/**
 * content-script.js — Firefox extension entry point.
 */

import { attachToDocument, showNotification } from './core.js';

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

browser.storage.onChanged.addListener(() => {
  updateReplaceWords();
  loadSettings();
});


window.__textfast = {
  version: '1.4.0',
  get words() { return replaceWords; },
};

attachToDocument(
  () => replaceWords,
  () => settings,
  () => showNotification('TextFast: This editor type may not support shortcuts.'),
);
