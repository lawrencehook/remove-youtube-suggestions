const HTML = document.documentElement;
const DEFAULT_SETTINGS = {
  "remove_homepage": true,
  "remove_sidebar": true,
  "remove_end_of_video": true,
  "remove_embedded_video": true,
  "remove_embedded_channel": true,
  "remove_trending": false,
  "remove_comments": false,
  "remove_chat": false,
}

try {
  chrome.storage.local.get(localSettings => {
    Object.keys(DEFAULT_SETTINGS).forEach(settingKey => {
      const isLocal = localSettings.hasOwnProperty(settingKey);
      const settingValue = isLocal ? localSettings[settingKey] : DEFAULT_SETTINGS[settingKey];
      if (!isLocal) chrome.storage.local.set({ [settingKey] : settingValue });
      HTML.setAttribute(settingKey, settingValue);
    });
  });
} catch (e) {
  console.log(e);
}

// Update in real time, by receiving change events from the options menu
chrome.runtime.onMessage.addListener((data, sender) => {
  const settingKey = data.key;
  const settingValue = data.value;
  HTML.setAttribute(settingKey, settingValue);
});
