// License checking module for RYS Premium

const License = {
  // Decode JWT payload (no signature verification - we trust our server)
  _decodeToken(token) {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      // Handle base64url encoding
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch {
      return null;
    }
  },

  // Check premium status from license token (fetches new token if needed)
  async checkLicense(forceRefresh = false) {
    const { STORAGE_KEYS, LICENSE_REFRESH_THRESHOLD_MS } = PREMIUM_CONFIG;

    const cached = await browser.storage.local.get([
      STORAGE_KEYS.SESSION_TOKEN,
      STORAGE_KEYS.LICENSE_TOKEN,
    ]);

    const sessionToken = cached[STORAGE_KEYS.SESSION_TOKEN];
    if (!sessionToken) {
      return { isPremium: false, source: null };
    }

    const licenseToken = cached[STORAGE_KEYS.LICENSE_TOKEN];
    const decoded = this._decodeToken(licenseToken);
    const now = Math.floor(Date.now() / 1000);

    // Check if license token is valid and not expiring soon
    const isValid = decoded && decoded.exp > now;
    const expiresWithinThreshold = decoded && decoded.exp &&
      (decoded.exp - now) < (LICENSE_REFRESH_THRESHOLD_MS / 1000);

    if (!forceRefresh && isValid && !expiresWithinThreshold) {
      // Token valid and not expiring soon - use cached value
      if (typeof recordEvent === 'function') {
        recordEvent('License Check', { isPremium: decoded.premium, cached: true });
      }
      return {
        isPremium: decoded.premium,
        source: decoded.grandfathered ? 'grandfathered' : null,
        cached: true,
      };
    }

    // Fetch fresh license token from server
    try {
      const response = await fetch(`${PREMIUM_CONFIG.SERVER_URL}/license/check`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      });

      if (response.status === 401) {
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
      await browser.storage.local.set({
        [STORAGE_KEYS.LICENSE_TOKEN]: data.license_token,
      });

      const newDecoded = this._decodeToken(data.license_token);
      const isPremium = newDecoded?.premium || false;
      const source = newDecoded?.grandfathered ? 'grandfathered' : null;

      if (typeof recordEvent === 'function') {
        recordEvent('License Check', { isPremium, source, cached: false });
      }

      return { isPremium, source };
    } catch (err) {
      console.error('License check error:', err);

      // Network error - use existing token if still valid (not expired)
      if (isValid) {
        if (typeof recordEvent === 'function') {
          recordEvent('License Check', { error: 'offline', offline: true, isPremium: decoded.premium });
        }
        return {
          isPremium: decoded.premium,
          source: decoded.grandfathered ? 'grandfathered' : null,
          offline: true,
        };
      }

      if (typeof recordEvent === 'function') {
        recordEvent('License Check', { error: 'offline_token_expired' });
      }
      return { isPremium: false, source: null, error: true };
    }
  },

  // Quick check for premium status (uses license token only, no network)
  async isPremium() {
    const cached = await browser.storage.local.get(PREMIUM_CONFIG.STORAGE_KEYS.LICENSE_TOKEN);
    return this.isPremiumSync(cached[PREMIUM_CONFIG.STORAGE_KEYS.LICENSE_TOKEN]);
  },

  // Synchronous check given a license token string
  isPremiumSync(token) {
    const decoded = this._decodeToken(token);
    if (!decoded) return false;
    const now = Math.floor(Date.now() / 1000);
    return decoded.premium === true && decoded.exp > now;
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
