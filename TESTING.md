# Manual Testing Guide — Premium Subscription

This document covers all manual testing paths for the premium monetization feature.

## Prerequisites

- Extension loaded unpacked in Chrome (or Firefox)
- Server running locally or deployed to `server.lawrencehook.com`
- Stripe test mode configured with test price IDs
- AWS SES configured (or use a local email trap)
- At least one email in `data/grandfathered.json` for grandfathered testing
- A separate non-grandfathered email for regular user testing
- Stripe CLI installed for webhook testing (`stripe listen --forward-to localhost:3000/rys/webhook/stripe`)

---

## 1. Initial State (Not Signed In)

### 1.1 Options page loads correctly
- [ ] Open extension popup — settings menu shows "Sign In" (not "Account")
- [ ] "Donate" link visible in header, links to PayPal

### 1.2 Free features work without sign-in
- [ ] Toggle a non-premium feature (e.g., "Hide homepage recommendations")
- [ ] Verify it takes effect on YouTube

### 1.3 Premium feature click — not signed in
- [ ] Click any premium-gated toggle (marked with a lock/premium indicator)
- [ ] Verify the "Premium Required" modal appears
- [ ] Click "Cancel" — modal closes, setting unchanged
- [ ] Click the premium toggle again, then click "Sign In" in the modal
- [ ] Verify a new tab opens to `main.html?signin=1` and the popup closes

### 1.4 Schedule and Password (premium settings menu items)
- [ ] Click "Schedule" in the settings menu — Premium Required modal appears
- [ ] Click "Password" in the settings menu — Premium Required modal appears

---

## 2. Sign-In Flow

### 2.1 Happy path — sign in from new tab
- [ ] From the options tab (`main.html?signin=1`), sign-in modal opens automatically
- [ ] Enter a valid email, press Enter (or click send button)
- [ ] Modal transitions to waiting state with countdown timer
- [ ] Check email — magic link email received from the configured sender
- [ ] Click magic link — browser opens server success page ("You're signed in!")
- [ ] Return to extension tab — modal closes, status shows "Signed in successfully"
- [ ] Header now shows "Account" instead of "Sign In"

### 2.2 Sign in from popup
- [ ] Open extension popup, click "Sign In"
- [ ] Verify popup closes and a new tab opens to `main.html?signin=1`
- [ ] Complete the sign-in flow in the new tab

### 2.3 Invalid email
- [ ] Enter an invalid email (no @ symbol)
- [ ] Verify "Please enter a valid email" status message appears
- [ ] No network request is made

### 2.4 Rate limiting
- [ ] Send 5 magic link requests for the same email in rapid succession
- [ ] On the 6th attempt, verify a rate limit error message appears
- [ ] Wait for the rate limit window to pass (or clear rate limit data on server)

### 2.5 Cancel during polling
- [ ] Start sign-in flow, reach waiting state
- [ ] Click "Cancel" button
- [ ] Verify modal closes and polling stops (no continued network requests)
- [ ] Verify user is still not signed in

### 2.6 Poll timeout
- [ ] Start sign-in flow but do NOT click the magic link
- [ ] Wait for the 16-minute countdown to reach 0
- [ ] Verify error state appears with "Verification timed out" message
- [ ] Click "Retry" — email form reappears

### 2.7 Expired magic link
- [ ] Start sign-in flow, wait >15 minutes, then click the magic link
- [ ] Verify the server shows an error page (link expired)
- [ ] Extension should show error state when poll detects 404

### 2.8 Multiple sign-in attempts
- [ ] Start sign-in, reach waiting state
- [ ] Close modal, reopen, start a new sign-in with a different email
- [ ] Verify the previous polling is aborted (no interference)

---

## 3. Signed-In, Free User

### 3.1 Account modal
- [ ] Click "Account" in settings menu
- [ ] Verify Account modal opens showing:
  - Your email address
  - "Free Plan" status
  - "Upgrade" button visible
  - "Billing" button hidden
  - "Sign Out" button visible

### 3.2 Premium feature click — signed in, not premium
- [ ] Click a premium feature toggle
- [ ] Verify the Upgrade modal appears (NOT the Premium Required modal)

### 3.3 Upgrade modal
- [ ] Verify Upgrade modal shows plan selection (Monthly / Yearly)
- [ ] Verify Yearly is selected by default
- [ ] Click Monthly — verify it becomes selected
- [ ] Click Yearly — verify it becomes selected
- [ ] Click "Cancel" — modal closes

