// normalize how the notifications will be created in the addon
function displayNotification(msg) {
  return browser.notifications.create('', {
    'type': 'basic',
    'iconUrl': browser.extension.getURL('icon.png'),
    'title': 'TextFast Notification',
    'message': msg
  });
}

// fade out
function fadeOut(el){
  el.style.opacity = 1;

  (function fade() {
    if ((el.style.opacity -= .1) < 0) {
      el.style.display = "none";
    } else {
      requestAnimationFrame(fade);
    }
  })();
}
// fade in
function fadeIn(el, display){
  el.style.opacity = 0;
  el.style.display = display || "block";

  (function fade() {
    var val = parseFloat(el.style.opacity);
    if (!((val += .1) > 1)) {
      el.style.opacity = val;
      requestAnimationFrame(fade);
    }
  })();
}

function extractDataFromTable() {
  let data = {};

  document.querySelectorAll('#replace_words tbody tr:not(.hide)').forEach((elem) => {
    let key = elem.querySelector('td.replace');
    let value = elem.querySelector('td.word');

    if (key.textContent)
      data[key.textContent] = value.innerText;
  });

  return data;
}

function addNewRow(ev, data) {
  let template = document.querySelector('#replace_words .hide').cloneNode(true);
  // let count_elem = document.querySelectorAll('#replace_words tbody tr:not(.hide)').length;

  template.classList.remove('hide');

  if (data != null) {
    template.querySelector('td.replace').textContent = Object.keys(data)[0];
    template.querySelector('td.word').innerText = Object.values(data)[0];
  }
  else {
    template.querySelector('td.replace').textContent = '';
    template.querySelector('td.word').textContent = '';
  }
  // template.querySelector('td:first-child').textContent = count_elem + 1;

  // add new element in the beginning
  document.querySelector('#replace_words tbody').insertBefore(
    template,
    document.querySelector('#replace_words tbody tr:first-child')
    );
}

function removeDynamicElement(ev) {
  // del icon clicked
  if (ev.target.classList.contains('del')) {
    // i => td => tr
    ev.target.parentElement.parentElement.remove();
  }

  if (ev.target.classList.contains('close')) {
    ev.target.parentElement.classList.add('hide');
  }
}

function extractTextFromTableAndSave(ev) {
  let data = extractDataFromTable();
  document.querySelector('.alert-success.saved').classList.remove('hide');

  browser.storage.local.set({'list_words': data});
}

function updateTableOnLoad() {
  browser.storage.local.get('list_words').then((data) => {
    if (data.list_words)
      Object.keys(data.list_words).forEach((k) =>{
        addNewRow(null, {[k]: data.list_words[k]});
      });
  });
}

function importJson(ev) {
  document.querySelector('.alert-info.info').classList.remove('hide');

  let file = ev.target.files[0];
  if (file) {
    let reader = new FileReader();
    reader.readAsText(file, 'UTF-8');
    reader.onload = e => {
      let txt = e.target.result;
      data = JSON.parse(txt);

      data.forEach(item => {
        addNewRow(null, {[item.replace]: unescape(item.with)});
      });
    };

    reader.onerror = e => console.error(e);
  }
}

function exportJson(ev) {
  let data = [];

  document.querySelectorAll('#replace_words tbody tr:not(.hide)').forEach((elem) => {
    let key = elem.querySelector('td.replace');
    let value = elem.querySelector('td.word');

    if (key.innerText)
      data.push({
        replace: key.innerText.replace(/\n$/, ''),
        with: value.innerText
      });
  });

  let blob = new Blob([JSON.stringify(data)], {type: 'application/json', name: 'export.json'});
  let elm = document.createElement('a');
  elm.setAttribute('href', URL.createObjectURL(blob));
  elm.setAttribute('target', '_blank');
  elm.style.display = 'none';
  document.body.appendChild(elm);
  elm.click();
  document.body.removeChild(elm);
}

function tutorialTuor() {
  // ja ter exemplos na lista e depois remover
  let intro = introJs();

  // shows template as a example
  document.querySelector('#replace_words tbody tr.hide').classList.remove('hide');

  intro.setOptions({
    steps: [
      {
        intro: 'This is the page where you add yours shortcuts. The plugin will change the shortcut to the replacement when you type a SPACE, so it will check the last word you typed and changed it, if needed.',
      },
      {
        element: document.querySelector('.action-buttons'),
        intro: 'Every action is done by these buttons here.'
      },
      {
        element: document.querySelector('#replace_words'),
        intro: 'Here is where you will find your list of words. The first column is the shortcut you want to type to get substituted by the word/phrase in the second column. In the first column, the shortcut, should not have space.'
      },
      {
        element: document.querySelector('#add'),
        intro: 'Click here to add a new shortcut.'
      },
      {
        element: document.querySelector('table tbody tr .del'),
        intro: 'Click to delete the shortcut.'
      },
      {
        element: document.querySelector('#save'),
        intro: 'Click here to save you list. You don\'t have to reload the page to get the new list. Remember: You should always save the list after any modification.'
      },
      {
        element: document.querySelector('#import'),
        intro: 'Here you can import a list of shortcuts. You can use the one exported from the addon or created your own. The shortcuts imported will be append, not replace, you current list.'
      },
      {
        element: document.querySelector('#export'),
        intro: 'You can export your list to transfer your words to another computer or just to share with someone.'
      },
      {
        element: document.querySelector('#clean'),
        intro: 'You can clean your entire list to start or import a new one. Caution, it will delete all words.'
      },
      {
        element: document.querySelector('#config'),
        intro: 'Here you can upload/donwload shortcuts manually using FirefoxSync and you can change some plugin\'s behaviors.'
      },
    ]
  });

  intro.onexit(() => {
    // hide example row
    document.querySelector('#replace_words tbody tr').classList.add('hide');
    addNewRow(null, {});
  });

  intro.start();
}

