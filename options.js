// Lawrence Hook

function saveHomepageSetting(e) {
	browser.storage.local.set({
		homepage: e.target.checked
	});
}

function saveSidebarSetting(e) {
	browser.storage.local.set({
		sidebar: e.target.checked
	});
}

function restoreOptions() {
  function setCurrentChoice(result) {
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  var getting = browser.storage.local.get("settings");
  getting.then(setCurrentChoice, onError);
}

var homepage_checkbox = document.getElementById('homepage');
var sidebar_checkbox = document.getElementById('sidebar');
homepage_checkbox.addEventListener("change", saveHomepageSetting);
sidebar_checkbox.addEventListener("change", saveSidebarSetting);

document.addEventListener("DOMContentLoaded", restoreOptions);
