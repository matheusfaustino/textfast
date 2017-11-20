'use strict';

var exec = require('child_process').exec;
var fs = require('fs');

var file_export_name = 'shortcuts.json';

var SHORTCUT_COMMAND_MAC = 'defaults read -g NSUserDictionaryReplacementItems';

exec(SHORTCUT_COMMAND_MAC, function(err, stdout, stderr)    {
    let shortcut = stdout.replace(/\(/ig, '[') // init array
                        .replace(/\)/ig, ']') // end array
                        .replace(/;/gi, ',') // remove ;
                        .replace(/=/gi, ":") // change = to :
                        .replace(/replace : (\w+)/gi, "replace : \"$1\"") // normalize replace
                        .replace(/with : (\w+)/gi, "with : \"$1\"") // normalize with
                        .replace(/with : .*,/gi, (i) => i.substr(0, i.length - 1)) // remove ", keeping just " (final param)
                        .replace(/\\\\U/g, '%u') // convert hexadecimal escape to js's unescape pattern
                        .replace(/(on).:/g, "\"on\":") // put "" in on
                        .replace(/(replace).:/g, "\"replace\":") // put "" in replace
                        .replace(/(with).:/g, "\"with\":") // put "" in with

    let jsonShortcut = JSON.parse(shortcut);

    let arr = {};
    jsonShortcut.forEach((i) => {
        arr[i.replace] = i.with;
    });

    fs.exists(file_export_name, exists => {
      if (!exists) {
        console.log('creating file');
        fs.writeFile(file_export_name, JSON.stringify(jsonShortcut), err => {
          if (err) throw err;
          console.log('File created!');
        });
      } else
        console.log('file already exists');
    })
});
