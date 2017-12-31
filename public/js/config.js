function addNewRow(ev, data) {
  let template = document.querySelector('#replace_words .hide').cloneNode(true);
  // let count_elem = document.querySelectorAll('#replace_words tbody tr:not(.hide)').length;

  template.classList.remove('hide');

  if (data != null) {
    template.querySelector('td.replace').textContent = Object.keys(data)[0];
    template.querySelector('td.word').textContent = Object.values(data)[0];
  }
  else {
    template.querySelector('td.replace').textContent = '';
    template.querySelector('td.word').textContent = '';
  }
  // template.querySelector('td:first-child').textContent = count_elem + 1;

  document.querySelector('#replace_words tbody').appendChild(template);
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
  let data = {};
  document.querySelector('.alert-success').classList.remove('hide');

  document.querySelectorAll('#replace_words tbody tr:not(.hide)').forEach((elem) => {
    let key = elem.querySelector('td.replace');
    let value = elem.querySelector('td.word');

    if (key.textContent)
      data[key.textContent] = value.textContent;
  });

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
  document.querySelector('.alert-info').classList.remove('hide');

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

    if (key.textContent)
      data.push({
        replace: key.textContent,
        with: value.textContent
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
    ]
  });

  intro.onexit(() => {
    // hide example row
    document.querySelector('#replace_words tbody tr').classList.add('hide');
    addNewRow(null, {});
  });

  intro.start();
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
};
