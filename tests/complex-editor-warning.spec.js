/**
 * tests/complex-editor-warning.spec.js — the "editor type may not support
 * shortcuts" toast shows at most once per site, persisted across reloads.
 * Uses http://*.test URLs (routed) so location.hostname is meaningful.
 */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { SCRIPT_PATH, ROOT } = require('./helpers');

const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'playground.html'), 'utf8');
const USERSCRIPT_PATH = path.join(ROOT, 'textfast.user.js');
const TOAST = '#tf-notification';

async function open(page, host, mode) {
  const url = `http://${host}/p.html`;
  await page.route(url, (r) => r.fulfill({ body: FIXTURE, contentType: 'text/html' }));
  if (mode === 'addon') {
    // Persistent stub of browser.storage.local, backed by (per-origin) localStorage.
    await page.addInitScript(() => {
      const load = () => JSON.parse(localStorage.getItem('__stub') || '{}');
      window.browser = {
        runtime: { sendMessage: () => Promise.resolve({}) },
        storage: {
          local: {
            get: (k) => Promise.resolve(typeof k === 'string' ? { [k]: load()[k] } : { can_capitalize: true }),
            set: (o) => { localStorage.setItem('__stub', JSON.stringify({ ...load(), ...o })); return Promise.resolve(); },
          },
          onChanged: { addListener: () => {} },
        },
      };
    });
  }
  await page.goto(url);
  await page.addScriptTag({ path: mode === 'addon' ? SCRIPT_PATH : USERSCRIPT_PATH });
  await page.waitForTimeout(100);
}

async function focusEditor(page) {
  const ed = page.locator('#complex-editable');
  await ed.focus();
  await page.locator('#input').focus();
  await ed.focus();
}

for (const mode of ['addon', 'userscript']) {
  test.describe(`complex editor warning (${mode})`, () => {
    test('shown once per page, not again after reload, again on another host', async ({ page }) => {
      await open(page, 'a.test', mode);
      await focusEditor(page);
      await expect(page.locator(TOAST)).toHaveCount(1);
      await expect(page.locator(TOAST)).toHaveCount(0, { timeout: 6000 });
      await focusEditor(page);
      await page.waitForTimeout(300);
      // Immediate count: a retrying toHaveCount(0) would just wait out the toast.
      expect(await page.locator(TOAST).count()).toBe(0);

      await page.reload();
      await page.addScriptTag({ path: mode === 'addon' ? SCRIPT_PATH : USERSCRIPT_PATH });
      await focusEditor(page);
      await page.waitForTimeout(300);
      // Immediate count: a retrying toHaveCount(0) would just wait out the toast.
      expect(await page.locator(TOAST).count()).toBe(0);

      // localStorage is per-origin, so a different host starts fresh.
      await page.unroute('http://a.test/p.html');
      await open(page, 'b.test', mode);
      await focusEditor(page);
      await expect(page.locator(TOAST)).toHaveCount(1);
    });
  });
}
