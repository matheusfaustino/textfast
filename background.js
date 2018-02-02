/* User click in the addon icon */
browser.browserAction.onClicked.addListener(_ => {
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

// normalize how the notifications will be created in the addon
function displayNotification(msg) {
  return browser.notifications.create('', {
    'type': 'basic',
    'iconUrl': browser.extension.getURL('icon.png'),
    'title': 'TextFast Notification',
    'message': msg
  });
}

/* check first time running */
browser.storage.local.get('list_words').then(local_words => {
  local_words = local_words.list_words;

  // exist some words
  if (typeof local_words != 'undefined' && Object.keys(local_words).length !== 0) {
    return;
  }

  // check first time (autoload some words as example)
  browser.storage.local.get('tutorial_first_time').then((val) => {
    val = val.tutorial_first_time;
    if (typeof val == 'undefined') {

      fetch(browser.extension.getURL('example.json'))
      .then(r => r.json())
      .then(json => {
        let data = {};
        // preparing data
        json.forEach(i => data[i.replace] = i.with);
        // saveing locally
        browser.storage.local.set({'list_words': data})
          .then(() => displayNotification('Default shortcuts added to help you.'));
      });
    }
  });
});

// always open config page when the user click the notification
browser.notifications.onClicked.addListener(_ => {
  browser.tabs.create({url: browser.extension.getURL('public/config.html')});
});