function saveEscOption(e) {
  fadeOut(document.querySelector('.form-settings .alert'))
  browser.storage.local.set({'esc_cancel': e.target.checked})
  .then(_ => {
    fadeIn(document.querySelector('.form-settings .alert'))
    fadeIn(document.querySelector('.form-settings .alert'), "inline-block");
  })
}

function capitalizeOption(e) {
  fadeOut(document.querySelector('.form-settings .alert'))
  browser.storage.local.set({'can_capitalize': e.target.checked})
  .then(_ => {
    fadeIn(document.querySelector('.form-settings .alert'))
    fadeIn(document.querySelector('.form-settings .alert'), "inline-block");
  })
}

function uploadShortcuts(e) {
  browser.storage.local.get('list_words').then(local_words => {
    local_words = local_words.list_words;
    if (typeof local_words != 'undefined' && Object.keys(local_words).length !== 0)
      browser.storage.sync.set({'list_words': local_words})
        .then(_ => displayNotification('Shortcuts uploaded'))
        .then(_ => window.location.reload());
  });
}

function downloadShortcuts(e) {
  browser.storage.sync.get('list_words').then(sync_words => {
    sync_words = sync_words.list_words || {};
    sync_words = Object.assign(sync_words, extractDataFromTable());

    if (typeof sync_words != 'undefined' && Object.keys(sync_words).length !== 0)
      browser.storage.local.set({'list_words': sync_words})
        .then(_ => displayNotification('Shortcuts downloaded'))
        .then(_ => window.location.reload());
  })
}

document.querySelector('#add').addEventListener('click', addNewRow);

// it is in the document because the element is created dynamically
document.addEventListener('click', removeDynamicElement);

document.querySelector('#save').addEventListener('click', extractTextFromTableAndSave);
document.querySelector('#export').addEventListener('click', exportJson);
document.querySelector('#clean').addEventListener('click', () => {
  if (!confirm('Do you really want to clean the entire list?'))
    return false;

  browser.storage.local.set({'list_words': {}});
  window.location.reload();
});

document.querySelector('#import_input_file').addEventListener('change', importJson);

/**
 * Modal
 */
let modal = new tingle.modal({
  footer: true,
  stickyFooter: false,
  closeMethods: ['overlay', 'button', 'escape'],
  closeLabel: "Close",
  // cssClass: ['custom-class-1', 'custom-class-2'],
  onOpen: function() {
    document.querySelector('#upload_shortcuts').addEventListener('click', uploadShortcuts);
    document.querySelector('#download_shortcuts').addEventListener('click', downloadShortcuts);

    $('.js-switch').bootstrapSwitch();
    $('#esc_cancel').on('switchChange.bootstrapSwitch', saveEscOption);
    $('#can_capitalize').on('switchChange.bootstrapSwitch', capitalizeOption);
  },
  onClose: function() {
    document.querySelector('#upload_shortcuts').removeEventListener('click', uploadShortcuts);
    document.querySelector('#download_shortcuts').removeEventListener('click', downloadShortcuts);
  },
  beforeClose: function() {
      // here's goes some logic
      // e.g. save content before closing the modal
      return true; // close the modal
  }
});

modal.setContent(document.querySelector('#modal-content').innerHTML);

// add a button
modal.addFooterBtn('Close', 'tingle-btn tingle-btn--primary', _ => modal.close());

document.querySelector('#config').addEventListener('click', _ => modal.open());

window.onload = () => {
  /* initialize table with shortcuts saved */
  updateTableOnLoad();

  /* tutorial control */
  browser.storage.local.get('tutorial_first_time')
  .then((val) => {
    // first time addon
    if (Object.keys(val).length === 0) {
      tutorialTuor();
      browser.storage.local.set({'tutorial_first_time': true});
    }
  });

  /* options key */
  for (let field of ['esc_cancel', 'can_capitalize']) {
    browser.storage.local.get(field)
    .then(val => {
      if (Object.keys(val).length === 0)
        return;

      document.querySelector('#'+field).checked = val[field];
    });
  }
};
