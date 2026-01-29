// Shared banner configuration and utilities

const BANNERS = [
  {
    id: 'premium_coming',
    storageKey: 'announcement_dismissed_premium_coming',
    message: 'Premium features coming soon.',
    linkText: 'Learn more',
    linkUrl: 'https://lawrencehook.com/rys/premium',
    dismissText: "Don't show again",
    showOn: ['options', 'youtube_homepage'],
  },
];

function createBannerHTML(banner, logoUrl) {
  const container = document.createElement('div');
  container.id = `rys_banner_${banner.id}`;
  container.className = 'rys_announcement_banner';
  container.innerHTML = `
    <img src="${logoUrl}" alt="RYS" class="rys_banner_logo">
    <span class="rys_banner_brand">RYS</span>
    <span class="rys_banner_message">${banner.message}</span>
    <a href="${banner.linkUrl}" target="_blank" class="rys_banner_link">${banner.linkText}</a>
    <a class="rys_banner_dismiss">${banner.dismissText}</a>
    <button class="rys_banner_close" aria-label="Close">&times;</button>
  `;
  return container;
}

function initBanner(banner, logoUrl, getContainer) {
  const existingBanner = document.getElementById(`rys_banner_${banner.id}`);
  if (existingBanner) return;

  browser.storage.local.get(banner.storageKey, result => {
    if (result[banner.storageKey]) return;

    const container = getContainer();
    if (!container) return;

    const bannerEl = createBannerHTML(banner, logoUrl);

    // Insert banner
    if (container.insertMethod === 'prepend') {
      container.element.insertBefore(bannerEl, container.element.firstChild);
    } else {
      container.element.appendChild(bannerEl);
    }

    // Mark that a banner is visible (for CSS adjustments)
    document.documentElement.setAttribute('rys-banner-visible', 'true');

    // Event listeners
    const dismissBtn = bannerEl.querySelector('.rys_banner_dismiss');
    const closeBtn = bannerEl.querySelector('.rys_banner_close');

    const removeBanner = () => {
      bannerEl.remove();
      // Check if any banners still visible
      if (!document.querySelector('.rys_announcement_banner')) {
        document.documentElement.removeAttribute('rys-banner-visible');
      }
    };

    dismissBtn?.addEventListener('click', () => {
      removeBanner();
      browser.storage.local.set({ [banner.storageKey]: true });
    });

    closeBtn?.addEventListener('click', () => {
      removeBanner();
    });
  });
}

function getActiveBanners(location) {
  return BANNERS.filter(b => b.showOn.includes(location));
}
