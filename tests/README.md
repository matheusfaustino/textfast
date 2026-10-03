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

`tinymce.spec.js` loads the built bundles against `test_tinymce.html`. It
checks ordinary fields, TinyMCE inline mode, and classic iframe mode. The
classic cases cover the add-on's manifest frame policy and the userscript
running from the top page. The add-on case simulates content script injection;
it does not install the extension itself.
