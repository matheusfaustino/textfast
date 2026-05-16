/**
 * tests/settings.spec.js — coverage for the user settings.
 *
 * Semantics (from src/core.js + src/content-script.js):
 *   stored.esc_cancel = false (default)  → ESC undoes, Backspace deletes normally
 *   stored.esc_cancel = true             → Backspace undoes, ESC does nothing
 *   stored.can_capitalize = false (default) → auto-capitalize is ON
 *   stored.can_capitalize = true            → auto-capitalize is OFF
 *
 * helpers.setup exposes these as `capitalize` and `escCancel` directly, so a
 * test that wants Backspace-undo passes escCancel: true.
 */
const { test, expect } = require('@playwright/test');
const { setup } = require('./helpers');

test.describe('capitalize setting', () => {
  test('ON: expansion at start of field is capitalized', async ({ page }) => {
    await setup(page, { capitalize: true, words: { hello: 'hello there' } });
    await page.locator('#input').click();
    await page.keyboard.type('hello ');
    await expect(page.locator('#input')).toHaveValue('Hello there ');
  });

  test('ON: expansion after a period is capitalized', async ({ page }) => {
    await setup(page, { capitalize: true, words: { hello: 'hello there' } });
    await page.locator('#textarea').click();
    await page.keyboard.type('First. hello ');
    await expect(page.locator('#textarea')).toHaveValue('First. Hello there ');
  });

  test('OFF: expansion is verbatim regardless of position', async ({ page }) => {
    await setup(page, { capitalize: false, words: { hello: 'hello there' } });
    await page.locator('#input').click();
    await page.keyboard.type('hello ');
    await expect(page.locator('#input')).toHaveValue('hello there ');
  });
});

test.describe('Backspace undo (escCancel = true)', () => {
  test('Backspace right after expansion restores the shortcut', async ({ page }) => {
    await setup(page, { escCancel: true });
    await page.locator('#input').click();
    await page.keyboard.type('imc ');
    await page.keyboard.press('Backspace');
    await expect(page.locator('#input')).toHaveValue('imc');
  });

  test('Backspace works in textarea too', async ({ page }) => {
    await setup(page, { escCancel: true });
    await page.locator('#textarea').click();
    await page.keyboard.type('imc ');
    await page.keyboard.press('Backspace');
    await expect(page.locator('#textarea')).toHaveValue('imc');
  });

  test('after one undo, further Backspaces delete characters normally', async ({ page }) => {
    await setup(page, { escCancel: true });
    await page.locator('#textarea').click();
    await page.keyboard.type('imc ');
    await page.keyboard.press('Backspace');           // undoes → "imc"
    await page.keyboard.press('Backspace');           // normal delete → "im"
    await expect(page.locator('#textarea')).toHaveValue('im');
  });
});

test.describe('ESC undo (escCancel = false, the default)', () => {
  test('ESC right after expansion restores the shortcut', async ({ page }) => {
    await setup(page, { escCancel: false });
    await page.locator('#input').click();
    await page.keyboard.type('imc ');
    await page.keyboard.press('Escape');
    await expect(page.locator('#input')).toHaveValue('imc');
  });

  test('with default mode, Backspace deletes a character normally', async ({ page }) => {
    await setup(page, { escCancel: false });
    await page.locator('#input').click();
    await page.keyboard.type('imc ');
    await page.keyboard.press('Backspace');
    // The trailing space gets deleted; expansion is NOT reverted.
    await expect(page.locator('#input')).toHaveValue("I'm coming");
  });
});
