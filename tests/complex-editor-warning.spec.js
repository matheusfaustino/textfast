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

async function open(page, host, mode, opts = {}) {
  const url = `http://${host}/p.html`;
  await page.route(url, (r) => r.fulfill({ body: FIXTURE, contentType: 'text/html' }));
  if (mode === 'addon') {
    // Persistent stub of browser.storage.local, backed by (per-origin) localStorage.
    // delayMs slows only the settings read (array keys), to race the first focus.
    await page.addInitScript((delay) => {
      const load = () => JSON.parse(localStorage.getItem('__stub') || '{}');
      window.browser = {
        runtime: { sendMessage: () => Promise.resolve({}) },
        storage: {
          local: {
            get: (k) => {
              if (typeof k === 'string') return Promise.resolve({ [k]: load()[k] });
              const r = { can_capitalize: true, ...load() };
              return delay ? new Promise((res) => setTimeout(() => res(r), delay)) : Promise.resolve(r);
            },
            set: (o) => { localStorage.setItem('__stub', JSON.stringify({ ...load(), ...o })); return Promise.resolve(); },
          },
          onChanged: { addListener: () => {} },
        },
      };
    }, opts.delayMs || 0);
  }
  await page.goto(url);
  if (opts.disableNotifications) {
    // Seed the flag where each build reads it: the add-on stub's localStorage
    // blob, or the userscript's storageGet key.
    await page.evaluate((mode) => {
      if (mode === 'addon') localStorage.setItem('__stub', JSON.stringify({ disable_notifications: true }));
      else localStorage.setItem('textfast_disable_notifications', 'true');
    }, mode);
  }
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

    test('default (option absent): warning still shows', async ({ page }) => {
      await open(page, 'c.test', mode);
      await focusEditor(page);
      await expect(page.locator(TOAST)).toHaveCount(1);
    });

    test('disable_notifications on: warning never shows', async ({ page }) => {
      await open(page, 'd.test', mode, { disableNotifications: true });
      await focusEditor(page);
      await page.waitForTimeout(300);
      // Immediate count: a retrying toHaveCount(0) would just wait out the toast.
      expect(await page.locator(TOAST).count()).toBe(0);
    });
  });
}

// Race: the stored flag is read after a delay and the editor is focused before
// it arrives. The warning must wait for the setting, not default to "on".
test('add-on: disable_notifications honored when the editor is focused before settings load', async ({ page }) => {
  // Long delay: addScriptTag plus open()'s settle wait put the first focus
  // roughly 500ms after the script starts, so the read must outlast that.
  await open(page, 'e.test', 'addon', { disableNotifications: true, delayMs: 1500 });
  await focusEditor(page);
  await page.waitForTimeout(300);
  expect(await page.locator(TOAST).count()).toBe(0);
});
