/**
 * tests/regressions.spec.js — pinned tests for the bugs fixed in 1.4.1.
 *
 * Notes on what is NOT testable here and why:
 *   - Issue #7 (shortcut containing emoji): Playwright's `keyboard.type` routes
 *     non-ASCII through `Input.insertText`, which never fires a `keydown`. Our
 *     content script only ever captures characters from `keydown`. In real
 *     usage emojis arrive via the OS emoji picker (insertText too), so the
 *     `[...key].length === 1` fix is a defense for the rare cases where a key
 *     event *is* dispatched (IMEs, custom hardware, automation). The
 *     "emoji-in-expansion" case below covers the user-visible half of the
 *     fix, which is the part real users hit.
 *
 *   - Issue #15 (CRLF preservation in textarea): the HTML spec normalizes line
 *     endings on textarea.value get/set unconditionally, so a textarea can
 *     never expose a stray \r externally. The 476e1ba commit still removes
 *     wholesale .value reassignment, which is the broader benefit (less
 *     disruption for framework listeners — issues #4 and #6). We assert that
 *     surrounding DOM siblings in a contentEditable are not disturbed, which
 *     is the equivalent invariant for the case Gmail compose actually hits.
 */
const { test, expect } = require('@playwright/test');
const { setup } = require('./helpers');

test.describe('regressions', () => {
  // Issues #1 / #14 — multi-line expansions used to be assigned via
  // node.textContent, which collapses \n to a space in contentEditable.
  test('#1/#14: multi-line expansion produces <br> in contentEditable', async ({ page }) => {
    await setup(page, { words: { ml: 'Line1\nLine2' } });
    await page.locator('#editable').click();
    await page.keyboard.type('ml ');

    const html = await page.locator('#editable').innerHTML();
    expect(html).toMatch(/Line1\s*<br[^>]*>\s*Line2/);
  });

  test('#1/#14: multi-line expansion in textarea preserves the newline', async ({ page }) => {
    await setup(page, { words: { ml: 'Line1\nLine2' } });
    await page.locator('#textarea').click();
    await page.keyboard.type('ml ');
    await expect(page.locator('#textarea')).toHaveValue('Line1\nLine2 ');
  });

  // Issue #7 — emoji in the expansion value.
  test('#7: non-BMP character in expansion is preserved', async ({ page }) => {
    await setup(page, { words: { smile: '😀' } });
    await page.locator('#textarea').click();
    await page.keyboard.type('smile ');
    await expect(page.locator('#textarea')).toHaveValue('😀 ');
  });

  // Issue #7 — the keydown filter accepts non-BMP characters. Driven via a
  // synthetic dispatch because real keyboards/Playwright don't emit keydown
  // for emoji.
  test('#7: synthetic keydown with a non-BMP key reaches word buffer', async ({ page }) => {
    await setup(page, { words: { '😀hi': 'expanded' } });

    const got = await page.evaluate(() => new Promise((resolve) => {
      const el = document.getElementById('textarea');
      el.focus();
      // Mirror the value of what the keys "would have typed" so the handler's
      // value-vs-shortcut alignment check succeeds.
      el.value = '😀hi';
      el.setSelectionRange(el.value.length, el.value.length);

      const send = (key) =>
        el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      send('😀');
      send('h');
      send('i');
      send(' ');
      // Read back after one tick.
      requestAnimationFrame(() => resolve(el.value));
    }));

    // No trailing space: synthetic keydown events don't insert characters
    // into the field the way real browser typing does — only the textReplacer
    // logic ran, and it replaced "😀hi" with "expanded".
    expect(got).toBe('expanded');
  });

  // Issue #15-adjacent — for contentEditable, the replacement must touch only
  // the matched slice; sibling DOM (e.g. an email signature in a separate
  // node) must survive intact. Mirrors what Gmail compose looks like.
  test('#15: contentEditable siblings outside the replaced range are untouched', async ({ page }) => {
    await setup(page);

    await page.evaluate(() => {
      const e = document.getElementById('editable');
      e.innerHTML = 'hello imc<br><span class="sig" data-keep="yes">my signature</span>';
      // Place the cursor at the end of the first text node ("hello imc").
      const sel = window.getSelection();
      const range = document.createRange();
      range.setStart(e.firstChild, e.firstChild.textContent.length);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      e.focus();
    });
    await page.keyboard.type(' ');  // wait — we need to retype the shortcut so word[] is populated

    // The keydown handler only knows what was typed since focus; we have to
    // place the cursor *before* the 'imc' substring and retype it.
    await page.evaluate(() => {
      const e = document.getElementById('editable');
      e.firstChild.textContent = 'hello ';
      const sel = window.getSelection();
      const range = document.createRange();
      range.setStart(e.firstChild, e.firstChild.textContent.length);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      e.focus();
    });
    await page.keyboard.type('imc ');

    // The signature sibling must still be present and unchanged.
    const sigText  = await page.locator('#editable .sig').textContent();
    const sigAttr  = await page.locator('#editable .sig').getAttribute('data-keep');
    const fullText = await page.locator('#editable').textContent();

    expect(sigText).toBe('my signature');
    expect(sigAttr).toBe('yes');
    expect(fullText).toContain("I'm coming");
  });
});