### 3.4 License check — no subscription
- [ ] Open DevTools, check console for `[license] email -> free` on server
- [ ] Verify `is_premium` attribute on `<html>` is `"false"`

---

## 4. Checkout / Purchase Flow

### 4.1 Monthly subscription
- [ ] Click a premium feature → Upgrade modal
- [ ] Select "Monthly", click "Subscribe"
- [ ] Verify Stripe Checkout opens in a new tab
- [ ] Complete payment with Stripe test card (`4242 4242 4242 4242`)
- [ ] Verify Stripe success page appears
- [ ] Return to extension tab (click on it or close Stripe tab)
- [ ] Verify extension auto-refreshes license (visibility/focus event triggers refresh)
- [ ] Verify the premium feature you clicked is now enabled
- [ ] Verify "Donate" link changed to "Premium" in header

### 4.2 Yearly subscription
- [ ] Sign out, sign in with a different email
- [ ] Repeat checkout flow selecting "Yearly"
- [ ] Verify Stripe Checkout shows the yearly price
- [ ] Complete payment and verify premium activates

### 4.3 Cancel checkout
- [ ] Open Upgrade modal, click "Subscribe"
- [ ] On Stripe Checkout page, click back or close the tab
- [ ] Return to extension — verify user is still on Free Plan
- [ ] Verify no error messages appear

### 4.4 Checkout with expired session
- [ ] Clear `session_token` from `chrome.storage.local` manually (DevTools → Application → Local Storage)
- [ ] Try to subscribe — verify error about session expired
- [ ] Verify user is signed out and prompted to sign in again

---

## 5. Premium User Experience

### 5.1 All premium features accessible
- [ ] Toggle several premium features on — verify they take effect on YouTube
- [ ] Toggle them off — verify they revert

### 5.2 Account modal — premium subscriber
- [ ] Open Account modal
- [ ] Verify it shows:
  - Your email
  - "Premium Active" status
  - "Billing" button visible
  - "Upgrade" button hidden
  - "Sign Out" button

### 5.3 Billing portal
- [ ] Click "Billing" button in Account modal
- [ ] Verify Stripe billing portal opens in new tab
- [ ] Verify you can see subscription details, update payment method, cancel
- [ ] Close billing portal tab, return to extension

### 5.4 Schedule (premium feature)
- [ ] Click "Schedule" in settings menu
- [ ] Verify Schedule modal opens (not blocked by premium gate)
- [ ] Configure a schedule and verify it works

### 5.5 Password (premium feature)
- [ ] Click "Password" in settings menu
- [ ] Verify Password modal opens (not blocked by premium gate)
- [ ] Set a password, close settings, reopen — verify password prompt appears
- [ ] Enter correct password — verify unlock works
- [ ] Disable password — verify it's removed

---

## 6. Grandfathered User

### 6.1 Sign in with grandfathered email
- [ ] Sign in with an email that's in `data/grandfathered.json`
- [ ] Verify license check returns `grandfathered: true`

### 6.2 Account modal — grandfathered
- [ ] Open Account modal
- [ ] Verify it shows:
  - Your email
  - "Lifetime Premium" status
  - "Billing" button hidden (no subscription to manage)
  - "Upgrade" button hidden
  - "Sign Out" button

### 6.3 Premium features work
- [ ] Verify all premium features are accessible
- [ ] Verify "Donate" link shows "Premium"

### 6.4 Case-insensitive matching
- [ ] Add `test@example.com` to `grandfathered.json`
- [ ] Sign in with `Test@Example.com` (different case)
- [ ] Verify user is recognized as grandfathered

---

## 7. Sign Out

### 7.1 Sign out clears state
- [ ] While signed in (premium or free), click "Sign Out" in Account modal
- [ ] Verify header changes back to "Sign In"
- [ ] Verify "Donate" link reappears (if was showing "Premium")
- [ ] Verify premium features are re-gated

### 7.2 Storage is cleared
- [ ] After sign-out, check `chrome.storage.local` in DevTools
- [ ] Verify `session_token`, `license_token`, and `user_email` are removed
- [ ] Verify YouTube settings (non-premium) are NOT affected

---

## 8. Session Expiry

### 8.1 Expired session token
- [ ] Sign in, then manually modify the `session_token` in storage to an expired JWT
- [ ] Open Account modal (or trigger a license check)
- [ ] Verify "Session expired. Please sign in again." message appears
- [ ] Verify user is automatically signed out
- [ ] Verify sign-in modal opens

