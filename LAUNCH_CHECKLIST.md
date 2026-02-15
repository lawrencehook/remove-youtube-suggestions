# Premium Launch Checklist

## Pre-Launch

### Configuration
- [x] Update `grandfathered.txt` with all donor emails
- [x] Switch Stripe keys from test to production
  - `STRIPE_SECRET_KEY`
  - `STRIPE_PRICE_MONTHLY`
  - `STRIPE_PRICE_YEARLY`
  - `STRIPE_WEBHOOK_SECRET`
- [x] Configure production webhook endpoint in Stripe dashboard
- [x] Verify `EMAIL_FROM` is set correctly for production

### Code
- [ ] Merge `feature/monetize` branch into `main`
- [x] Redeploy server with production config
- [ ] Test production sign-in flow (magic link email)
- [ ] Test production checkout flow (real Stripe)

### Extension
- [ ] Build Chrome extension
- [ ] Build Firefox extension
- [ ] Submit to Chrome Web Store
- [ ] Submit to Firefox Add-ons

### Static Site (lawrencehook.com/rys)
- [ ] Update `/rys/premium/index.html` — change "Premium is Coming" to live copy
- [ ] Add sign-in/upgrade CTA to premium page

## Post-Launch

- [ ] Verify webhooks are received in production
- [ ] Monitor for errors in server logs
- [ ] Test full flow as a new user

## Optional / Deferred

- [ ] Browser action icon — premium indicator in toolbar
- [x] Add timestamps to server logs
