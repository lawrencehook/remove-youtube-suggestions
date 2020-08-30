const reloadButton = document.getElementById("reloadButton");
reloadButton.addEventListener("click", reload);

async function reload() {
	console.log("hi");
  const tabs = await browser.tabs.query({ active: true, url: "*://www.youtube.com/" });
  if (tabs.length == 1) {
    const activeTab = tabs[0];
    browser.tabs.reload(activeTab.id);
  }  
}
