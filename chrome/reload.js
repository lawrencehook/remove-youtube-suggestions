const reloadButton = document.getElementById("reload_button");
reloadButton.addEventListener("click", reload);

console.log("hi");

async function reload() {
	chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
		console.log(tabs);
	});
}
