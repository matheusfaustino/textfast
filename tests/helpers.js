/**
 * tests/helpers.js — shared Playwright setup.
 *
 * Approach: we don't load the actual unpacked extension (it's a Firefox MV2
 * extension and Chromium's MV2 support is dead-ended). Instead we stub the
 * `browser.*` namespace, then inject the built content script (text-replacer.js)
 * into the top frame only — which is exactly how the manifest's default
 * `all_frames: false` would behave in production.
 *
 * This catches every regression in the replacement engine itself (DOM/Selection/
 * setRangeText quirks) without depending on the extension shell.
 */
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT        = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT, 'text-replacer.js');

function fixtureUrl(name) {
  return pathToFileURL(path.join(__dirname, 'fixtures', name)).href;
}

/**
 * Load a fixture page with the content script attached.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [opts]
 * @param {string} [opts.fixture='playground.html']
 * @param {object} [opts.words]      shortcuts dictionary
 * @param {boolean} [opts.capitalize]  enable auto-capitalize (default false)
 * @param {boolean} [opts.escCancel]   enable backspace-as-undo (default false)
 */
async function setup(page, opts = {}) {
  const fixture    = opts.fixture    || 'playground.html';
  const words      = opts.words      || { imc: "I'm coming" };
  const capitalize = opts.capitalize || false;
  const escCancel  = opts.escCancel  || false;

  // can_capitalize is the UI-storage flag; capitalize feature is enabled when
  // can_capitalize is falsy (see src/content-script.js loadSettings).
  const stored = { can_capitalize: !capitalize, esc_cancel: escCancel };

  await page.addInitScript(({ words, stored }) => {
    const thenable = (v) => ({ then: (fn) => Promise.resolve(v).then(fn) });
    window.browser = {
      runtime: { sendMessage: () => thenable(words) },
      storage: {
        local:     { get: () => thenable(stored) },
        onChanged: { addListener: () => {} },
      },
    };
  }, { words, stored });

  await page.goto(fixtureUrl(fixture));
  await page.waitForLoadState('networkidle');
  await page.addScriptTag({ path: SCRIPT_PATH });
  await page.waitForFunction(() => window.__textfast && window.__textfast.words);
  // Settings load is async — wait one frame so loadSettings's then() resolves.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
}

module.exports = { setup, fixtureUrl, SCRIPT_PATH, ROOT };
