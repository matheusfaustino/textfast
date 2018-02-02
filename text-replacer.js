let replaceWords = {};
let USE_CAPITALIZE_WORDS = false;
let USE_BACKSPACE_INSTEAD_ESC = false;

function updateReplaceWords() {
  browser.runtime.sendMessage({'action': 'get_list'}).then((data) => {
    // console.log('force update', data);
    replaceWords = data;
  });
}

// get config
function canCapitalize() {
  browser.storage.local.get('can_capitalize')
  .then(can_capitalize => {
    USE_CAPITALIZE_WORDS = !can_capitalize.can_capitalize;
  })
}

function useBackspaceInsteadEsc() {
  browser.storage.local.get('esc_cancel')
  .then(esc_cancel => {
    USE_BACKSPACE_INSTEAD_ESC = esc_cancel.esc_cancel;
  })
}

// @see https://stackoverflow.com/a/33704783
function capitalizeFirstLetter(string) {
  if (USE_CAPITALIZE_WORDS)
    return string[0].toUpperCase() + string.slice(1);

  return string;
}

function beforeIsPoint(string, start, end) {
  if (!USE_CAPITALIZE_WORDS)
    return;

  let s = string.slice(start, end).trim();

  return s[s.length-1] == '.';
}

// do it manually
updateReplaceWords();
canCapitalize();
useBackspaceInsteadEsc();

// run when the storage is updated
browser.storage.onChanged.addListener(() => {
  // update words and settings
  updateReplaceWords();
  canCapitalize();
  useBackspaceInsteadEsc();
});

let BACKSPACE_KEY = 8,
    SPACE_KEY = 32,
    ENTER_KEY = 13,
    NON_ALPHANUM_KEY = 0,
    ESC_KEY = 27,
    A_SHIFT_KEY = 65,
    A_KEY = 97;

var addTextBetween = function(text, p1, p2, p3, p4, newPart) {
    return text.substr(p1, p2) + newPart + text.substr(p3, p4);
}

var textReplacer = function(element, wordsToReplace, typedWord, way_back) {
    'use strict';

    // default value
    way_back = way_back ? way_back : 0;

    if (typedWord.length == 0)
        return;

    let stringTyped = typedWord.join('');

    if (Object.keys(wordsToReplace).indexOf(stringTyped) == -1 || way_back && !Object.keys(wordsToReplace).find(key => key === stringTyped))
        return;

    let initialPoint,
      beforeWord,
      afterWord,
      finalPoint,
      replacement,
      value,
      selectionRange;

      let space_size = 1;

    if (element.isContentEditable) {
      selectionRange = document.getSelection();

      // github usa CodeMirror
      // https://stackoverflow.com/9a/24987585/3618650 - https://stackoverflow.com/a/42675264/3618650
      // https://stackoverflow.com/questions/596481/is-it-possible-to-simulate-key-press-events-programmatically/19883789#19883789

      value = element.textContent;
      initialPoint = 0;
      beforeWord = selectionRange.getRangeAt(0).endOffset - typedWord.length;
      afterWord = selectionRange.getRangeAt(0).endOffset;
      finalPoint = value.length;
      replacement = unescape(wordsToReplace[stringTyped]);

      // return to shortcut
      if (way_back) {
        // change what is needed
        beforeWord = selectionRange.getRangeAt(0).endOffset - wordsToReplace[stringTyped].length - space_size;
        replacement = stringTyped;
      }

    } else {
      // all kind of inputs

      value = element.value;
      initialPoint = 0;
      beforeWord = element.selectionStart - typedWord.length;
      afterWord = element.selectionStart;
      finalPoint = element.textLength;
      // @todo remove unescape from here
      replacement = unescape(wordsToReplace[stringTyped]);

      // return to shortcut
      if (way_back) {
        // change what is needed
        beforeWord = element.selectionStart - wordsToReplace[stringTyped].length - space_size;
        replacement = stringTyped;
      }
    }

    if (!way_back && (beforeWord == initialPoint || beforeIsPoint(value, initialPoint, beforeWord))) {
      replacement = capitalizeFirstLetter(replacement);
    }
    // console.log(value,initialPoint,beforeWord,afterWord,finalPoint,replacement);

    let newContent = addTextBetween(
        value,
        initialPoint,
        beforeWord,
        afterWord,
        finalPoint,
        replacement
    );
    // console.log(newContent);

    if (element.isContentEditable) {
      element.textContent = newContent;
    } else {
      element.value = newContent;
    }

    // console.log(element.value, element.textContent);

    let cursor;
    if (way_back) {
      cursor = afterWord + (stringTyped.length - wordsToReplace[stringTyped].length) - space_size;
    } else {
      cursor = afterWord + (replacement.length - stringTyped.length)
    }
    // console.log(cursor);

    if (element.isContentEditable) {
      let new_range = document.createRange();
      new_range.setStart(element.childNodes[0], cursor);
      new_range.setEnd(element.childNodes[0], cursor);

      selectionRange.removeAllRanges();
      selectionRange.addRange(new_range);
    } else {
      element.setSelectionRange(cursor, cursor);
    }
}

