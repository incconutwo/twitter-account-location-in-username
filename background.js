chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setIcon({
    path: {
      "16": "icons/16.png",
      "48": "icons/48.png",
      "128": "icons/128.png"
    }
  });
});