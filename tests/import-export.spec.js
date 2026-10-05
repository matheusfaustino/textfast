/**
 * tests/import-export.spec.js — regression coverage for issue #8.
 *
 * The add-on's settings page (public/config.html + public/js/config.js) is the
 * only place where export, edit and import meet. The round trip used to be
 * broken in four ways:
 *
 *   1. Import always called addNewRow(), which inserts at the TOP of the table.
 *      The pre-existing row stayed below it, and extractDataFromTable() takes
 *      the LAST row for a key, so Save() silently kept the OLD value.
 *   2. Because every import added a row, re-importing the same file grew the
 *      table without bound (duplicate keys in the table).
 *   3. Items were applied one by one, so a file that threw halfway through
 *      left the table partially rewritten.
 *   4. importJson() ran unescape() over the imported value, so a value that
 *      legitimately contained the text "%20" was turned into a space. The
 *      replacement engine (src/core.js) did the same on every expansion.
 *
 * The stub below replaces the WebExtension `browser.*` namespace with an
 * in-memory store so the real page script runs unmodified.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const CONFIG_URL = pathToFileURL(path.resolve(__dirname, '..', 'public', 'config.html')).href;
const ROWS_SELECTOR = '#replace_words tbody tr:not(.hide)';

let dialogs;

/**
 * Open the real settings page with `words` pre-loaded in browser.storage.local.
 */
async function openConfigPage(page, words, opts = {}) {
  await page.addInitScript((initial) => {
    // addInitScript re-runs on every navigation, including reloads, so the
    // in-memory stub has to be re-seeded from somewhere that survives them.
    // window.name is per browsing context and outlives a reload, unlike
    // sessionStorage on a file:// (opaque) origin.
    const MARK = 'tf-store:';
    let store;
    try {
      store = window.name.startsWith(MARK)
        ? JSON.parse(decodeURIComponent(window.name.slice(MARK.length)))
        : null;
    } catch (e) { store = null; }

    if (!store) {
      store = Object.assign({
        list_words: initial,
        // Skips the intro.js walkthrough, which would otherwise steal focus and
        // mutate the table while the test is driving it.
        tutorial_first_time: true,
        seen_ui_v14: true,
        esc_cancel: false,
        can_capitalize: false,
      });
    }

    const persist = () => { window.name = MARK + encodeURIComponent(JSON.stringify(store)); };
    const thenable = (v) => ({ then: (fn) => Promise.resolve(v).then(fn) });
    window.__tfStorage = store;
    window.browser = {
      runtime: { getURL: (p) => p, sendMessage: () => thenable({}) },
      notifications: { create: () => thenable('n') },
      storage: {
        local: {
          get: () => thenable(Object.assign({}, store)),
          set: (obj) => { Object.assign(store, obj); persist(); return thenable(); },
        },
        sync: {
          get: () => thenable({}),
          set: () => thenable(),
        },
      },
    };
    persist();
  }, words);

  await page.goto(CONFIG_URL);
  await page.waitForSelector(ROWS_SELECTOR);
  if (opts.expectRows === false) return;
  await page.waitForFunction(
    (n) => document.querySelectorAll('#replace_words tbody tr:not(.hide)').length === n,
    Object.keys(words).length,
  );
}

/** Shortcut -> value pairs currently rendered in the table, keyed (order-free). */
async function tableMap(page) {
  const rows = await tableRows(page);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

/** Shortcut -> value pairs currently rendered in the table, in row order. */
function tableRows(page) {
  return page.$$eval(ROWS_SELECTOR, (rows) => rows.map((row) => ({
    key: row.querySelector('td.replace').innerText.replace(/[\r\n]+$/, '').trim(),
    value: row.querySelector('td.word').innerText,
  })));
}

/** Click Save and return what actually landed in browser.storage.local. */
async function save(page) {
  await page.click('#save');
  await expect(page.locator('#alert-saved')).toBeVisible();
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__tfStorage.list_words)));
}

/** Click Export JSON and return the parsed payload. */
async function exportJson(page) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#export'),
  ]);
  const target = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'textfast-export-')),
    'textfast-shortcuts.json',
  );
  await download.saveAs(target);
  return JSON.parse(fs.readFileSync(target, 'utf8'));
}

/** Feed a JSON file into the hidden import input, as the Import button does. */
async function importJson(page, contents, name = 'textfast-shortcuts.json') {
  await page.setInputFiles('#import_input_file', {
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(contents, 'utf8'),
  });
  await expect(page.locator('#alert-import')).toBeVisible();
}

test.beforeEach(() => {
  dialogs = [];
});

