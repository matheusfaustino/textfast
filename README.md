# TextFast
Have you ever felt bored while typing long and tedious words or sentences when you want to reply to a chat message or create a post on Reddit? This is the addon for you, it helps you type fast in a very customizable way in the browser.

You can create shortcuts for words, sentences, or emoji, and then type them in the browser and write really quickly.
For instance: you can transform the phrase "I'm coming" into a shortcut "imc" and every time you type "imc" you will get "I'm coming". Another one? You can transform "¯\_[ツ]_/¯" into "shrug" and then you will never mess up with the characters ever again.

All you have to do is to enter the configuration page (click the icon) and create a unique style of writing for yourself, and then save it, and that's it.

Good Luck, Have Fun (typed: glhf)

## Why?

Well, I'm lazy and I don't like to type too much, so I want to be able to type fast in Firefox and all the websites that I use.


## Installation

https://addons.mozilla.org/en-US/firefox/addon/textfast/

## Configuration

When you install the addon, it will add a new icon to the top bar. Click there and you will be taken to the "configuration page" (I'll improve that, I hope, I'm not very good at design). Then, click the "+" (plus) icon and it will create a new row in the list. Now, in the "Replace" field, put your desired shortcut for your boring word, sentence, or emoji, and in the "With" field, put the real word/sentence/emoji, and then click Save. That's it, now go to Google and test it, and then add more shortcuts.

![Configuration Page](/screenshot.png)

### Import

This is for advanced users or for those who exported the list from another installation (if you exported the list, you don't have to change a thing — just import it, you can skip the rest). For those who don't want to add shortcuts one by one, you can create a [JSON file](/example.json) following this example with your words and just import it and **save** it. Importing merges by shortcut: values you edited in the file replace the ones you already have, and the shortcuts that aren't in the file stay where they are. See the [JSON format](#json-format) section below for the full schema.

### JSON format

The import and export use the same JSON shape: a single array of objects, where each object describes one shortcut.

```json
[
  {
    "replace": "imc",
    "with": "I'm coming"
  },
  {
    "replace": "multilines",
    "with": "First Line\nSecond Line\n"
  }
]
```

Fields:

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `replace` | string | yes | The shortcut you type. Must not contain spaces (a space/enter is what triggers the replacement). |
| `with` | string | yes | The text the shortcut expands into. Use `\n` for line breaks; any other character (including emoji and non-Latin text) is allowed. |

Notes:

- The file must be valid JSON (UTF-8, no trailing commas).
- Entries with an empty `replace` or `with` are skipped on import.
- Import **merges by shortcut**. A `replace` that already exists in the list is
  updated in place — so exporting, editing a value and importing it back does
  what you expect — and a `replace` that does not exist yet is added. Shortcuts
  that are missing from the file are never deleted.
- Importing the same file twice does not create duplicate rows.
- If two entries in the same file share a `replace`, the last one wins.
- Import only edits the table. Click **Save** to write it to storage; until you
  do, a reload brings the previous list back.
- A file that is not valid JSON, is not an array, or contains an entry that is
  not an object with string `replace`/`with` fields is rejected as a whole: an
  error is shown and nothing changes.
- Values are stored exactly as written and are never URL-decoded, so text like
  `https://example.test/a%20b` or `%C3%A9` expands verbatim.
- `\n` in `with` becomes a line break in the settings table, and comes back out
  as `\n` when you export again.

## Browsers

For now, I'm only focusing on Firefox + the webext. But it would be cool to port it to other browsers in the future.

## Using TextFast without the extension (Ferdium, Electron apps)

If you are using an Electron-based app like [Ferdium](https://ferdium.org/) you cannot install browser extensions inside its service webviews. Instead, use the standalone userscript:

1. Run the build (see [Development](#development)) to produce `textfast.user.js`.
2. In Ferdium, open the service you want (WhatsApp, Messenger, etc.) → Settings → **Custom JS**.
3. Paste the entire contents of `textfast.user.js` and save.
4. Reload the service, then press **Alt+Shift+T** inside it to open the shortcuts panel.

Shortcuts are stored in that service's `localStorage`. Use the **Export JSON** / **Import JSON** buttons in the panel to copy your list across services. The panel uses the same [JSON format](#json-format) and the same merge-by-shortcut rules as the add-on, except that it writes to storage straight away — there is no **Save** step in the panel.

The same file also works as a [Tampermonkey](https://www.tampermonkey.net/) / Violentmonkey userscript — install it directly from the `textfast.user.js` file.

## Development

The repository source lives in `src/`. The files at the root that the extension and userscript use are **generated by the build** — do not edit them directly.

| Generated file | Source |
| --- | --- |
| `text-replacer.js` | `src/content-script.js` + `src/core.js` |
| `textfast.user.js` | `src/userscript.js` + `src/core.js` |

All shared logic (text replacement engine, keyboard handler, element detection) lives in `src/core.js`. Platform-specific wiring (extension storage, userscript storage, settings panel) lives in the respective entry point.

### Prerequisites

```sh
npm install
```

### Build

```sh
npm run build       # single build
npm run watch       # rebuild on every src/ change
make build          # build + package the .xpi
make run            # build + lint + run in Firefox
```

## TODO

- [x] Support dynamic inputs
- [ ] Support alternative text entry methods
- [x] Improve the UI of the list
- [ ] Use a better icon
- [ ] Sync your list with all your browsers
- [ ] Change the name (maybe)

## Do you want to help?

Well, see the TODO list and talk to me, I'm open to new ideas.
