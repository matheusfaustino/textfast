// Baseline behavior for trigger keys in LimeSurvey-like fields.
const { test, expect } = require('@playwright/test');
const { setup } = require('./helpers');

const WORDS = { wnka: 'weiß nicht / keine Angabe' };

test.describe('LimeSurvey-like fields with the setting off', () => {
  test('input: Space leaves a trailing space', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS });
    await page.locator('#answer-title').click();
    await page.keyboard.type('wnka ');
    await expect(page.locator('#answer-title')).toHaveValue(
      'weiß nicht / keine Angabe ',
    );
  });

  test('input: Enter expands AND submits the form (accidental save)', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS });
    await page.locator('#answer-title').click();
    await page.keyboard.type('wnka');
    await page.keyboard.press('Enter');
    await expect(page.locator('#answer-title')).toHaveValue('weiß nicht / keine Angabe');
    await expect.poll(() =>
      page.evaluate(() => window.__saved.length),
    ).toBe(1);
  });

  test('typing then pressing Enter with no pending shortcut saves normally', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS });
    await page.locator('#answer-title').click();
    await page.keyboard.type('LimeSurvey question text');
    await page.keyboard.press('Enter');
    await expect.poll(() =>
      page.evaluate(() => window.__saved.length),
    ).toBe(1);
  });

  test('textarea: Enter expands and leaves a newline', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS });
    await page.locator('#answer-text').click();
    await page.keyboard.type('wnka');
    await page.keyboard.press('Enter');
    await expect(page.locator('#answer-text')).toHaveValue('weiß nicht / keine Angabe\n');
  });

  test('contenteditable: Space leaves the trailing space too', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS });
    await page.locator('#editor').click();
    await page.keyboard.type('wnka ');
    await expect(page.locator('#editor')).toHaveText('weiß nicht / keine Angabe ');
  });
});
