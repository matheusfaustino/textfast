/**
 * build.js — bundles src/ into the two deployable files.
 *
 *   text-replacer.js   Firefox extension content script (loaded by manifest.json)
 *   textfast.user.js   Tampermonkey userscript / Ferdium custom-JS injection
 *
 * Usage:
 *   node build.js          single build
 *   node build.js --watch  rebuild on every src/ change
 */

const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

// ==UserScript== header prepended to the userscript bundle.
// Lines beginning with // are comments and are harmless when the file is
// pasted directly into Ferdium's "Custom JS" field.
const userscriptBanner = `\
// ==UserScript==
// @name         TextFast
// @namespace    https://github.com/matheusfaustino/textfast
// @version      1.4.0
// @description  Type a short alias and it expands to a full word, phrase or emoji. Open settings with Alt+Shift+T.
// @author       Matheus Faustino
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==
//
// Ferdium / Electron custom-JS users: paste everything below this block into
// the service's "Custom JS" field. GM_* APIs are not needed — the script falls
// back to localStorage automatically.
`;

const sharedOptions = {
  bundle: true,
  platform: 'browser',
  target: ['firefox57'],  // manifest_version 2 minimum
  logLevel: 'info',
};

async function build() {
  const ctx = await esbuild.context({
    ...sharedOptions,
    entryPoints: ['src/content-script.js'],
    outfile: 'text-replacer.js',
    format: 'iife',
  });

  const ctx2 = await esbuild.context({
    ...sharedOptions,
    entryPoints: ['src/userscript.js'],
    outfile: 'textfast.user.js',
    format: 'iife',
    banner: { js: userscriptBanner },
  });

  if (watch) {
    await ctx.watch();
    await ctx2.watch();
    console.log('[textfast] watching src/ for changes…');
  } else {
    await ctx.rebuild();
    await ctx2.rebuild();
    await ctx.dispose();
    await ctx2.dispose();
    console.log('[textfast] build complete → text-replacer.js + textfast.user.js');
  }
}

build().catch((err) => { console.error(err); process.exit(1); });
