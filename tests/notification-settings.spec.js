/**
 * tests/notification-settings.spec.js — the "disable notifications" option.
 *
 * (c) The settings page checkbox persists `disable_notifications` and reloads
 *     checked. The browser.* namespace is a stub, as in import-export.spec.js.
 * (d) background.js displayNotification() creates no notification when the
 *     option is on, and does when it is absent. background.js is a plain
 *     script with no imports, so it is run with a stubbed `browser` global and
 *     its onInstalled listener is driven directly.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { test, expect } = require('@playwright/test');

const CONFIG_URL = pathToFileURL(path.resolve(__dirname, '..', 'public', 'config.html')).href;
const BACKGROUND_SRC = fs.readFileSync(path.resolve(__dirname, '..', 'background.js'), 'utf8');

test.describe('disable notifications setting (config page)', () => {
  test('checkbox persists disable_notifications and reloads checked', async ({ page }) => {
    await page.addInitScript(() => {
      // window.name survives reloads on the file:// origin; see import-export.spec.js.
      const MARK = 'tf-store:';
      let store = null;
      try {
        if (window.name.startsWith(MARK)) store = JSON.parse(decodeURIComponent(window.name.slice(MARK.length)));
      } catch (e) { store = null; }
      if (!store) store = { list_words: {}, tutorial_first_time: true, seen_ui_v14: true };
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
          sync: { get: () => thenable({}), set: () => thenable() },
        },
      };
      persist();
    });

    await page.goto(CONFIG_URL);
    await page.waitForSelector('#config', { state: 'visible' });
    await page.locator('#config').click();
    const box = page.locator('#disable_notifications');
    await expect(box).not.toBeChecked();
    // The input itself is 0x0 (the styled track is the control), so click its label.
    await page.getByText('Disable TextFast notifications').click();
    await expect(page.locator('#alert-settings')).toBeVisible();
    expect(await page.evaluate(() => window.__tfStorage.disable_notifications)).toBe(true);

    await page.reload();
    await page.waitForSelector('#config', { state: 'visible' });
    await page.waitForFunction(() => document.getElementById('disable_notifications').checked);
    await page.locator('#config').click();
    await expect(page.locator('#disable_notifications')).toBeChecked();
  });
});

// Runs background.js in the page with a stubbed `browser` and returns how many
// notifications.create calls were made after the update notice fires.
async function runUpdateNotice(page, stored) {
  await page.goto('about:blank');
  return page.evaluate(async ({ src, stored }) => {
    const created = [];
    const thenable = (v) => Promise.resolve(v);
    const store = Object.assign({ list_words: { a: 'b' } }, stored);
    let installed = null;
    const stub = {
      browserAction: { onClicked: { addListener() {} } },
      tabs: { create() {} },
      runtime: {
        onMessage: { addListener() {} },
        onInstalled: { addListener: (fn) => { installed = fn; } },
        getURL: (p) => p,
        getManifest: () => ({ version: '1.4.2' }),
      },
      notifications: {
        create: (id, opts) => { created.push(opts); return thenable('n'); },
        onClicked: { addListener() {} },
      },
      storage: {
        local: {
          get: (k) => thenable({ [k]: store[k] }),
          set: (obj) => { Object.assign(store, obj); return thenable(); },
        },
      },
    };
    new Function('browser', src)(stub);
    installed({ reason: 'update' });
    await new Promise((r) => setTimeout(r, 50));
    return { count: created.length, flag: store.last_notified_version };
  }, { src: BACKGROUND_SRC, stored });
}

test.describe('disable notifications setting (background.js)', () => {
  test('update notice is created when the option is absent', async ({ page }) => {
    const r = await runUpdateNotice(page, {});
    expect(r.count).toBe(1);
    expect(r.flag).toBe('1.4.2');
  });

  test('update notice is not created when the option is on, but still recorded', async ({ page }) => {
    const r = await runUpdateNotice(page, { disable_notifications: true });
    expect(r.count).toBe(0);
    expect(r.flag).toBe('1.4.2');
  });
});