### 8.2 Invalid session token
- [ ] Replace `session_token` with garbage string in storage
- [ ] Trigger a license check
- [ ] Verify 401 from server causes automatic sign-out

---

## 9. License Token Caching & Refresh

### 9.1 Cached token is used
- [ ] Sign in as premium user, verify license check succeeds
- [ ] Disconnect from network (or stop the server)
- [ ] Close and reopen extension popup
- [ ] Verify premium features are still accessible (cached license token is valid)

### 9.2 Expired cached token without network
- [ ] Manually set `license_token` to an expired JWT in storage
- [ ] With server unreachable, open extension
- [ ] Verify user shows as non-premium (expired cache, can't refresh)

### 9.3 Token refresh near expiry
- [ ] Set a license token that expires within 24 hours (modify JWT payload)
- [ ] Open extension with server running
- [ ] Verify a fresh license check is triggered (not using cache)

### 9.4 Force refresh after checkout
- [ ] Complete a checkout flow
- [ ] Verify the extension calls `checkLicense(true)` (force refresh)
- [ ] Monitor network tab — a `/license/check` request should fire immediately on tab focus

---

## 10. Subscription Lifecycle

### 10.1 Cancel subscription via billing portal
- [ ] As a premium user, open Billing portal
- [ ] Cancel the subscription in Stripe
- [ ] Return to extension, close and reopen popup
- [ ] Wait for license token to expire (or force refresh)
- [ ] Verify user shows as "Free Plan" after refresh
- [ ] Verify premium features are re-gated

### 10.2 Resubscribe after cancellation
- [ ] After cancellation, click a premium feature
- [ ] Go through checkout flow again
- [ ] Verify premium re-activates

---

## 11. Stripe Webhooks

### 11.1 Webhook receives events
- [ ] With Stripe CLI forwarding, complete a checkout
- [ ] Verify `checkout.session.completed` event is logged on server
- [ ] Cancel subscription — verify `customer.subscription.deleted` is logged

### 11.2 Invalid webhook signature
- [ ] Send a POST to `/webhook/stripe` with invalid/missing `Stripe-Signature` header
- [ ] Verify 400 response

---

## 12. Cross-Browser

### 12.1 Chrome
- [ ] Run through sign-in, checkout, and premium feature flows on Chrome

### 12.2 Firefox
- [ ] Load extension in Firefox
- [ ] Verify sign-in flow works (popup-to-tab handoff, polling)
- [ ] Verify premium features gate correctly
- [ ] Verify `browser.storage.local` API works as expected

---

## 13. Edge Cases

### 13.1 Multiple tabs
- [ ] Open extension settings in two tabs
- [ ] Sign in on one tab
- [ ] Refresh the second tab — verify it reflects signed-in state

### 13.2 Rapid feature toggle clicks
- [ ] Click a premium feature rapidly multiple times
- [ ] Verify only one modal opens, no duplicate modals or errors

### 13.3 Network failure during sign-in
- [ ] Start sign-in, disconnect network after magic link is sent
- [ ] Verify polling handles network errors gracefully (retries silently)
- [ ] Reconnect network — verify polling resumes and succeeds when link is clicked

### 13.4 Server down during license check
- [ ] Sign in successfully, then stop the server
- [ ] Trigger a license check (reopen popup)
- [ ] Verify cached license token is used if still valid
- [ ] Verify no error shown to user

### 13.5 Extension update while signed in
- [ ] Sign in and get premium status
- [ ] Reload the extension (simulate update)
- [ ] Verify session and license tokens persist across reload
- [ ] Verify premium status is maintained

---

## 14. Analytics Verification

Use Mixpanel (or check console logs) to verify events fire correctly:

- [ ] `Sign In Started` — when email is submitted
- [ ] `Magic Link Sent` — after server responds
- [ ] `Sign In Success` — after verification completes
- [ ] `Sign In Canceled` — when user cancels polling
- [ ] `Sign In Error` — on timeout or failure
- [ ] `Premium Feature Click` — with correct `signedIn` flag
- [ ] `Upgrade Modal Opened` — when upgrade modal shows
- [ ] `Checkout Started` — with correct `plan` value
- [ ] `Checkout Completed` — after returning from successful checkout
- [ ] `Account Modal Opened` — with `isPremium` and `source`
- [ ] `Billing Portal Opened` — when billing portal opens
- [ ] `Session Expired` — when 401 triggers sign-out
- [ ] `Sign Out` — when user signs out
- [ ] `License Check` — with `cached`, `offline`, `isPremium` properties
