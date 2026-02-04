# Premium Subscription System Spec

This document specifies the implementation of a premium subscription system for a browser extension. It is intended to be used as a reference for implementation.

## Overview

The system enables monetization of a free, open-source browser extension through a subscription model. Users authenticate via email magic links, purchase subscriptions through Stripe, and the extension gates premium features based on subscription status.

### Key Design Decisions

- **Single public repo**: Premium feature code is not hidden. Access is gated by license checks.
- **No application database**: Stripe is the source of truth for subscription status.
- **Magic link authentication**: Users verify email ownership by clicking a link sent to their inbox.
- **Polling-based handoff**: Extension polls the server to detect when magic link has been clicked.
- **Bypass tolerance**: Determined users circumventing the paywall is acceptable.

---

## Configuration Constants

All timing values should be defined in a central config file for easy adjustment.

| Constant | Default Value | Description |
|----------|---------------|-------------|
| `MAGIC_LINK_EXPIRY` | 15 minutes | How long a magic link remains valid |
| `REQUEST_ID_EXPIRY` | 20 minutes | How long the server holds a pending auth request |
| `POLL_INTERVAL` | 2 seconds | How often extension polls during auth |
| `POLL_TIMEOUT` | 16 minutes | How long extension polls before giving up |
| `SESSION_TOKEN_LIFETIME` | 30 days | How long a session token remains valid |
| `LICENSE_TOKEN_LIFETIME` | 3 days | How long a license token remains valid |
| `GRANDFATHERED_TOKEN_LIFETIME` | 730 days | How long a grandfathered license token remains valid |
| `LICENSE_REFRESH_THRESHOLD` | 24 hours | Refresh license token if expiring within this window |
| `RATE_LIMIT_WINDOW` | 1 hour | Rate limit window for magic link requests |
| `RATE_LIMIT_MAX_REQUESTS` | 5 | Max magic link requests per email per window |

---

## Data Models

### AuthRequest (server-side, in-memory or temporary storage)

Temporary record created when user initiates login. Can be stored in Redis, or in-memory if single-server.

```
{
  request_id: string,      // Random, unguessable ID (e.g., UUID v4)
  email: string,           // User's email address
  status: "pending" | "verified",
  created_at: timestamp,
  session_token: string | null   // Populated once verified
}
```

### Session Token (JWT)

Issued after successful magic link verification. Contains:

```
{
  email: string,           // Verified email address
  iat: number,             // Issued at timestamp
  exp: number              // Expiration timestamp
}
```

Signed with a server-side secret (`JWT_SECRET` environment variable).

### License Token (JWT)

Issued by the server during license checks. Embedded premium status avoids extra network calls. Contains:

```
{
  email: string,           // User's email address
  premium: boolean,        // Whether user has premium access
  grandfathered: boolean,  // Whether user is a past donor
  exp: number              // Expiration timestamp
}
```

Lifetime is 3 days for regular users, 730 days for grandfathered users. The extension refreshes the token when it's within 24 hours of expiry.

### Extension Local Storage

Stored via `chrome.storage.local` (works in both Chrome and Firefox):

```
{
  session_token: string | null,    // JWT from auth flow
  license_token: string | null,    // JWT with embedded premium status
  user_email: string | null        // User's email for display
}
```

---

## Pricing

| Plan | Price | Stripe Price ID |
|------|-------|-----------------|
| Monthly | $X.XX/month | Set in environment variable `STRIPE_PRICE_MONTHLY` |
| Yearly | $X.XX/year | Set in environment variable `STRIPE_PRICE_YEARLY` |

Yearly plan should be positioned as a discount (e.g., ~2 months free).

---

## Server Specification

### Environment Variables

