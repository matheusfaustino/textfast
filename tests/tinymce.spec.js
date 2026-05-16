/**
 * tests/tinymce.spec.js — smoke test that runs the built content script
 * against the local test_tinymce.html harness.
 *
 * What this test simulates faithfully:
 *  - The shipping content script (text-replacer.js) running in the TOP frame
 *    only. This mirrors the manifest's default `all_frames: false`.
 *  - A stubbed `browser.*` namespace so the script gets its word list
 *    without needing the real extension runtime.
 *
 * What it does NOT simulate:
 *  - The Firefox-vs-Chrome differences in Selection / setRangeText behavior.
 *    These tests run in Chromium. For Firefox-specific regression checks,
 *    add `firefox` to the projects list in playwright.config.js (TinyMCE
 *    works fine there too).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const TEST_PAGE   = pathToFileURL(path.resolve(__dirname, '..', 'test_tinymce.html')).href;
const SCRIPT_PATH = path.resolve(__dirname, '..', 'text-replacer.js');

const WORDS = { imc: "I'm coming" };

async function setup(page) {
  // Stub the WebExtension `browser.*` APIs in EVERY frame before any page
  // script runs. The content script is then injected ONLY into the top
  // frame, matching the manifest. TinyMCE's iframe gets the stub (harmless)
  // but does NOT get text-replacer.js.
  await page.addInitScript((words) => {
    const thenable = (v) => ({ then: (fn) => Promise.resolve(v).then(fn) });
    window.browser = {
      runtime: { sendMessage: () => thenable(words) },
      storage: {
        local:     { get: () => thenable({ can_capitalize: true, esc_cancel: false }) },
        onChanged: { addListener: () => {} },
      },
    };
  }, WORDS);

  await page.goto(TEST_PAGE);
  await page.waitForLoadState('networkidle');

  // Inject the built content script into the top frame.
  await page.addScriptTag({ path: SCRIPT_PATH });
  await page.waitForFunction(
    () => window.__textfast && Object.keys(window.__textfast.words).length > 0,
  );
}

test.describe('TextFast against test_tinymce.html', () => {
  test('plain contentEditable expands "imc "', async ({ page }) => {
    await setup(page);
    const target = page.locator('.plain-editable');
    await target.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('imc ');
    await expect(target).toContainText("I'm coming");
  });

  test('plain textarea expands "imc "', async ({ page }) => {
    await setup(page);
    const target = page.locator('textarea[rows="4"]');
    await target.click();
    await target.fill('');
    await page.keyboard.type('imc ');
    await expect(target).toHaveValue(/I'm coming/);
  });

  test('plain input expands "imc "', async ({ page }) => {
    await setup(page);
    const target = page.locator('input[type="text"]');
    await target.click();
    await target.fill('');
    await page.keyboard.type('imc ');
    await expect(target).toHaveValue(/I'm coming/);
  });

  test('TinyMCE inline mode expands "imc "', async ({ page }) => {
    await setup(page);
    await page.waitForFunction(() => window.tinymce && window.tinymce.get('tinymce-inline'));
    const target = page.locator('#tinymce-inline');
    await target.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('imc ');
    await expect(target).toContainText("I'm coming");
  });

  // Known limitation — issue #2. TinyMCE classic mode renders its editable
  // body inside an <iframe>; the content script is not injected there. We
  // assert the failure so the test will start failing the day someone fixes
  // it (e.g. by setting `all_frames: true` in the manifest + iframe handling
  // in core.js).
  test('TinyMCE classic (iframe) does NOT expand — issue #2 placeholder', async ({ page }) => {
    await setup(page);
    await page.waitForFunction(() => window.tinymce && window.tinymce.get('tinymce-classic'));
    const frame = page.frameLocator('#tinymce-classic_ifr');
    const body  = frame.locator('body');
    await body.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('imc ');

    const text = (await body.textContent()) || '';
    expect(text).toContain('imc');
    expect(text).not.toContain("I'm coming");
  });
});
