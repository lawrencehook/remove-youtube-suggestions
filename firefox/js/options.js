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
  "redirect_home_to_subs": false,
}

// Make checkboxes reflect local settings
document.addEventListener("DOMContentLoaded", () => {
  browser.storage.local.get(localSettings => {
    Object.keys(localSettings).forEach(settingKey => {
      if (!Object.keys(DEFAULT_SETTINGS).includes(settingKey)) return;
      document.getElementById(settingKey).checked = localSettings[settingKey];
    });
  });
});

// Handle check/uncheck events
Object.keys(DEFAULT_SETTINGS).forEach(settingKey => {
  const settingCheckbox = document.getElementById(settingKey);
  settingCheckbox.addEventListener("change", async e => {
    const settingKey = e.target.id;
    const settingValue = e.target.checked;

    // 1. Save changes to local storage
    const saveObj = { [settingKey]: settingValue };
    browser.storage.local.set(saveObj);

    // 2. Update running tabs with the changed setting
    const messageObj = { key: settingKey, value: settingValue };
    const tabs = await browser.tabs.query({});
    tabs.forEach(tab => {
      browser.tabs.sendMessage(tab.id, messageObj);
    });
  });
});