```
JWT_SECRET=<random-secret-for-signing-tokens>
STRIPE_SECRET_KEY=<stripe-secret-key>
STRIPE_PRICE_MONTHLY=<stripe-price-id>
STRIPE_PRICE_YEARLY=<stripe-price-id>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-signing-secret>
EMAIL_FROM=<sender-email-address>
BASE_URL=<https://yourserver.com>
AWS_REGION=<aws-region>              # defaults to us-east-1
DATA_DIR=<data-directory-path>       # defaults to ./data
```

Email is sent via AWS SES. AWS credentials are expected via standard environment or IAM role.

### Endpoints

---

#### `POST /auth/send-magic-link`

Initiates the authentication flow.

**Request body:**
```json
{
  "email": "user@example.com"
}
```

**Server behavior:**
1. Validate email format
2. Generate a random `request_id` (UUID v4)
3. Store AuthRequest with status "pending"
4. Send email containing link: `{BASE_URL}/auth/verify?token={request_id}`
5. Return `request_id` to caller

**Response:**
```json
{
  "request_id": "abc123..."
}
```

**Errors:**
- `400` — Invalid email format
- `429` — Rate limited (5 requests per email per hour). Response includes `Retry-After` header.

---

#### `GET /auth/verify`

Magic link target. User's browser hits this when they click the email link.

**Query parameters:**
- `token` — The `request_id`

**Server behavior:**
1. Look up AuthRequest by `request_id`
2. If not found or expired → show error page
3. If found and pending:
   - Generate JWT session token with user's email
   - Update AuthRequest: status = "verified", session_token = JWT
4. Show success page: "You're signed in! You can close this tab."

**Response:** HTML page (not JSON)

---

#### `GET /auth/poll`

Extension polls this to check if magic link has been clicked.

**Query parameters:**
- `request_id` — The `request_id` returned from `/auth/send-magic-link`

**Server behavior:**
1. Look up AuthRequest by `request_id`
2. If not found or expired → return error
3. If status is "pending" → return pending status
4. If status is "verified" → return session token, then delete the AuthRequest

**Response (pending):**
```json
{
  "status": "pending"
}
```

**Response (verified):**
```json
{
  "status": "verified",
  "session_token": "eyJhbGc...",
  "email": "user@example.com"
}
```

**Errors:**
- `404` — Unknown or expired `request_id`

---

#### `GET /license/check`

Returns a signed license token containing the user's premium status.

**Headers:**
```
Authorization: Bearer <session_token>
```

**Server behavior:**
1. Validate and decode JWT session token
2. Extract email from token
3. Check if email is in the grandfathered list (case-insensitive)
4. If grandfathered → return license token with `premium: true, grandfathered: true` (730-day lifetime)
5. Otherwise, query Stripe for customer by email
6. Check for active subscription
7. Return license token with `premium: true/false, grandfathered: false` (3-day lifetime)

**Response:**
```json
{
  "license_token": "eyJhbGc..."
}
```

The license token is a JWT containing `{ email, premium, grandfathered, exp }`.

**Errors:**
- `401` — Missing, invalid, or expired session token

---

#### `POST /checkout/create`

Creates a Stripe Checkout session for purchasing a subscription.

**Headers:**
```
Authorization: Bearer <session_token>
```

**Request body:**
```json
{
  "plan": "monthly" | "yearly"
}
```

**Server behavior:**
1. Validate and decode JWT
2. Extract email from token
3. Look up or create Stripe customer by email
4. Create Stripe Checkout session with:
   - Customer ID
   - Appropriate price ID based on plan
   - Success URL: `{BASE_URL}/checkout/success`
   - Cancel URL: `{BASE_URL}/checkout/cancel`
5. Return checkout URL

**Response:**
```json
{
  "checkout_url": "https://checkout.stripe.com/..."
}
```

**Errors:**
- `401` — Missing, invalid, or expired token
- `400` — Invalid plan value

---

#### `POST /webhook/stripe`

Receives Stripe webhook events.

**Headers:**
- `Stripe-Signature` — Used to verify webhook authenticity

