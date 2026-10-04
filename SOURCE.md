# Source code and build instructions

This archive is the human-readable source code submitted to Mozilla Add-ons (AMO)
alongside the built extension. Everything needed to reproduce the reviewed build is
here.

The generated bundles at the repository root (`text-replacer.js`,
`textfast.user.js`, `textfast.ferdium.js`) are checked in next to their sources in
`src/`. They are the committed output of `npm run build`, so `src/` is the
authoritative copy and the bundles should be regenerated rather than edited. They are
included in this archive for reference only — rebuild them with the steps below and
diff against these to confirm the shipped code matches the source.

## Layout

| Path | Purpose |
| --- | --- |
| `src/` | Authoritative extension source. `src/core.js` holds the shared replacement engine, `src/content-script.js` the Firefox content script, `src/userscript.js` the userscript. |
| `build.js` | esbuild bundler that produces the three generated files. |
| `manifest.json` | MV2 manifest. `version` is the released version. |
| `background.js` | MV2 background script. |
| `public/` | Static assets, including the options page. |
| `package.json` | `version` and the npm scripts used by CI. |
| `tests/` | Playwright specs. |
| `Makefile` | Convenience wrappers around the npm scripts. |

## Prerequisites

- Node.js 20
- npm

## Build

```sh
npm ci
npm run build
```

`npm run build` writes:

- `text-replacer.js` — Firefox extension content script, referenced by `manifest.json`
- `textfast.user.js` — Tampermonkey / Violentmonkey userscript
- `textfast.ferdium.js` — same bundle without the `==UserScript==` header, for
  `require()` from a Ferdium recipe

The userscript `@version` in the banner inside `build.js` must match
`manifest.json` and `package.json`.

## Package

```sh
npm run pack
```

This runs the build and then `web-ext build`, writing the extension ZIP to `build/`.
The `pack` ignore list keeps development-only files out of the package.

## Tests

```sh
npx playwright install --with-deps chromium
npm test    # build + playwright test
```

## Lint

`web-ext lint` reports inline and remote scripts, so it warns about the dev-only
harnesses in a source checkout (`test.html`, `test_tinymce.html`). Lint the unpacked
package instead to cover only the files that ship:

```sh
npm run pack
staged="$(mktemp -d)"
unzip -q build/*.zip -d "$staged"
npx web-ext lint --source-dir="$staged"
```

This is what the release workflow does before submitting to AMO.
