function addNewRow(ev, data) {
  let template = document.querySelector('#replace_words .hide').cloneNode(true);
  // let count_elem = document.querySelectorAll('#replace_words tbody tr:not(.hide)').length;

  template.classList.remove('hide');

  if (data != null) {
    template.querySelector('td.replace').textContent = Object.keys(data)[0];
    template.querySelector('td.word').textContent = Object.values(data)[0];
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

  browser.storage.local.set({'list_words': data})
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

document.querySelector('#add').addEventListener('click', addNewRow);

// it is in the document because the element is created dynamically
document.addEventListener('click', removeDynamicElement);

document.querySelector('#save').addEventListener('click', extractTextFromTableAndSave);
document.querySelector('#export').addEventListener('click', exportJson);
document.querySelector('#clean').addEventListener('click', () => {
  browser.storage.local.set({'list_words': {}});
  window.location.reload();
});

document.querySelector('#import_input_file').addEventListener('change', importJson);

window.onload = updateTableOnLoad;