**Server behavior:**
1. Verify webhook signature using `STRIPE_WEBHOOK_SECRET`
2. Handle relevant events:
   - `checkout.session.completed` — Subscription created (optional: send welcome email)
   - `customer.subscription.deleted` — Subscription canceled
   - `customer.subscription.updated` — Subscription changed
   - `invoice.payment_failed` — Payment failed (optional: send warning email)

Since Stripe is the source of truth, these events are mainly useful for sending transactional emails or logging. The `/license/check` endpoint always queries Stripe directly.

**Response:**
```json
{
  "received": true
}
```

---

#### `GET /checkout/success`

Simple HTML page shown after successful checkout.

**Content:** "Payment successful! You can close this tab and return to the extension."

---

#### `GET /checkout/cancel`

Simple HTML page shown if user cancels checkout.

**Content:** "Payment canceled. You can close this tab and try again from the extension."

---

#### `POST /billing/portal`

Creates a Stripe billing portal session for managing an existing subscription.

**Headers:**
```
Authorization: Bearer <session_token>
```

**Server behavior:**
1. Validate and decode JWT
2. Look up Stripe customer by email
3. Create billing portal session
4. Return portal URL

**Response:**
```json
{
  "url": "https://billing.stripe.com/..."
}
```

**Errors:**
- `401` — Missing, invalid, or expired token
- `404` — No Stripe customer found for this email

---

#### `GET /billing/return`

Simple HTML page shown after returning from the Stripe billing portal.

**Content:** "Billing updated. You can close this tab and return to the extension."

---

### Stripe API Usage

**Find customer by email:**
```
stripe.customers.list({ email: email, limit: 1 })
```

**Check for active subscription:**
```
stripe.subscriptions.list({ customer: customer_id, status: 'active', limit: 1 })
```

**Create customer:**
```
stripe.customers.create({ email: email })
```

**Create checkout session:**
```
stripe.checkout.sessions.create({
  customer: customer_id,
  mode: 'subscription',
  line_items: [{ price: price_id, quantity: 1 }],
  success_url: success_url,
  cancel_url: cancel_url
})
```

---

## Extension Specification

### Permissions Required

**manifest.json (Manifest V3 for Chrome, V2/V3 for Firefox):**

```json
{
  "permissions": [
    "storage"
  ],
  "host_permissions": [
    "*://*.youtube.com/*"
  ]
}
```

No special permissions beyond storage and YouTube host access. The premium server is accessed via `fetch()` which does not require additional host permissions in MV3.

---

### Auth Module

Handles sign-in and session management.

#### `sendMagicLink(email: string): Promise<string>`

1. Call `POST /auth/send-magic-link` with email
2. Handle 429 (rate limit) with user-friendly error
3. Return `request_id`

#### `pollForVerification(requestId, onStatusUpdate, options): Promise<Result>`

1. Call `GET /auth/poll?request_id={requestId}` every 2 seconds
2. If status is "pending", call `onStatusUpdate` with elapsed time, continue polling
3. If status is "verified", store session token and email in `chrome.storage.local`, return `{ success: true }`
4. Timeout after 16 minutes with error
5. Supports `AbortController` signal via `options.signal` for cancellation
6. If aborted, return `{ canceled: true }`
7. Network errors during polling are silently retried; fatal errors (404, non-OK) throw

#### `isSignedIn(): Promise<boolean>`

Returns true if a session token exists in storage.

#### `getUserEmail(): Promise<string | null>`

Returns the stored user email.

#### `getSessionToken(): Promise<string | null>`

Returns the stored session token.

#### `signOut(): Promise<void>`

Clears session token, license token, and email from `chrome.storage.local`.

---

### License Module

Handles premium status checking and caching via license tokens (JWTs with embedded premium status).

#### `checkLicense(forceRefresh?: boolean): Promise<LicenseResult>`

1. Read cached session token and license token from `chrome.storage.local`
2. If no session token, return `{ isPremium: false }`
3. Decode license token JWT (no signature verification — we trust our server)
4. If not forcing refresh, token is valid, and not expiring within 24 hours:
   - Return cached status from token payload
