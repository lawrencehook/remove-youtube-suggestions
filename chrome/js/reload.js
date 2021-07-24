const reloadButton = document.getElementById("reload_button");
reloadButton.addEventListener("click", sendReloadMessage);

async function sendReloadMessage() {
	chrome.runtime.sendMessage({ "message": "reload_page" });
}
