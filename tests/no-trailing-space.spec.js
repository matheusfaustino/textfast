// Regression coverage for the optional consumed-trigger setting.
const { test, expect } = require('@playwright/test');
const { setup } = require('./helpers');

const WORDS = { wnka: 'weiß nicht / keine Angabe' };

test.describe('no-trailing-space setting', () => {
  test('input: Space expands with no trailing space', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS, noTrailingSpace: true });
    await page.locator('#answer-title').click();
    await page.keyboard.type('wnka ');
    await expect(page.locator('#answer-title')).toHaveValue('weiß nicht / keine Angabe');
  });

  test('input: Enter expands WITHOUT submitting the form', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS, noTrailingSpace: true });
    await page.locator('#answer-title').click();
    await page.keyboard.type('wnka');
    await page.keyboard.press('Enter');
    await expect(page.locator('#answer-title')).toHaveValue('weiß nicht / keine Angabe');
    await expect.poll(() => page.evaluate(() => window.__saved.length)).toBe(0);
  });

  test('input: no match — Enter still submits the form normally', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS, noTrailingSpace: true });
    await page.locator('#answer-title').click();
    await page.keyboard.type('plain question text');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.__saved.length)).toBe(1);
  });

  test('textarea: Space with no match is still typed into the field', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS, noTrailingSpace: true });
    await page.locator('#answer-text').click();
    await page.keyboard.type('some text ');
    await expect(page.locator('#answer-text')).toHaveValue('some text ');
  });

  test('textarea: Enter expands with no trailing newline', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS, noTrailingSpace: true });
    await page.locator('#answer-text').click();
    await page.keyboard.type('wnka');
    await page.keyboard.press('Enter');
    await expect(page.locator('#answer-text')).toHaveValue('weiß nicht / keine Angabe');
  });

  test('contentEditable: Space expands with no trailing space', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS, noTrailingSpace: true });
    await page.locator('#editor').click();
    await page.keyboard.type('wnka ');
    await expect(page.locator('#editor')).toHaveText('weiß nicht / keine Angabe');
  });

  test('backspace-undo recovers the shortcut (no phantom space offset)', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS, noTrailingSpace: true,
      escCancel: true });
    await page.locator('#answer-text').click();
    await page.keyboard.type('wnka ');
    await expect(page.locator('#answer-text')).toHaveValue('weiß nicht / keine Angabe');
    await page.keyboard.press('Backspace');
    await expect(page.locator('#answer-text')).toHaveValue('wnka');
  });

  test('escape-undo recovers the shortcut after a consumed Space', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS, noTrailingSpace: true });
    await page.locator('#answer-text').click();
    await page.keyboard.type('wnka ');
    await page.keyboard.press('Escape');
    await expect(page.locator('#answer-text')).toHaveValue('wnka');
  });

  test('typing continues normally after an expansion', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS, noTrailingSpace: true });
    await page.locator('#answer-text').click();
    await page.keyboard.type('wnka');
    // The first Space triggers expansion; the next one inserts a separator.
    await page.keyboard.type(' ');
    await page.keyboard.type(' for question 12');
    await expect(page.locator('#answer-text')).toHaveValue(
      'weiß nicht / keine Angabe for question 12',
    );
  });

  test('consecutive expansions in one field', async ({ page }) => {
    await setup(page, {
      fixture: 'limesurvey.html',
      words: { wnka: 'weiß nicht / keine Angabe', imc: "I'm coming" },
      noTrailingSpace: true,
    });
    await page.locator('#answer-text').click();
    await page.keyboard.type('imc');
    // One Space triggers expansion; the next inserts the separator.
    await page.keyboard.type(' ');
    await page.keyboard.type(' ');
    await page.keyboard.type('- wnka');
    await page.keyboard.press('Enter');
    await expect(page.locator('#answer-text')).toHaveValue(
      "I'm coming - weiß nicht / keine Angabe",
    );
  });

  test('two replacements separated by typed spaces still work', async ({ page }) => {
    await setup(page, {
      fixture: 'limesurvey.html',
      words: { imc: "I'm coming", ttyl: 'talk to you later' },
      noTrailingSpace: true,
    });
    await page.locator('#answer-text').click();
    await page.keyboard.type('imc ');
    await page.keyboard.type(' ');
    await page.keyboard.type('ttyl ');
    await expect(page.locator('#answer-text')).toHaveValue("I'm coming talk to you later");
  });
});
