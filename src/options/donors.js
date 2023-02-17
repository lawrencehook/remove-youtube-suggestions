
const HTML = document.documentElement;
browser.storage.local.get('dark_mode', ({ dark_mode }) => {
	HTML.setAttribute('dark_mode', dark_mode)
});


// Review links, change depending on current browser.
const reviewLink = document.getElementById('review-link');
const path = browser.runtime.getURL('/');
const isChrome = path.startsWith('chrome');
const isFirefox = path.startsWith('moz');
if (isFirefox) {
	reviewLink.setAttribute('href', 'https://addons.mozilla.org/en-US/firefox/addon/remove-youtube-s-suggestions/');
} else if (isChrome) {
	reviewLink.setAttribute('href', 'https://chrome.google.com/webstore/detail/rys-%E2%80%94-remove-youtube-sugg/cdhdichomdnlaadbndgmagohccgpejae');
} else {
	reviewLink.removeAttribute('href');
	reviewLink.removeAttribute('target');
}


// Show donation options, after clicking the donate button.
const donateButton = document.getElementById('donate_button');
const donateLinksContainer = document.getElementById('donate-links-container');
const donateLinks = document.getElementById('donate-links');
donateLinksContainer.addEventListener('click', e => {
	if (e.target !== donateLinksContainer) return;
	donateLinksContainer.setAttribute('hidden', '');
});
donateButton.addEventListener('click', e => {
	donateLinksContainer.removeAttribute('hidden');
	const buttonBox = donateButton.getBoundingClientRect();
	const linksBox = donateLinks.getBoundingClientRect();

	donateLinks.style.top = (buttonBox.top - linksBox.height - 5) + 'px';
	donateLinks.style.left = (buttonBox.left - (linksBox.width - buttonBox.width)) + 'px';
});



// Get and populate donors data.
const templateDonor = document.querySelector('#template-donor').content;
const tiers = Array.from(document.querySelectorAll('.tier'));
const minAmounts = tiers.map(tier => Number(tier.getAttribute('min-amount')));
const tieredDonors = minAmounts.reduce((acc, curr) => {
	acc[curr] = [];
	return acc;
}, {});
sendGetDonorsRequest().then(x => {
	try {
		const donors = JSON.parse(x);
		donors.forEach(donor => {
			const { name, amount, timestamp } = donor;
			if (!amount || !timestamp) return;

			const eligibleTiers = minAmounts.filter(x => x <= Number(amount));
			if (eligibleTiers.length === 0) return;

			const tier = Math.max(...eligibleTiers);
			tieredDonors[tier].push(donor);
		});

	  Object.entries(tieredDonors).forEach(([tier, donors]) => {
	  	if (donors.length === 0) return;

	  	const tierNode = document.querySelector(`.tier[min-amount='${tier}']`);
	  	const donorList = tierNode.querySelector('.donors-list');
	  	donorList.innerHTML = '';

	  	// Sort in descending order, by timestamp
	  	donors.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

	  	donors.forEach(donor => {
	  		const donorNode = templateDonor.cloneNode(true);
	  		const pNode = donorNode.querySelector('p');
	  		pNode.innerText = donor.name || 'anonymous';
	  		donorList.appendChild(donorNode);
	  	});

	  });
	} catch (error) {
		console.log(error);
	}
}).catch(error => console.log(error));