5. Otherwise, call `GET /license/check` with session token
6. If 401 response: auto sign-out, return `{ isPremium: false, signedOut: true }`
7. Store new license token in `chrome.storage.local`
8. Return status from new token
9. On network error: fall back to cached token if still valid (not expired)

Returns `{ isPremium, source, cached?, offline?, signedOut?, error? }` where `source` is `'grandfathered'` or `null`.

#### `isPremium(): Promise<boolean>`

Quick synchronous-style check. Reads cached license token, decodes JWT, returns `true` only if `premium === true` and token not expired. No network call.

#### `createCheckoutSession(plan): Promise<string>`

Calls `POST /checkout/create` with plan, returns checkout URL. Auto signs out on 401.

#### `createBillingPortalSession(): Promise<string>`

Calls `POST /billing/portal`, returns portal URL. Auto signs out on 401.

---

### Checkout Module

Handles upgrade flow.

#### `startCheckout(plan: 'monthly' | 'yearly'): Promise<void>`

1. Get session token from auth module
2. If not signed in, throw error (UI should prompt sign-in first)
3. Call `POST /checkout/create` with plan
4. Open returned `checkout_url` in new tab

---

### Feature Gating

Features are marked with `premium: true` in `src/shared/main.js`. When a user clicks a premium-gated option:

1. Check `HTML.getAttribute('is_premium')`
2. If not premium:
   - Check if signed in via `Auth.isSignedIn()`
   - If not signed in → show Premium Required Modal (then sign-in flow)
   - If signed in but not premium → show Upgrade Modal
3. The `is_premium` attribute is set on page load via `License.checkLicense()` and updated after sign-in, checkout, and tab focus events

Schedule and Password settings menus are also gated with the same `handlePremiumFeatureClick()` handler.

---

### UI Components

1. **Premium Required Modal** (for non-signed-in users)
   - Shown when a non-signed-in user clicks a premium feature
   - "Sign In" button → opens sign-in flow
   - "Cancel" button → closes modal

2. **Sign-In Modal**
   - Email input field with Enter key support
   - "Send magic link" button
   - "Check your email" waiting state with countdown timer (16 min)
   - Cancel button to abort polling (uses AbortController)
   - Error state with retry button
   - **Important**: When triggered from popup, opens a new tab (`main.html?signin=1`) because popup closing would kill the polling loop

3. **Account Modal**
   - Shows signed-in email
   - Premium status display:
     - "Lifetime Premium" (for grandfathered users, no billing button)
     - "Premium Active" (for subscribers, with billing button)
     - "Free Plan" (with upgrade button)
   - Billing button → opens Stripe customer portal in new tab
   - Sign-out button → clears all auth data

4. **Upgrade Modal**
   - Plan selection: Monthly / Yearly (defaults to yearly)
   - "Subscribe" button → creates Stripe checkout session, opens in new tab
   - Sets `awaitingUpgrade` flag; on tab refocus, auto-refreshes license

5. **Header UI changes**
   - "Sign In" text when not signed in → "Account" when signed in
   - "Donate" link → changes to "Premium" (no link) when premium is active

---

## Sequence Diagrams

### Authentication Flow

```
User            Extension              Server                Email
 |                  |                     |                    |
 |--Enter email---->|                     |                    |
 |                  |--POST /send-magic-->|                    |
 |                  |<--{ request_id }----|                    |
 |                  |                     |----Magic link----->|
 |                  |--GET /poll--------->|                    |
 |                  |<--{ pending }-------|                    |
 |                  |       ...           |                    |
 |<-----------------+---------------------+-<--Click link------|
 |                  |                     |                    |
 |                  |                GET /verify               |
 |                  |                     |--Show success page |
 |                  |--GET /poll--------->|                    |
 |                  |<--{ verified, token }                    |
 |                  |                     |                    |
 |                  |--Store token locally|                    |
 |<--Signed in!-----|                     |                    |
```

