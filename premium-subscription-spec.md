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
| `POLL_INTERVAL` | 3 seconds | How often extension polls during auth |
| `POLL_TIMEOUT` | 10 minutes | How long extension polls before giving up |
| `SESSION_TOKEN_LIFETIME` | 30 days | How long a session token remains valid |
| `LICENSE_CACHE_TTL` | 1 hour | How long extension caches premium status |

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

### Extension Local Storage

Stored via `chrome.storage.local` (works in both Chrome and Firefox):

```
{
  auth: {
    sessionToken: string | null,
    email: string | null
  },
  license: {
    isPremium: boolean,
    expiresAt: string | null,      // Subscription end date (ISO 8601)
    checkedAt: number              // Timestamp of last server check
  }
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
```

Plus any email provider credentials (e.g., SendGrid, Resend, AWS SES).

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

Returns the user's premium subscription status.

**Headers:**
```
Authorization: Bearer <session_token>
```

**Server behavior:**
1. Validate and decode JWT
2. Extract email from token
3. Query Stripe for customer by email
4. If no customer found → not premium
5. Query Stripe for active subscriptions for that customer
6. Return premium status and subscription end date if applicable

**Response (premium):**
```json
{
  "premium": true,
  "expires_at": "2025-12-15T00:00:00Z"
}
```

**Response (not premium):**
```json
{
  "premium": false,
  "expires_at": null
}
```

**Errors:**
- `401` — Missing, invalid, or expired token

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
    "https://yourserver.com/*"
  ]
}
```

No special permissions beyond storage and server communication.

---

### Auth Module

Handles sign-in and session management.

#### `signIn(email: string): Promise<void>`

1. Call `POST /auth/send-magic-link` with email
2. Store `request_id` in memory
3. Begin polling loop

#### `pollForVerification(requestId: string): Promise<SessionData>`

1. Call `GET /auth/poll?request_id={requestId}`
2. If status is "pending", wait `POLL_INTERVAL` and retry
3. If status is "verified", return session data
4. Timeout after `POLL_TIMEOUT` with error
5. On success, store session in `chrome.storage.local`

#### `signOut(): Promise<void>`

1. Clear auth and license data from `chrome.storage.local`

#### `getSession(): Promise<SessionData | null>`

1. Read auth data from `chrome.storage.local`
2. Return null if no session token
3. Optionally validate token expiry client-side

---

### License Module

Handles premium status checking and caching.

#### `checkPremiumStatus(forceRefresh?: boolean): Promise<LicenseStatus>`

1. Read cached license from `chrome.storage.local`
2. If cache exists and not expired and not forcing refresh:
   - Return cached status
3. Otherwise:
   - Get session token from auth module
   - If not signed in, return `{ premium: false }`
   - Call `GET /license/check` with auth header
   - Store result in `chrome.storage.local` with current timestamp
   - Return result

#### `isPremium(): Promise<boolean>`

Convenience wrapper around `checkPremiumStatus()`.

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

Use the license module to gate premium features:

```javascript
async function somePremiumFeature() {
  const premium = await isPremium();
  if (!premium) {
    showUpgradePrompt();
    return;
  }
  // ... premium feature logic
}
```

---

### UI Components Required

1. **Sign-in prompt**
   - Email input field
   - "Send magic link" button
   - "Check your email" state with polling indicator
   - Success state

2. **Account status**
   - Show signed-in email
   - Show premium status (if premium: expiry date)
   - Sign-out button

3. **Upgrade prompt**
   - Shown when non-premium user tries to access premium feature
   - Display pricing for monthly and yearly
   - "Subscribe" buttons for each plan

4. **Settings/account page**
   - Manage subscription link (Stripe customer portal)
   - Sign-out option

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

1. **JWT secret**: Use a strong, random secret. Rotate periodically.
2. **HTTPS only**: All server endpoints must be HTTPS.
3. **Webhook verification**: Always verify Stripe webhook signatures.
4. **Rate limiting**: Apply rate limits to `/auth/send-magic-link` to prevent email spam (e.g., 5 requests per email per hour).
5. **Request ID entropy**: Use UUIDv4 or similar for request IDs (128 bits of entropy).
6. **Token in memory during polling**: Don't persist `request_id` to storage; keep in memory only.

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

## Testing Checklist

### Auth flow
- [ ] Magic link email is received
- [ ] Clicking link shows success page
- [ ] Extension detects verification and stores token
- [ ] Sign-out clears stored data
- [ ] Expired magic link shows appropriate error
- [ ] Poll timeout is handled gracefully

### License check
- [ ] Non-signed-in user shows as not premium
- [ ] Signed-in user with no subscription shows as not premium
- [ ] Signed-in user with active subscription shows as premium
- [ ] Cached status is used within TTL
- [ ] Expired cache triggers fresh check

### Purchase flow
- [ ] Checkout redirects to Stripe
- [ ] Successful payment results in premium status
- [ ] Canceled checkout returns user gracefully
- [ ] Both monthly and yearly plans work

### Edge cases
- [ ] User signs in on one device, checks status on another
- [ ] Subscription expires while extension is open
- [ ] Network failure during license check
- [ ] Multiple rapid sign-in attempts

---

## Future Considerations (Out of Scope)

These are not part of the initial implementation but may be relevant later:

- **Customer portal**: Link to Stripe's hosted portal for subscription management
- **Lifetime plans**: One-time purchase option via Stripe
- **Team/family plans**: Multiple users under one subscription
- **Promo codes**: Stripe coupon integration
- **Trial periods**: Free trial before requiring payment
- **Offline grace period**: How long to honor cached premium status if server is unreachable
