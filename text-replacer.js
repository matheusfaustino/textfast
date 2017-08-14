let replaceWords = {};

function updateReplaceWords() {
  browser.runtime.sendMessage({'action': 'get_list'}).then((data) => {
    console.log('force update', data);
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

    let initialPoint = 0,
        beforeWord = element.selectionStart - typedWord.length,
        afterWord = element.selectionStart,
        finalPoint = element.textLength,
        // @todo remove unescape from here
        replacement = unescape(wordsToReplace[stringTyped]);

    let newContent = addTextBetween(
        element.value,
        initialPoint,
        beforeWord,
        afterWord,
        finalPoint,
        replacement
    );

    element.value = newContent;

    let cursor = afterWord + (replacement.length - stringTyped.length);
    element.setSelectionRange(cursor, cursor);
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


document.querySelectorAll('input, textarea').forEach(function(i) {
  // to remove an event the callback has to be the same
  let replacerFnc = settingUpReplacer();

  i.addEventListener('focus', function(e) {
      // console.log('focus', e.target);
      // @todo: test the function using just the selectionStart|End, without capturing the user key
      e.target.addEventListener('keypress', replacerFnc, true);
  });

  i.addEventListener('blur', function(e) {
      // console.log('blur', e.target);
      e.target.removeEventListener('keypress', replacerFnc, true);
  });

  if (document.activeElement == i) {
    // element has focus without user iteration
    // console.log('activeElement', i);
    i.addEventListener('keypress', replacerFnc, true);
  }
})
