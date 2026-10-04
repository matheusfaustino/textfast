# Browser tests

These tests are kept in the repository but excluded from the add-on package.

## Run

```sh
npm ci
npx playwright install chromium
npm run build
npx playwright test
```

To watch the browser:

```sh
npx playwright test --headed
```

To debug a single test:

```sh
npx playwright test --headed --debug -g "TinyMCE classic"
```

## What's covered

`import-export.spec.js` loads the add-on's real settings page
(`public/config.html`) with a stubbed `browser.*` namespace and drives the
export → edit → import → Save → reload round trip that issue #8 was about:
merging by shortcut, no duplicate rows, multi-line values, verbatim percent
escapes, and malformed files leaving the table alone.

`tinymce.spec.js` loads the built bundles against `test_tinymce.html`. It
checks ordinary fields, TinyMCE inline mode, and classic iframe mode. The
classic cases cover the add-on's manifest frame policy and the userscript
running from the top page. The add-on case simulates content script injection;
it does not install the extension itself.
