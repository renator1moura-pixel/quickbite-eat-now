// service_worker.js

// clicar no ícone da extensão
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.setOptions({
    tabId: tab.id,
    path: "sidepanel.html",
    enabled: true
  });
  await chrome.sidePanel.open({ tabId: tab.id });
});

// mensagens
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OPEN_QUICKBITE_PANEL") {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.sidePanel
        .setOptions({
          tabId,
          path: "sidepanel.html",
          enabled: true
        })
        .then(() => chrome.sidePanel.open({ tabId }));
    }
    return;
  }

  if (message?.type === "GET_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const active = tabs[0];
      sendResponse({
        tab: {
          id: active.id,
          url: active.url,
          title: active.title
        }
      });
    });
    return true;
  }
});
