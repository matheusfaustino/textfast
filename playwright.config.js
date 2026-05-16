// Playwright config for the TinyMCE smoke tests. Local-only — kept out of
// the repo via .gitignore.
module.exports = {
  testDir: 'tests',
  timeout: 30_000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
};
