function callsConfigPage() {
  let config_html = "./public/config.html";

  browser.tabs.create({
     "url": config_html
   });
}

function sendUpdatedList(message, sender, sendResponse) {
  if (message.action == 'get_list') {
    browser.storage.local.get('list_words').then((data) => {
      // console.log(sendResponse, sender);
      if (data.list_words)
        sendResponse(data.list_words);
      else
        sendResponse({});
    });

    // tells the browser to wait async call from sendResponse
    return true;
  }
}

/* User click in the addon icon */
browser.browserAction.onClicked.addListener(callsConfigPage);

// when the used add or delete words, update all the lists
browser.runtime.onMessage.addListener(sendUpdatedList)