var settingUpReplacer = function() {
    'use strict';

    // init word
    let word = [];
    let old_word = [];

    return function(event) {
        let key = event.which;
        // osx's user => windows: event.ctrlKey
        let superKey = event.metaKey;

        // console.log('keypress');
        // console.log(key);

        switch(key) {
            case BACKSPACE_KEY:

              /* cancel replace using backspace */
              if (USE_BACKSPACE_INSTEAD_ESC && old_word.length > 0) {
                textReplacer(event.target, replaceWords, old_word, 1);
                old_word = word = [];

                event.preventDefault();
                return;
              }

              if (!superKey && word.length)
                  word.pop();

              if (superKey
                  // when the user select a part of the text and delete it
                  || event.target.selectionStart != event.target.selectionEnd)
                  word = [];

              break;

            case ENTER_KEY:
            case SPACE_KEY:
              textReplacer(event.target, replaceWords, word);
              old_word = word;
              word = [];
              break;

            case NON_ALPHANUM_KEY:
              // check if arrow is pressed
              // that helps cleaning the wordsToReplace
              if (event.code.toLowerCase().indexOf('arrow') >= 0)
                word = [];

              /* ESC pressed */
              // return the replaced word
              if (event.keyCode == ESC_KEY && !USE_BACKSPACE_INSTEAD_ESC) {
                if (old_word.length > 0)
                  textReplacer(event.target, replaceWords, old_word, 1);
                old_word = word = [];
              }

              break;

            default:
              if (superKey && (key == A_SHIFT_KEY || key == A_KEY))
                // cleans words, because the user selected the whole text
                word = [];
              else
                // default behavior
                word.push(String.fromCharCode(key));
              break;
        }
    }
}

/* constante which checks if the website is supported by the plugin */
const websitesNotWorking = !(window.location.href.indexOf('facebook') >= 0
    || window.location.href.indexOf('messenger') >= 0
    || window.location.href.indexOf('github') >= 0
    || window.location.href.indexOf('slack') >= 0);

function isSupportedElement(e) {
  return websitesNotWorking
      && (e.isContentEditable
      || e.tagName.toLowerCase() == 'input'
      || e.tagName.toLowerCase() == 'textarea');
}

let replacerFnc = settingUpReplacer();

document.body.addEventListener('focus', function(e) {
  let elem = e.target
  if (isSupportedElement(elem)) {
    elem.addEventListener('keypress', replacerFnc, true)
  }
}, true);

document.body.addEventListener('blur', function(e) {
  let elem = e.target
  if (isSupportedElement(elem)) {
    elem.removeEventListener('keypress', replacerFnc, true)
  }
}, true);

// page already have an element in focus
if (isSupportedElement(document.activeElement)) {
  document.activeElement.addEventListener('keypress', replacerFnc, true);
  document.activeElement.addEventListener('blur', e => e.target.removeEventListener('keypress', replacerFnc, true), true);
}
