// License checking module for RYS Premium

const License = {
  // Check premium status from server
  async checkLicense(forceRefresh = false) {
    const { STORAGE_KEYS, LICENSE_CHECK_INTERVAL_MS, OFFLINE_GRACE_PERIOD_MS } = PREMIUM_CONFIG;

    // Get cached data
    const cached = await browser.storage.local.get([
      STORAGE_KEYS.SESSION_TOKEN,
      STORAGE_KEYS.IS_PREMIUM,
      STORAGE_KEYS.PREMIUM_SOURCE,
      STORAGE_KEYS.LAST_LICENSE_CHECK,
    ]);

    const token = cached[STORAGE_KEYS.SESSION_TOKEN];
    const lastCheck = cached[STORAGE_KEYS.LAST_LICENSE_CHECK];
    const cachedPremium = cached[STORAGE_KEYS.IS_PREMIUM];

    // Not signed in
    if (!token) {
      return { isPremium: false, source: null };
    }

    // Check if we need to refresh (skip cache check if forcing)
    const now = Date.now();
    const cacheValid = lastCheck && (now - lastCheck < LICENSE_CHECK_INTERVAL_MS);

    if (!forceRefresh && cacheValid) {
      if (typeof recordEvent === 'function') {
        recordEvent('License Check', { isPremium: cachedPremium || false, cached: true });
      }
      return {
        isPremium: cachedPremium || false,
        source: cached[STORAGE_KEYS.PREMIUM_SOURCE] || null,
        cached: true,
      };
    }

    // Fetch from server
    try {
      const response = await fetch(`${PREMIUM_CONFIG.SERVER_URL}/license/check`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.status === 401) {
        // Token expired or invalid, clear auth
        if (typeof recordEvent === 'function') {
          recordEvent('License Check', { error: 'token_expired' });
        }
        await Auth.signOut();
        return { isPremium: false, source: null, signedOut: true };
      }

      if (!response.ok) {
        throw new Error('Failed to check license');
      }

      const data = await response.json();
      const isPremium = !!data.premium;
      const source = data.grandfathered ? 'grandfathered' : null;

      // Cache the result
      await browser.storage.local.set({
        [STORAGE_KEYS.IS_PREMIUM]: isPremium,
        [STORAGE_KEYS.PREMIUM_SOURCE]: source,
        [STORAGE_KEYS.LAST_LICENSE_CHECK]: now,
      });

      if (typeof recordEvent === 'function') {
        recordEvent('License Check', { isPremium, source, cached: false });
      }

      return {
        isPremium,
        source,
        subscription: data.subscription,
      };
    } catch (err) {
      console.error('License check error:', err);

      // Offline grace period: use cached value if within grace period
      if (lastCheck && (now - lastCheck < OFFLINE_GRACE_PERIOD_MS)) {
        if (typeof recordEvent === 'function') {
          recordEvent('License Check', { error: 'offline', offline: true, isPremium: cachedPremium || false });
        }
        return {
          isPremium: cachedPremium || false,
          source: cached[STORAGE_KEYS.PREMIUM_SOURCE] || null,
          offline: true,
        };
      }

      // Grace period expired, assume not premium
      if (typeof recordEvent === 'function') {
        recordEvent('License Check', { error: 'offline_grace_expired' });
      }
      return { isPremium: false, source: null, error: true };
    }
  },

  // Quick check for premium status (uses cache only)
  async isPremium() {
    const cached = await browser.storage.local.get(PREMIUM_CONFIG.STORAGE_KEYS.IS_PREMIUM);
    return cached[PREMIUM_CONFIG.STORAGE_KEYS.IS_PREMIUM] || false;
  },

  // Create checkout session for subscription
  async createCheckoutSession(plan) {
    const token = await Auth.getSessionToken();
    if (!token) {
      throw new Error('Not signed in');
    }

    const response = await fetch(`${PREMIUM_CONFIG.SERVER_URL}/checkout/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ plan }),
    });

    if (response.status === 401) {
      await Auth.signOut();
      throw new Error('Session expired. Please sign in again.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create checkout session');
    }

    const data = await response.json();
    return data.checkout_url;
  },

  // Create billing portal session
  async createBillingPortalSession() {
    const token = await Auth.getSessionToken();
    if (!token) {
      throw new Error('Not signed in');
    }

    const response = await fetch(`${PREMIUM_CONFIG.SERVER_URL}/billing/portal`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      await Auth.signOut();
      throw new Error('Session expired. Please sign in again.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to create billing portal session');
    }

    const data = await response.json();
    return data.url;
  },
};
