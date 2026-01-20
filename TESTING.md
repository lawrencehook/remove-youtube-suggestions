# Testing Guide

This file consolidates testing instructions and checklists for the RYS extension + premium server.

---

## Automated Tests

### Server test suite

From repo root:

```bash
cd server
npm test
```

All tests should pass (currently 46).

---

## Local Server Testing (Manual)

### Start the server

```bash
cd server
npm run dev
```

### Health check

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Magic link flow

1) Send magic link:

```bash
curl -X POST http://localhost:3000/auth/send-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

2) Check your email for the magic link

3) Click the link (or copy the `request_id` and test poll endpoint)

4) Poll for verification:

```bash
curl "http://localhost:3000/auth/poll?request_id=YOUR_REQUEST_ID"
```

### Stripe test mode

1) Ensure you are using test mode API keys
2) Use Stripe test card `4242 4242 4242 4242`
3) Any future expiry date and any CVC

---

## Extension Smoke Tests

- Sign-in flow: click `Sign In`, enter email, confirm magic link arrives, click it, see “Signed in successfully” and `Account` label.
- Poll cancel: start sign-in, hit `Cancel`, confirm spinner stops and no sign-in happens after cancel.
- Premium gate: mark one option as premium, ensure non‑premium click opens upgrade modal, premium account toggles work.
- License refresh: open `Account`, confirm premium label reflects `premium`/`grandfathered` status correctly.
- Upgrade flow: choose monthly/yearly, click checkout, verify Stripe checkout opens in new tab.
- Billing portal: with active subscription, click “Manage Subscription”, verify portal opens and return page works.

---

## Subscription System Checklist

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

## Pre-Launch Verification Checklist

- [ ] All tests pass locally
- [ ] Server starts without errors
- [ ] `/health` endpoint returns OK
- [ ] Magic link emails are received
- [ ] Magic link verification works
- [ ] Grandfathered users show as premium
- [ ] Stripe checkout creates a session
- [ ] Stripe webhook is configured and verified
- [ ] Billing portal is accessible
- [ ] SSL certificate is valid
- [ ] CORS works from extension origins

### Stripe webhook verification

1) Go to Stripe Dashboard → Webhooks → your endpoint
2) Click "Send test webhook"
3) Select `checkout.session.completed`
4) Check server logs for the event

### End-to-end test (test mode)

1) Start fresh (no auth token stored)
2) Send magic link to your email
3) Click magic link
4) Verify you get a session token
5) Check license status (should be non-premium)
6) Create checkout session
7) Complete payment with test card
8) Check license status (should be premium)
9) Access billing portal
10) Cancel subscription
11) Check license status (should be non-premium after webhook)
