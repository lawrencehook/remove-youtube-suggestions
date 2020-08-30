// document.querySelectorAll("RYS_setting_checkbox");
const homepageCheckbox = document.getElementById('homepage');
const sidebarCheckbox = document.getElementById('sidebar');
const videoEndCheckbox = document.getElementById('videoEnd');
const commentsCheckbox = document.getElementById('comments');
homepageCheckbox.addEventListener("change", saveHomepageSetting);
sidebarCheckbox.addEventListener("change", saveSidebarSetting);
videoEndCheckbox.addEventListener("change", saveVideoEndSetting);
commentsCheckbox.addEventListener("change", saveCommentsSetting);

document.addEventListener("DOMContentLoaded", restoreOptions);

function saveHomepageSetting(e) {
	browser.storage.local.set({ homepage: e.target.checked });
}

function saveSidebarSetting(e) {
	browser.storage.local.set({ sidebar: e.target.checked });
}

function saveVideoEndSetting(e) {
  browser.storage.local.set({ videoEnd: e.target.checked });
}

function saveCommentsSetting(e) {
  browser.storage.local.set({ comments: e.target.checked });
}

function restoreOptions() {

  function setCurrentChoice(result) {
    for (let key in result) {
      document.getElementById(key).checked = result[key];
    }
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  const settings = ["homepage", "sidebar", "videoEnd", "comments"];
  settings.forEach(setting => {
    browser.storage.local.
      get(setting).
      then(setCurrentChoice, onError);
  });
}
