const sendReloadMessage = () => {
	chrome.runtime.sendMessage({ "message": "reload_page" });
}
const reloadButton = document.getElementById("reload_button");
reloadButton.addEventListener("click", sendReloadMessage);