### License Check Flow

```
Extension                    Server                      Stripe
    |                           |                           |
    |---GET /license/check----->|                           |
    |   (with session token)    |                           |
    |                           |---Get customer by email-->|
    |                           |<--Customer data-----------|
    |                           |                           |
    |                           |---List subscriptions----->|
    |                           |<--Subscription data-------|
    |                           |                           |
    |<--{ premium: true/false }--|                           |
    |                           |                           |
    |---Cache result locally    |                           |
```

### Purchase Flow

```
User            Extension              Server                Stripe
 |                  |                     |                    |
 |--Click upgrade-->|                     |                    |
 |                  |--POST /checkout---->|                    |
 |                  |   { plan: "yearly" }|                    |
 |                  |                     |--Create session--->|
 |                  |                     |<--Session URL------|
 |                  |<--{ checkout_url }--|                    |
 |                  |                     |                    |
 |<--Open checkout--|                     |                    |
 |                  |                     |                    |
 |------------ User completes payment on Stripe ------------->|
 |                  |                     |                    |
 |                  |                     |<--Webhook: paid----|
 |                  |                     |                    |
 |--Return to ext-->|                     |                    |
 |                  |---Check license---->|                    |
 |                  |<--{ premium: true }-|                    |
 |<--Premium active!|                     |                    |
```

---

## Security Considerations

1. **JWT secret**: Use a strong, random secret (>32 characters). Rotate periodically.
2. **HTTPS only**: All server endpoints must be HTTPS.
3. **Webhook verification**: Always verify Stripe webhook signatures.
4. **Rate limiting**: 5 requests per email per hour on `/auth/send-magic-link`. Returns 429 with `Retry-After` header.
5. **Request ID entropy**: UUIDv4 (128 bits of entropy).
6. **Token in memory during polling**: `request_id` kept in memory only, not persisted to storage.
7. **CORS**: Only chrome-extension:// and moz-extension:// origins allowed.
8. **License token decoding**: Extension decodes JWT payload without signature verification (trusts the server). This is acceptable given the bypass-tolerant design.

---

## Error Handling

### Extension-side

- **Network errors**: Show retry option, fall back to cached license status
- **Auth expired**: Clear session, prompt re-login
- **Poll timeout**: Show "Link expired, try again" message

### Server-side

- **Invalid email**: 400 error with message
- **Expired magic link**: Show friendly error page with "Request new link" option
- **Stripe API errors**: Log error, return 500 with generic message
- **Invalid JWT**: 401 error

---

## Testing

See `TESTING.md` for detailed manual testing instructions covering all user paths.

---

## Grandfathered Users

Past donors are stored in `data/grandfathered.json` (array of email strings). During license checks:

1. Email is matched case-insensitively
2. Grandfathered users receive a license token with `premium: true, grandfathered: true` and a 730-day lifetime
3. The UI displays "Lifetime Premium" and hides the billing portal button
4. No Stripe query is made for grandfathered users

## Analytics

Events are tracked via Mixpanel. Key events:

- `License Check` — with `isPremium`, `source`, `cached`, `offline`, `error` properties
- `Premium Feature Click` — with `signedIn` flag
- `Sign In Started`, `Magic Link Sent`, `Sign In Success`, `Sign In Error`, `Sign In Canceled`
- `Checkout Started`, `Checkout Completed`, `Checkout Error` — with `plan` and `source`
- `Upgrade Modal Opened`, `Account Modal Opened`
- `Billing Portal Opened`, `Billing Portal Error`
- `Session Expired`, `Sign Out`

## Future Considerations (Out of Scope)

These are not part of the initial implementation but may be relevant later:

- **Lifetime plans**: One-time purchase option via Stripe
- **Team/family plans**: Multiple users under one subscription
- **Promo codes**: Stripe coupon integration
- **Trial periods**: Free trial before requiring payment
