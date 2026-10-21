/**
 * tests/limesurvey-repro.spec.js — browsing test reproducing the user report
 * (Jonas / "wnka" → "weiß nicht / keine Angabe" in LimeSurvey).
 *
 * Current 1.4.2 behavior: the trigger key is NOT prevented; SPACE_SIZE = 1.
 *   - Space after a shortcut leaves a trailing space.
 *   - Enter in a textarea leaves a trailing newline.
 *   - Enter in a form input both expands AND submits the form (accidental
 *     save/page load in LimeSurvey).
 */
const { test, expect } = require('@playwright/test');
const { setup } = require('./helpers');

const WORDS = { wnka: 'weiß nicht / keine Angabe' };

test.describe('user report: LimeSurvey survey editing', () => {
  test('input: Space leaves the trailing space Jonas must backspace away', async ({ page }) => {
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
    // The stale-shortcut + Enter triggered the LimeSurvey form save.
    await expect.poll(() =>
      page.evaluate(() => window.__saved.length),
    ).toBe(1);
  });

  test('typing then pressing Enter with no pending shortcut saves normally', async ({ page }) => {
    await setup(page, { fixture: 'limesurvey.html', words: WORDS });
    await page.locator('#answer-title').click();
    await page.keyboard.type('LimeSurvey question text');
    await page.keyboard.press('Enter');
    // No shortcut match → ordinary Enter → form submit (that is still wanted).
    await expect.poll(() =>
      page.evaluate(() => window.__saved.length),
    ).toBe(1);
  });

  test('textarea: Enter expands and leaves a newline Jonas must delete', async ({ page }) => {
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
