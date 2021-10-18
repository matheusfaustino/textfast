# TextFast
Have you ever felt bored of typing long and tedious words or sentences over and over again when replying to a chat or creating a post on reddit? This addon is for you! It will help you to type faster by allowing customizable text replacements in the browser.

You can create shortcuts for words, sentences or emojis and then they will be replaced by the words you have chosen.
For instance: you can transform the phrase "I'm comming" into a shortcut "imc" and every time you type "imc" it expands to "I'm comming". Another one? You can transform "¯\_[ツ]_/¯" into "shrug" and then you will never mess up the characters again. 

All you have to do is to enter the configuration page (click the icon) and create your own unique style of writing, save it and that’s it.

Good Luck, Have fun (typed: glhf)

## Why?

Well, I'm too lazy to type more than I have to, so I want to be able to type fast even in the Firefox and all the websites that I use.


## Configuration

After installing the addon, a new icon appears in the top toolbar, click it and you will move to the "configuration page" (I'll improve that, I hope, I'm not very good at design). Then, click the "+" (plus) icon to create a new row in the list. In the "Replace" column type the shortcut to your boring word, sentence or emoji and in the "With" column type the word/sentence/emoji you’d prefer not to type over and over again. Click "Save". That is it! Time to us it, or add more shortcuts.  

![Configuration Page](/screenshot.png)

### Import 

Well, that it for the advanced users or the ones that exported the list from other installation (for who exported the list, you actually don have to change a thing, just import it, you can skip it). For those who don't want to add shortcut for shortcut, you can create a [JSON file](/example.json) following this example with your words and just import it and **save** it.

#### For mac users with developer tools installed

To import your text replacements from macOS simply navigate to "System preferences" > "Keyboard" > "Text". Highlight the replacements you wish to import and drag ‘n drop them to your desktop.

 cd ~/Desktop && plutil -convert json Text\ Substitutions.plist -o data.json

Open ~/Desktop/data.json in a text editor and use search & replace to replace all instances of "shortcut" with "replace", and every instance of "phrase" with "with". Save and close data.json.

Import data.json to TextFast.

## Browsers

For now, my focus is Firefox + webext. But, it would be cool to port it to other browsers. 

## TODO

- [x] Support dynamic inputs;
- [ ] Support non-usual way to enter a text; 
- [x] Improve the UI of the list;
- [ ] Use a better icon;
- [ ] Sync your list with all your browsers;
- [ ] Change the name (maybe).

## Do you want to help?

Well, see the TODO list and talk to me, I'm open for new ideas.
