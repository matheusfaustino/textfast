/**
 * TinyMCE integration checks for the built add-on and userscript bundles.
 * The add-on test applies the manifest's frame policy while stubbing browser
 * storage; it does not install the extension in the browser.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const TEST_HTML   = fs.readFileSync(path.resolve(__dirname, '..', 'test_tinymce.html'), 'utf8');
const TEST_URL = 'https://textfast.test/test_tinymce.html';
const SCRIPT_PATH = path.resolve(__dirname, '..', 'text-replacer.js');
const USERSCRIPT_PATH = path.resolve(__dirname, '..', 'textfast.user.js');
const MANIFEST = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'manifest.json'), 'utf8'));

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

  await page.route(TEST_URL, (route) => route.fulfill({ body: TEST_HTML, contentType: 'text/html' }));
  await page.goto(TEST_URL);
  await page.waitForLoadState('networkidle');

  // Inject the built content script into the top frame.
  await page.addScriptTag({ path: SCRIPT_PATH });
  await page.waitForFunction(
    () => window.__textfast && Object.keys(window.__textfast.words).length > 0,
  );
}

async function typeClassicShortcut(page) {
  await page.waitForFunction(() => window.tinymce && window.tinymce.get('tinymce-classic'));
  const body = page.frameLocator('#tinymce-classic_ifr').locator('body');
  await body.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type('imc ');
  return body;
}

async function setupAddon(page) {
  await setup(page);

  // Mirror the Firefox content_scripts frame policy. Blank and srcdoc frames
  // require both flags. Content scripts are installed before input begins.
  const contentScript = MANIFEST.content_scripts.find((entry) => entry.js.includes('text-replacer.js'));
  const injectIntoFrames = contentScript && contentScript.all_frames
    && contentScript.match_about_blank;
  if (injectIntoFrames) {
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      await frame.addScriptTag({ path: SCRIPT_PATH });
      await frame.waitForFunction(() => window.__textfast && Object.keys(window.__textfast.words).length > 0);
    }
  }
}

async function setupUserscript(page) {
  await page.addInitScript((words) => {
    window.GM_getValue = () => JSON.stringify(words);
    window.GM_setValue = () => {};
    window.GM_registerMenuCommand = () => {};
  }, WORDS);
  await page.route(TEST_URL, (route) => route.fulfill({ body: TEST_HTML, contentType: 'text/html' }));
  await page.goto(TEST_URL);
  await page.waitForLoadState('networkidle');

  // Simulate the userscript manager injecting the full bundle into the page
  // document only. The bundle must discover and support same-origin editor
  // iframes from this top-page installation.
  await page.addScriptTag({ path: USERSCRIPT_PATH });
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

  test('add-on content-script policy expands shortcuts in TinyMCE classic mode', async ({ page }) => {
    await setupAddon(page);
    const body = await typeClassicShortcut(page);
    await expect(body).toContainText("I'm coming");
  });

  test('userscript bundle expands shortcuts in TinyMCE classic mode from the top page', async ({ page }) => {
    await setupUserscript(page);
    const body = await typeClassicShortcut(page);
    await expect(body).toContainText("I'm coming");
  });
});
