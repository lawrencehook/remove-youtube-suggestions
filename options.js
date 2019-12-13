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

function saveCommentsSetting(e) {
  browser.storage.local.set({
    comments: e.target.checked
  });
}

var homepage_checkbox = document.getElementById('homepage');
var sidebar_checkbox = document.getElementById('sidebar');
var videoEnd_checkbox = document.getElementById('videoEnd');
var comments_checkbox = document.getElementById('comments');
homepage_checkbox.addEventListener("change", saveHomepageSetting);
sidebar_checkbox.addEventListener("change", saveSidebarSetting);
videoEnd_checkbox.addEventListener("change", saveVideoEndSetting);
comments_checkbox.addEventListener("change", saveCommentsSetting);



function restoreOptions() {

  function setCurrentChoice(result) {
    for (let key in result) {
      document.getElementById(key).checked = result[key];
    }
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  let gettingHomepage = browser.storage.local.get("homepage");
  let gettingSidebar = browser.storage.local.get("sidebar");
  let gettingVideoEnd = browser.storage.local.get("videoEnd");
  let gettingComments = browser.storage.local.get("comments");
  gettingHomepage.then(setCurrentChoice, onError);
  gettingSidebar.then(setCurrentChoice, onError);
  gettingVideoEnd.then(setCurrentChoice, onError);
  gettingComments.then(setCurrentChoice, onError);
}

document.addEventListener("DOMContentLoaded", restoreOptions);
