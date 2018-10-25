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

function saveVideoEndSetting(e) {
  browser.storage.local.set({
    videoEnd: e.target.checked
  });
}

var homepage_checkbox = document.getElementById('homepage');
var sidebar_checkbox = document.getElementById('sidebar');
var videoEnd_checkbox = document.getElementById('videoEnd');
homepage_checkbox.addEventListener("change", saveHomepageSetting);
sidebar_checkbox.addEventListener("change", saveSidebarSetting);
videoEnd_checkbox.addEventListener("change", saveVideoEndSetting);



function restoreOptions() {

  function setCurrentChoice(result) {
    for (let key in result) {
      document.getElementById(key).checked = result[key];
    }
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  var gettingHomepage = browser.storage.local.get("homepage");
  var gettingSidebar = browser.storage.local.get("sidebar");
  var gettingVideoEnd = browser.storage.local.get("videoEnd");
  gettingHomepage.then(setCurrentChoice, onError);
  gettingSidebar.then(setCurrentChoice, onError);
  gettingVideoEnd.then(setCurrentChoice, onError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
