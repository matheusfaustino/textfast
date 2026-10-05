/**
 * tests/userscript-panel.spec.js — the userscript settings panel's import path
 * (issue #8 follow-ups).
 *
 * The panel is the one shipped in textfast.user.js / textfast.ferdium.js and it
 * has its own import implementation (src/settings-panel.js), separate from the
 * add-on's public/js/config.js. It persists straight away — there is no Save
 * button — so the assertions read localStorage.
 *
 * Two things are stubbed:
 *   - `document.createElement` records the file input the panel builds and
 *     replaces its .click() with a no-op, so the test can hand the panel a File
 *     through the real change handler instead of a native picker dialog.
 *   - Shortcuts are seeded into localStorage under the userscript's own key.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const USERSCRIPT_PATH = path.resolve(__dirname, '..', 'textfast.user.js');
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'playground.html'), 'utf8');
const PAGE_URL = 'https://textfast.test/userscript-panel.html';
const STORAGE_KEY = 'textfast_list_words';

/**
 * Load the built userscript with `words` stored, and open its Alt+Shift+T panel.
 */
async function openPanel(page, words) {
  await page.addInitScript((initial) => {
    window.__tfCreated = [];
    const createElement = document.createElement.bind(document);
    document.createElement = (tag, ...rest) => {
      const el = createElement(tag, ...rest);
      // The panel assigns input.type = 'file' *after* creating the element, so
      // the type can only be checked when click() runs.
      const native = el.click.bind(el);
      el.click = () => { if (el.type !== 'file') native(); };
      window.__tfCreated.push(el);
      return el;
    };
    localStorage.setItem('textfast_list_words', JSON.stringify(initial));
  }, words);

  await page.route(PAGE_URL, (route) => route.fulfill({ body: FIXTURE, contentType: 'text/html' }));
  await page.goto(PAGE_URL);
  await page.addScriptTag({ path: USERSCRIPT_PATH });

  await page.keyboard.press('Alt+Shift+KeyT');
  await page.waitForSelector('#tf-panel-overlay');
  await expect(page.locator('#tf-panel-overlay tbody tr')).toHaveCount(Object.keys(words).length);
}

/**
 * Stored shortcuts, parsed exactly the way the userscript reads them back
 * (storageGet does a plain JSON.parse, which creates a "__proto__" member as an
 * ordinary own property — no reviver or prototype juggling involved).
 */
function storedWords(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return JSON.parse(raw === null ? '{}' : raw);
  }, STORAGE_KEY);
}

/** Shortcut -> value pairs rendered in the panel table. */
function panelRows(page) {
  return page.$$eval('#tf-panel-overlay tbody tr', (rows) => rows.map((row) => {
    const cells = row.querySelectorAll('td');
    return { key: cells[0].textContent, value: cells[1].textContent };
  }));
}

/** Feed a JSON file to the panel's file input and wait for its notification. */
async function importIntoPanel(page, contents) {
  await page.evaluate(() => {
    const prev = document.getElementById('tf-notification');
    if (prev) prev.remove();
  });

  // Import JSON builds a detached file input and clicks it; the stubbed click is
  // a no-op, so the test hands the file over through the real change handler.
  await page.getByRole('button', { name: 'Import JSON' }).click();
  await page.waitForFunction(
    () => window.__tfCreated.some((el) => el.tagName === 'INPUT' && el.type === 'file'),
  );

  await page.evaluate((text) => {
    const inputs = window.__tfCreated.filter((el) => el.tagName === 'INPUT' && el.type === 'file');
    const input = inputs[inputs.length - 1];
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], 'textfast-shortcuts.json', { type: 'application/json' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
  }, contents);

  await page.waitForFunction(() => !!document.getElementById('tf-notification'));
  return page.evaluate(() => document.getElementById('tf-notification').textContent);
}

test.describe('userscript panel import (issue #8)', () => {
  test('an imported value overwrites the matching shortcut and keeps local-only ones', async ({ page }) => {
    await openPanel(page, { zz8: 'original literal %20 expansion', keepme: 'local only' });

    const notice = await importIntoPanel(page, JSON.stringify([
      { replace: 'zz8', with: 'edited literal %20 expansion' },
    ], null, 2));

    expect(notice).toContain('Imported 1 shortcut');
    expect(await storedWords(page)).toEqual({
      zz8: 'edited literal %20 expansion',
      keepme: 'local only',
    });
    expect(await panelRows(page)).toEqual(expect.arrayContaining([
      { key: 'zz8', value: 'edited literal %20 expansion' },
      { key: 'keepme', value: 'local only' },
    ]));
  });

  test('a malformed file changes nothing', async ({ page }) => {
    await openPanel(page, { zz8: 'original' });

    for (const contents of [
      '{ not json',
      '{"replace":"zz8","with":"object instead of array"}',
      '[{"replace":"new","with":"row"}, null]',
    ]) {
      const notice = await importIntoPanel(page, contents);
      expect(notice).toContain('Import failed');
      expect(await storedWords(page)).toEqual({ zz8: 'original' });
      expect(await panelRows(page)).toEqual([{ key: 'zz8', value: 'original' }]);
    }
  });

  test('re-importing the same payload creates no duplicate row', async ({ page }) => {
    await openPanel(page, { other: 'kept' });
    const file = JSON.stringify([
      { replace: 'zz8', with: 'imported' },
      { replace: 'brandnew', with: 'fresh' },
    ], null, 2);

    for (let i = 0; i < 3; i++) await importIntoPanel(page, file);

    const rows = await panelRows(page);
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.key)).size).toBe(3);
    expect(await storedWords(page)).toEqual({
      other: 'kept',
      zz8: 'imported',
      brandnew: 'fresh',
    });
  });

  test('literal percent escapes are stored verbatim', async ({ page }) => {
    await openPanel(page, { enc: 'before' });

    await importIntoPanel(page, JSON.stringify([
      { replace: 'enc', with: 'https://x.test/a%20b?u=%C3%A9' },
    ], null, 2));

    expect(await storedWords(page)).toEqual({ enc: 'https://x.test/a%20b?u=%C3%A9' });
  });

  test('a "__proto__" shortcut is stored as an ordinary key', async ({ page }) => {
    await openPanel(page, { zz8: 'original' });

    await importIntoPanel(page, JSON.stringify([
      { replace: '__proto__', with: 'proto value' },
    ], null, 2));

    const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(JSON.parse(raw)).toHaveProperty(['__proto__'], 'proto value');
    expect(Object.getPrototypeOf(JSON.parse(raw))).toBe(Object.prototype);
  });
});