test.describe('settings export/edit/import round trip (issue #8)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  });

  test('edited value wins the matching key after Save and reload', async ({ page }) => {
    await openConfigPage(page, { zz8: 'original literal %20 expansion' });

    const exported = await exportJson(page);
    expect(exported).toEqual([{ replace: 'zz8', with: 'original literal %20 expansion' }]);

    exported[0].with = 'edited literal %20 expansion';
    await importJson(page, JSON.stringify(exported, null, 2));

    // The existing row is updated in place — no duplicate row is added.
    expect(await tableRows(page)).toEqual([
      { key: 'zz8', value: 'edited literal %20 expansion' },
    ]);

    expect(await save(page)).toEqual({ zz8: 'edited literal %20 expansion' });
    expect(dialogs).toEqual([]);

    // Reload is the real proof: the value comes back from storage, not the DOM.
    await page.reload();
    await page.waitForSelector(ROWS_SELECTOR);
    await expect.poll(() => tableRows(page)).toEqual([
      { key: 'zz8', value: 'edited literal %20 expansion' },
    ]);
  });

  test('a key that exists only locally survives the import', async ({ page }) => {
    await openConfigPage(page, {
      zz8: 'original literal %20 expansion',
      keepme: 'local only',
    });

    await importJson(page, JSON.stringify([
      { replace: 'zz8', with: 'edited literal %20 expansion' },
    ], null, 2));

    expect(await save(page)).toEqual({
      zz8: 'edited literal %20 expansion',
      keepme: 'local only',
    });
  });

  test('importing the same file repeatedly creates no duplicate row', async ({ page }) => {
    await openConfigPage(page, { zz8: 'original', other: 'kept' });

    // Row order is not asserted: addNewRow() has always inserted at the top of
    // the table, and that placement is out of scope here. What matters is that
    // the table converges instead of growing.
    await importJson(page, JSON.stringify([
      { replace: 'zz8', with: 'imported' },
      { replace: 'brandnew', with: 'fresh' },
    ], null, 2));
    await importJson(page, JSON.stringify([
      { replace: 'zz8', with: 'imported' },
      { replace: 'brandnew', with: 'fresh' },
    ], null, 2));
    // A distinct payload proves the third import really re-ran the handler.
    await importJson(page, JSON.stringify([
      { replace: 'zz8', with: 'imported again' },
      { replace: 'brandnew', with: 'fresh' },
    ], null, 2));

    const rows = await tableRows(page);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.key)).size).toBe(3);
    expect(rows.slice().sort((a, b) => a.key.localeCompare(b.key))).toEqual([
      { key: 'brandnew', value: 'fresh' },
      { key: 'other', value: 'kept' },
      { key: 'zz8', value: 'imported again' },
    ]);
    expect(await save(page)).toEqual({
      zz8: 'imported again',
      brandnew: 'fresh',
      other: 'kept',
    });
  });

  test('duplicate rows left by older imports do not win over the imported value', async ({ page }) => {
    await openConfigPage(page, { zz8: 'original' });

    // Reproduce the damage the old import could do: a second row for the same
    // shortcut, typed by hand the way a user would.
    await page.click('#add');
    await page.locator(`${ROWS_SELECTOR} .replace`).first().click();
    await page.keyboard.type('zz8');
    await page.locator(`${ROWS_SELECTOR} .word`).first().click();
    await page.keyboard.type('stale duplicate');
    expect(await tableRows(page)).toHaveLength(2);

    await importJson(page, JSON.stringify([
      { replace: 'zz8', with: 'edited' },
    ], null, 2));

    // extractDataFromTable keeps the last row for a key, so both rows have to
    // carry the imported value for the round trip to stick.
    expect(await save(page)).toEqual({ zz8: 'edited' });
  });

  test('indentation, tabs and trailing spaces survive the whole round trip', async ({ page }) => {
    const value = '  first line\n\tsecond line   \n    third line';
    await openConfigPage(page, { code: value });

    // innerText collapses whitespace unless the cell preserves it, so this
    // asserts the table is a faithful view of the stored value, not a
    // whitespace-normalised copy of it.
    expect(await tableMap(page)).toEqual({ code: value });

    const exported = await exportJson(page);
    expect(exported).toEqual([{ replace: 'code', with: value }]);

    // Re-import over the existing row, then Save: still byte-identical.
    await importJson(page, JSON.stringify(exported, null, 2));
    expect(await save(page)).toEqual({ code: value });
  });

  test('a hand-written indented value imported as a new row keeps its whitespace', async ({ page }) => {
    await openConfigPage(page, { zz8: 'original' });

    await importJson(page, JSON.stringify([
      { replace: 'hand', with: '    indented\n\t\ttabbed  ' },
    ], null, 2));

    expect(await save(page)).toEqual({ zz8: 'original', hand: '    indented\n\t\ttabbed  ' });
    expect(await exportJson(page)).toEqual([
      { replace: 'hand', with: '    indented\n\t\ttabbed  ' },
      { replace: 'zz8', with: 'original' },
    ]);
  });

  test('the file input is cleared, so the same file can be imported again', async ({ page }) => {
    await openConfigPage(page, { zz8: 'original' });

    await importJson(page, JSON.stringify([
      { replace: 'zz8', with: 'edited' },
    ], null, 2));
    expect(await page.inputValue('#import_input_file')).toBe('');

    // Same input, same path: a rejected file has to clear it too, otherwise the
    // next pick of that file fires no change event.
    await page.setInputFiles('#import_input_file', {
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ not json', 'utf8'),
    });
    await expect.poll(() => dialogs.length).toBeGreaterThan(0);
    expect(await page.inputValue('#import_input_file')).toBe('');
  });

  test('a "__proto__" shortcut is stored as an ordinary key', async ({ page }) => {
    await openConfigPage(page, { zz8: 'original' });

    await importJson(page, JSON.stringify([
      { replace: '__proto__', with: 'proto value' },
    ], null, 2));

    // Import only edits the table; the shortcut has to survive Save as a real
    // own key instead of being swallowed by the prototype setter.
    await save(page);
    const raw = await page.evaluate(() => JSON.stringify(window.__tfStorage.list_words));
    const words = JSON.parse(raw);
    expect(Object.keys(words)).toContain('__proto__');
    expect(Object.getOwnPropertyDescriptor(words, '__proto__').value).toBe('proto value');
    expect(Object.getPrototypeOf(words)).toBe(Object.prototype);
  });

  test('a non-string value already in storage is coerced to text', async ({ page }) => {
    // legacy/synced lists can hold numbers or nulls; loading the table must not
    // throw, and must keep the coercion the old innerText assignment produced.
    await openConfigPage(page, { num: 42, nothing: null }, { expectRows: false });

    await expect.poll(() => tableMap(page), { timeout: 5000 }).toEqual({
      num: '42',
      nothing: '',
    });
    expect(await save(page)).toEqual({ num: '42', nothing: '' });
  });

  test('multi-line replacement survives export, import and Save', async ({ page }) => {
    // Value taken from example.json. Imported as a NEW row so the assertion is
    // about the imported cell itself, not about the pre-existing one.
    const value = 'First Line\nSecond Line\n';
    await openConfigPage(page, { zz8: 'original' });

    const exported = await exportJson(page);
    expect(exported).toEqual([{ replace: 'zz8', with: 'original' }]);

    await importJson(page, JSON.stringify([
      { replace: 'multiliness', with: value },
    ], null, 2));

    expect(await save(page)).toEqual({ zz8: 'original', multiliness: value });

    // Re-importing the same multi-line value over the row created above is
    // idempotent, newline included.
    await importJson(page, JSON.stringify([
      { replace: 'multiliness', with: value },
    ], null, 2));
    expect(await save(page)).toEqual({ zz8: 'original', multiliness: value });
  });

  const malformed = {
    'not JSON at all': '{ not json',
    'an object instead of an array': '{"replace":"zz8","with":"nope"}',
    'a bare string': '"just a string"',
    'a valid entry followed by a non-object': '[{"replace":"new","with":"row"}, null]',
  };

  for (const [label, contents] of Object.entries(malformed)) {
    test(`malformed file (${label}) leaves the table and the stored list untouched`, async ({ page }) => {
      await openConfigPage(page, { zz8: 'original' });

      await page.setInputFiles('#import_input_file', {
        name: 'broken.json',
        mimeType: 'application/json',
        buffer: Buffer.from(contents, 'utf8'),
      });

      await expect.poll(() => dialogs.length, { timeout: 5000 }).toBeGreaterThan(0);
      expect(dialogs[0]).toContain('Import failed');
      await expect(page.locator('#alert-import')).toBeHidden();

      expect(await tableRows(page)).toEqual([{ key: 'zz8', value: 'original' }]);
      expect(await save(page)).toEqual({ zz8: 'original' });
    });
  }

  test('literal %20 in an imported value is not decoded into a space', async ({ page }) => {
    await openConfigPage(page, { enc: 'before' });

    await importJson(page, JSON.stringify([
      { replace: 'enc', with: 'https://x.test/a%20b' },
    ], null, 2));

    expect(await save(page)).toEqual({ enc: 'https://x.test/a%20b' });

    // And the round trip back out keeps it verbatim.
    expect(await exportJson(page)).toEqual([
      { replace: 'enc', with: 'https://x.test/a%20b' },
    ]);
  });
});