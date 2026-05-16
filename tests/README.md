# Local tests

Not shipped. Kept out of the repo via `.gitignore`.

## Run

```sh
npm install --save-dev @playwright/test
npx playwright install chromium
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

`tinymce.spec.js` injects the built `text-replacer.js` into a local copy of
`test_tinymce.html` and types `imc ` into each editor. Expects expansion in
the plain elements and TinyMCE inline mode; expects NO expansion in TinyMCE
classic (iframe) — that's issue #2.

If the classic-mode test starts passing unexpectedly, someone probably fixed
issue #2 and this test should flip from "expect no expand" to "expect
expand".
