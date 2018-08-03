function saveHomepageSetting(e) {
	console.log(e.target.checked);
	browser.storage.local.set({
		homepage: e.target.checked
	});
}

function saveSidebarSetting(e) {
	console.log(e.target.checked);
	browser.storage.local.set({
		sidebar: e.target.checked
	});
}

var homepage_checkbox = document.getElementById('homepage');
var sidebar_checkbox = document.getElementById('sidebar');

// console.log(homepage_checkbox, sidebar_checkbox);

homepage_checkbox.addEventListener("change", saveHomepageSetting);
sidebar_checkbox.addEventListener("change", saveSidebarSetting);


function restoreOptions() {
  function setCurrentChoice(result) {
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  var getting = browser.storage.local.get("settings");
  getting.then(setCurrentChoice, onError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
