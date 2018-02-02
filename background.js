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
