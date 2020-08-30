const reloadButton = document.getElementById("reload_button");
reloadButton.addEventListener("click", reload);

async function reload() {
  const tabs = await browser.tabs.query({ active: true });
  tabs.forEach(tab => browser.tabs.reload(tab.id));
}
