let replaceWords = {};

function updateReplaceWords() {
  browser.runtime.sendMessage({'action': 'get_list'}).then((data) => {
    // console.log('force update', data);
    replaceWords = data;
  });
}

// do it manually
updateReplaceWords();

// run when the storage is updated
browser.storage.onChanged.addListener(() => {
  // update words
  updateReplaceWords();
});

let BACKSPACE_KEY = 8,
    SPACE_KEY = 32,
    ENTER_KEY = 13,
    NON_ALPHANUM_KEY = 0,
    A_SHIFT_KEY = 65,
    A_KEY = 97;

var addTextBetween = function(text, p1, p2, p3, p4, newPart) {
    return text.substr(p1, p2) + newPart + text.substr(p3, p4);
}

var textReplacer = function(element, wordsToReplace, typedWord) {
    'use strict';

    if (typedWord.length == 0)
        return;

    let stringTyped = typedWord.join('');

    if (Object.keys(wordsToReplace).indexOf(stringTyped) == -1)
        return;

    let initialPoint,
      beforeWord,
      afterWord,
      finalPoint,
      replacement,
      value,
      selectionRange,
      parentElem;

    if (element.isContentEditable) {
      selectionRange = document.getSelection();

      // github usa CodeMirror
      // https://stackoverflow.com/9a/24987585/3618650 - https://stackoverflow.com/a/42675264/3618650
      // https://stackoverflow.com/questions/596481/is-it-possible-to-simulate-key-press-events-programmatically/19883789#19883789

      let space_size = 1;
      value = element.textContent;
      initialPoint = 0;
      beforeWord = selectionRange.getRangeAt(0).endOffset - typedWord.length;
      afterWord = selectionRange.getRangeAt(0).endOffset;
      finalPoint = value.length;
      replacement = unescape(wordsToReplace[stringTyped]);

    } else {

      parentElem = element;
      value = element.value;
      initialPoint = 0;
      beforeWord = element.selectionStart - typedWord.length;
      afterWord = element.selectionStart;
      finalPoint = element.textLength;
      // @todo remove unescape from here
      replacement = unescape(wordsToReplace[stringTyped]);
    }

    // console.log(value,initialPoint,beforeWord,afterWord,finalPoint,replacement/*,selectionRange*/);

    let newContent = addTextBetween(
        value,
        initialPoint,
        beforeWord,
        afterWord,
        finalPoint,
        replacement
    );

    if (element.isContentEditable) {
      element.textContent = newContent;
    } else {
      element.value = newContent;
    }

    let cursor = afterWord + (replacement.length - stringTyped.length);

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

// @todo: find a better name
var settingUpReplacer = function() {
    'use strict';

    // init word
    let word = [];

    return function(event) {
        let key = event.which;
        // osx's user => windows: event.ctrlKey
        let superKey = event.metaKey;

        // console.log('keypress')

        switch(key) {
            case BACKSPACE_KEY:
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
              word = [];
              break;

            case NON_ALPHANUM_KEY:
              // check if arrow is pressed
              // that helps cleaning the words
              if (event.code.toLowerCase().indexOf('arrow'))
                word = [];

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

function isSupportedElement(e) {
  return e.isContentEditable
      || e.tagName.toLowerCase() == 'input'
      || e.tagName.toLowerCase() == 'textarea';
}

let replacerFnc = settingUpReplacer();

document.body.addEventListener('focus', function(e) {
  let elem = e.target
  if (isSupportedElement(elem)) {
    // console.log('added event', elem);
    elem.addEventListener('keypress', replacerFnc, true)
  }
}, true);

document.body.addEventListener('blur', function(e) {
  let elem = e.target
  if (isSupportedElement(elem)) {
    // console.log('removed event', elem);
    elem.removeEventListener('keypress', replacerFnc, true)
  }
}, true)
