/**
 * tests/core.spec.js — happy-path replacement coverage across the three
 * element types the content script supports.
 */
const { test, expect } = require('@playwright/test');
const { setup } = require('./helpers');

test.describe('core replacement', () => {
  test('input: space triggers expansion', async ({ page }) => {
    await setup(page);
    await page.locator('#input').click();
    await page.keyboard.type('imc ');
    await expect(page.locator('#input')).toHaveValue("I'm coming ");
  });

  test('input: enter triggers expansion', async ({ page }) => {
    await setup(page);
    await page.locator('#input').click();
    await page.keyboard.type('imc');
    await page.keyboard.press('Enter');
    // Enter on a single-line input does not insert anything, but expansion
    // still fires before the (form-submit / no-op) default.
    await expect(page.locator('#input')).toHaveValue("I'm coming");
  });

  test('textarea: space triggers expansion', async ({ page }) => {
    await setup(page);
    await page.locator('#textarea').click();
    await page.keyboard.type('imc ');
    await expect(page.locator('#textarea')).toHaveValue("I'm coming ");
  });

  test('contentEditable: space triggers expansion', async ({ page }) => {
    await setup(page);
    await page.locator('#editable').click();
    await page.keyboard.type('imc ');
    await expect(page.locator('#editable')).toHaveText("I'm coming ");
  });

  test('two replacements in a row work in textarea', async ({ page }) => {
    await setup(page, { words: { imc: "I'm coming", ttyl: 'talk to you later' } });
    await page.locator('#textarea').click();
    await page.keyboard.type('imc ');
    await page.keyboard.type('ttyl ');
    await expect(page.locator('#textarea')).toHaveValue("I'm coming talk to you later ");
  });

  test('non-matching word is left alone', async ({ page }) => {
    await setup(page);
    await page.locator('#textarea').click();
    await page.keyboard.type('hello ');
    await expect(page.locator('#textarea')).toHaveValue('hello ');
  });

  test('complex editor (.CodeMirror) is skipped — no expansion', async ({ page }) => {
    await setup(page);
    await page.locator('#complex-editable').click();
    await page.keyboard.type('imc ');
    const text = await page.locator('#complex-editable').textContent();
    expect(text).toContain('imc');
    expect(text).not.toContain("I'm coming");
  });
});
