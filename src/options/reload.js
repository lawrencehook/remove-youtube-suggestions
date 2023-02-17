const reloadButton = document.getElementById("reload_button");
reloadButton.addEventListener("click", sendReloadMessage);

async function sendReloadMessage() {
  browser.tabs.query({ active: true, currentWindow: true }, tabs => {
    tabs.forEach(tab => browser.tabs.reload(tab.id));
  });
}
