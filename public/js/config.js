function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showAlert(id, duration) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('hide');
  if (duration) setTimeout(() => el.classList.add('hide'), duration);
}

function extractDataFromTable() {
  const data = {};
  $$('#replace_words tbody tr:not(.hide)').forEach((row) => {
    const key = row.querySelector('td.replace');
    const val = row.querySelector('td.word');
    if (key && key.textContent.trim())
      data[key.textContent.trim()] = val.innerText;
  });
  return data;
}

function addNewRow(data) {
  const template = $('#replace_words .hide').cloneNode(true);
  template.classList.remove('hide');

  if (data) {
    template.querySelector('td.replace').textContent = Object.keys(data)[0];
    template.querySelector('td.word').innerText     = Object.values(data)[0];
  } else {
    template.querySelector('td.replace').textContent = '';
    template.querySelector('td.word').textContent    = '';
  }

  const tbody = $('#replace_words tbody');
  const first = tbody.querySelector('tr:not(.hide)');
  tbody.insertBefore(template, first || null);
}

function updateTableOnLoad() {
  browser.storage.local.get('list_words').then((stored) => {
    if (stored.list_words)
      Object.entries(stored.list_words).forEach(([k, v]) => addNewRow({ [k]: v }));
  });
}

function saveList() {
  const data = extractDataFromTable();
  browser.storage.local.set({ list_words: data });
  showAlert('alert-saved', 3000);
}

function importJson(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.readAsText(file, 'UTF-8');
  reader.onload = (e) => {
    try {
      const items = JSON.parse(e.target.result);
      items.forEach((item) => {
        if (item.replace && item.with)
          addNewRow({ [item.replace]: unescape(item.with) });
      });
      showAlert('alert-import', 4000);
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
}

function exportJson() {
  const data = [];
  $$('#replace_words tbody tr:not(.hide)').forEach((row) => {
    const key = row.querySelector('td.replace');
    const val = row.querySelector('td.word');
    if (key && key.innerText.trim())
      data.push({ replace: key.innerText.trim(), with: val.innerText });
  });

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'textfast-shortcuts.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

document.addEventListener('click', (ev) => {
  if (ev.target.classList.contains('del'))
    ev.target.closest('tr').remove();
});

const modalOverlay = document.getElementById('tf-modal-overlay');
function openModal()  { modalOverlay.classList.remove('hide'); }
function closeModal() { modalOverlay.classList.add('hide'); }

modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalOverlay.classList.contains('hide')) closeModal();
});
$('#tf-modal-close').addEventListener('click', closeModal);
$('#tf-modal-done').addEventListener('click', closeModal);

function saveCheckbox(id, storageKey) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', (e) => {
    browser.storage.local.set({ [storageKey]: e.target.checked })
      .then(() => showAlert('alert-settings', 2000));
  });
}
saveCheckbox('esc_cancel',     'esc_cancel');
saveCheckbox('can_capitalize', 'can_capitalize');

function uploadShortcuts() {
  browser.storage.local.get('list_words').then((stored) => {
    const words = stored.list_words;
    if (words && Object.keys(words).length)
      browser.storage.sync.set({ list_words: words })
        .then(() => browser.notifications.create('', {
          type: 'basic',
          iconUrl: browser.runtime.getURL('../icon.png'),
          title: 'TextFast',
          message: 'Shortcuts uploaded to Firefox Sync.',
        }));
  });
}

function downloadShortcuts() {
  browser.storage.sync.get('list_words').then((synced) => {
    const merged = Object.assign(synced.list_words || {}, extractDataFromTable());
    browser.storage.local.set({ list_words: merged })
      .then(() => {
        browser.notifications.create('', {
          type: 'basic',
          iconUrl: browser.runtime.getURL('../icon.png'),
          title: 'TextFast',
          message: 'Shortcuts downloaded and merged.',
        });
        window.location.reload();
      });
  });
}

$('#upload_shortcuts').addEventListener('click', uploadShortcuts);
$('#download_shortcuts').addEventListener('click', downloadShortcuts);

$('#add').addEventListener('click', () => addNewRow(null));
$('#save').addEventListener('click', saveList);
$('#export').addEventListener('click', exportJson);
$('#import_input_file').addEventListener('change', importJson);
$('#config').addEventListener('click', openModal);

$('#clean').addEventListener('click', () => {
  if (!confirm('Delete all shortcuts? This cannot be undone.')) return;
  browser.storage.local.set({ list_words: {} });
  window.location.reload();
});

function runTutorial() {
  const templateRow = $('#replace_words tbody .hide');
  if (templateRow) {
    templateRow.classList.remove('hide');
    templateRow.querySelector('td.replace').textContent = 'imc';
    templateRow.querySelector('td.word').textContent    = "I'm coming";
  }

  const intro = introJs();
  intro.setOptions({
    steps: [
      { intro: 'Welcome to TextFast! Type a short alias and it expands to a full word, phrase or emoji when you press Space.' },
      { element: document.getElementById('action-buttons'), intro: 'All actions are here.' },
      { element: document.getElementById('replace_words'),  intro: 'Each row is a shortcut. The left cell is what you type; the right cell is what it becomes. No spaces allowed in shortcuts.' },
      { element: document.getElementById('add'),    intro: 'Click + to add a new shortcut.' },
      { element: document.querySelector('.del'),    intro: 'Click × to delete a shortcut.' },
      { element: document.getElementById('save'),   intro: 'Always save after making changes.' },
      { element: document.getElementById('import'), intro: 'Import a JSON file to bulk-load shortcuts.' },
      { element: document.getElementById('export'), intro: 'Export your list as JSON to back it up or share it.' },
      { element: document.getElementById('clean'),  intro: 'Clear the entire list. Use with caution.' },
      { element: document.getElementById('config'), intro: 'Open Settings to configure behavior and sync with Firefox.' },
    ],
  });

  intro.onexit(() => {
    if (templateRow) templateRow.classList.add('hide');
    addNewRow(null);
  });

  intro.start();
}

window.addEventListener('load', () => {
  updateTableOnLoad();

  ['esc_cancel', 'can_capitalize'].forEach((key) => {
    browser.storage.local.get(key).then((val) => {
      const el = document.getElementById(key);
      if (el && val[key] !== undefined) el.checked = val[key];
    });
  });

  browser.storage.local.get('seen_ui_v14').then((val) => {
    if (!val.seen_ui_v14)
      document.getElementById('notice-v14').classList.remove('hide');
  });
  document.getElementById('notice-v14-close').addEventListener('click', () => {
    document.getElementById('notice-v14').classList.add('hide');
    browser.storage.local.set({ seen_ui_v14: true });
  });

  browser.storage.local.get('tutorial_first_time').then((val) => {
    if (Object.keys(val).length === 0) {
      runTutorial();
      browser.storage.local.set({ tutorial_first_time: true });
    }
  });
});
