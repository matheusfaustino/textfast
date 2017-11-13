/* User click in the addon icon */
browser.browserAction.onClicked.addListener(() => {
  browser.tabs.create({
     'url': './public/config.html'
   });
});

// when the used add or delete words, update all the lists (usually called by the script in the page)
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action == 'get_list') {
    browser.storage.local.get('list_words').then((data) => {
      if (data.list_words)
        sendResponse(data.list_words);
      else
        sendResponse({});
    });

    // tells the browser to wait async call from sendResponse
    return true;
  }
});

// @see: https://stackoverflow.com/a/2736070
function isObjectsEqual(y, x) {
  for (var p in y) {
      if(typeof(y[p]) !== typeof(x[p])) return false;
      if((y[p]===null) !== (x[p]===null)) return false;
      switch (typeof(y[p])) {
          case 'undefined':
              if (typeof(x[p]) != 'undefined') return false;
              break;
          case 'object':
              if(y[p]!==null && x[p]!==null && (y[p].constructor.toString() !== x[p].constructor.toString() || !isObjectsEqual(y[p], x[p]))) return false;
              break;
          case 'function':
              if (p != 'isObjectsEqual' && y[p].toString() != x[p].toString()) return false;
              break;
          default:
              if (y[p] !== x[p]) return false;
      }
  }

  if (typeof(y) == 'object') {
    return Object.keys(y).length === Object.keys(x).length;
  }

  return true;
}

// normalize how the notifications will be created in the addon
function displayNotification(msg) {
  return browser.notifications.create('', {
    'type': 'basic',
    'iconUrl': browser.extension.getURL('icon.png'),
    'title': 'TextFast Notification',
    'message': msg
  });
}

/* sync words when initialize addon */
browser.storage.sync.get('list_words').then(words => {
  words = words.list_words;
  // empty
  if (words && Object.keys(words).length === 0) {
    // set local keys to sync
    browser.storage.local.get('list_words').then(local_words => {
      // just normalize, I dunno why they don't give me the obj directly
      local_words = local_words.list_words;

      if (Object.keys(local_words).length !== 0)
        browser.storage.sync.set({'list_words': local_words})
        .then(() => displayNotification('We synced the cloud with the new changes'));
    });
  }
  else {
    // use sync as local words
    browser.storage.local.get('list_words').then(local_words => {
      local_words = local_words.list_words;

      if (!(isObjectsEqual(words, local_words) && isObjectsEqual(local_words, words)))
        browser.storage.local.set({'list_words': words})
        .then(() => displayNotification('We synced yours shortcuts with the one in the cloud.'));
    });
  }
});

/* keep words synced between browsers or it should do that */
browser.storage.onChanged.addListener((changes, areaName) => {
  switch(areaName) {
    case 'local':
      // check if the event is caused by the update below
      browser.storage.sync.get('list_words').then(sync_words => {
        sync_words.list_words = sync_words.list_words || {};

        if (!isObjectsEqual(changes.list_words.newValue, sync_words.list_words)) {
          // it's different, update sync
          browser.storage.sync.set({'list_words': changes.list_words.newValue})
          .then(() => displayNotification('Shortcuts synced to cloud'));
        }
      });
      break;

    case 'sync':
      // check if the event is caused by the update above
      browser.storage.local.get('list_words').then(local_words => {
        local_words.list_words = local_words.list_words || {};

        if (!isObjectsEqual(changes.list_words.newValue, local_words.list_words)) {
          // it's different, update local
          browser.storage.local.set({'list_words': changes.list_words.newValue})
          .then(() => displayNotification('Cloud shortcuts synced to local'));
        }
      });
      break;
  }
});
