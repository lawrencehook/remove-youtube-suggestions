// Authentication module for RYS Premium

const Auth = {
  // Send magic link to email
  async sendMagicLink(email) {
    const response = await fetch(`${PREMIUM_CONFIG.SERVER_URL}/auth/send-magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 429) {
        throw new Error(error.error || 'Too many requests. Please wait and try again.');
      }
      throw new Error(error.error || 'Failed to send magic link');
    }

    const data = await response.json();
    return data.request_id;
  },

  // Poll for verification status
  async pollForVerification(requestId, onStatusUpdate, options = {}) {
    const startTime = Date.now();
    const { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } = PREMIUM_CONFIG;
    const signal = options.signal;

    while (Date.now() - startTime < POLL_TIMEOUT_MS) {
      if (signal && signal.aborted) {
        return { canceled: true };
      }
      try {
        const response = await fetch(
          `${PREMIUM_CONFIG.SERVER_URL}/auth/poll?request_id=${encodeURIComponent(requestId)}`,
          { signal }
        );

        if (!response.ok) {
          if (response.status === 404) {
            const error = new Error('Request expired. Please try again.');
            error.fatal = true;
            throw error;
          }
          const error = new Error('Failed to check verification status');
          error.fatal = true;
          throw error;
        }

        const data = await response.json();

        if (data.status === 'verified') {
          // Store session token and email
          await browser.storage.local.set({
            [PREMIUM_CONFIG.STORAGE_KEYS.SESSION_TOKEN]: data.session_token,
            [PREMIUM_CONFIG.STORAGE_KEYS.USER_EMAIL]: data.email,
          });
          return { success: true, email: data.email };
        }

        if (onStatusUpdate) {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          onStatusUpdate({ status: 'pending', elapsed });
        }
      } catch (err) {
        if (err && (err.name === 'AbortError' || (signal && signal.aborted))) {
          return { canceled: true };
        }
        if (err && err.fatal) {
          throw err;
        }
        // Network error, continue polling
        console.error('Poll error:', err);
      }

      if (signal && signal.aborted) {
        return { canceled: true };
      }
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error('Verification timed out. Please request a new link.');
  },

  // Check if user is signed in
  async isSignedIn() {
    const data = await browser.storage.local.get([
      PREMIUM_CONFIG.STORAGE_KEYS.SESSION_TOKEN,
      PREMIUM_CONFIG.STORAGE_KEYS.USER_EMAIL,
    ]);
    return !!data[PREMIUM_CONFIG.STORAGE_KEYS.SESSION_TOKEN];
  },

  // Get current user email
  async getUserEmail() {
    const data = await browser.storage.local.get(PREMIUM_CONFIG.STORAGE_KEYS.USER_EMAIL);
    return data[PREMIUM_CONFIG.STORAGE_KEYS.USER_EMAIL] || null;
  },

  // Get session token
  async getSessionToken() {
    const data = await browser.storage.local.get(PREMIUM_CONFIG.STORAGE_KEYS.SESSION_TOKEN);
    return data[PREMIUM_CONFIG.STORAGE_KEYS.SESSION_TOKEN] || null;
  },

  // Sign out
  async signOut() {
    await browser.storage.local.remove([
      PREMIUM_CONFIG.STORAGE_KEYS.SESSION_TOKEN,
      PREMIUM_CONFIG.STORAGE_KEYS.LICENSE_TOKEN,
      PREMIUM_CONFIG.STORAGE_KEYS.USER_EMAIL,
    ]);
  },
};
