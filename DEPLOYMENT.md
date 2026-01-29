# RYS Premium Server Deployment Guide

Complete guide to deploying the premium subscription server and testing the monetization flow.

**Server URL:** `https://server.lawrencehook.com/rys/`

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Stripe Setup](#stripe-setup)
3. [AWS SES Setup](#aws-ses-setup)
4. [Server Deployment](#server-deployment)
5. [Apache Configuration](#apache-configuration)
6. [Extension Setup](#extension-setup)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

---

## Prerequisites

- AWS Lightsail instance (Bitnami stack)
- Node.js v20+
- Stripe account (test mode for development)
- AWS SES configured for sending emails

---

## Stripe Setup

### Create Products

1. Go to https://dashboard.stripe.com/test/products
2. Click **"+ Add product"**

**Monthly Plan:**
- Name: `RYS Premium Monthly`
- Pricing: `$3.00 USD` / `month` / `recurring`
- Save and copy the **Price ID** (starts with `price_...`)

**Yearly Plan:**
- Name: `RYS Premium Yearly`
- Pricing: `$24.00 USD` / `year` / `recurring`
- Save and copy the **Price ID**

### Get API Keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy the **Secret key** (starts with `sk_test_...`)

### Configure Billing Portal

1. Go to Settings → Billing → Customer portal
2. Enable the customer portal
3. Configure allowed actions:
   - [x] Update payment methods
   - [x] View invoice history
   - [x] Cancel subscriptions
4. Save changes

### Create Webhook Endpoint

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **"+ Add endpoint"**
3. Endpoint URL: `https://server.lawrencehook.com/rys/webhook/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_...`)

---

## AWS SES Setup

### Verify Sender Email/Domain

1. In AWS Console → SES → Verified identities
2. Click "Create identity"
3. For email: click the verification link sent to you
4. For domain: add the DNS records provided

### Request Production Access

SES starts in sandbox mode (can only send to verified emails).

1. Go to SES → Account dashboard
2. Click "Request production access"
3. Fill out the form explaining your use case
4. Wait for approval (usually 24-48 hours)

### IAM Credentials

If not using instance roles, create IAM credentials:

1. Create a new user (e.g., `rys-premium-ses`)
2. Attach policy: `AmazonSESFullAccess`
3. Create access keys
4. Copy the **Access Key ID** and **Secret Access Key**

---

## Server Deployment

### SSH to Lightsail Instance

```bash
ssh bitnami@your-instance-ip
```

### Install Node.js 20+ (if needed)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Should show v20.x.x
```

### Install PM2

```bash
sudo npm install -g pm2
```

### Clone and Setup Repository

```bash
cd ~/github
git clone https://github.com/lawrencehook/remove-youtube-suggestions.git
cd remove-youtube-suggestions
git checkout feature/monetize
cd server
npm install
```

### Create Environment File

```bash
nano .env
```

Paste the following (fill in your values):

```bash
# Server
PORT=3005
BASE_URL=https://server.lawrencehook.com/rys

# JWT (generate with: openssl rand -base64 32)
JWT_SECRET=your-random-secret-at-least-32-characters-long

# Stripe
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
STRIPE_PRICE_MONTHLY=price_YOUR_MONTHLY_ID
STRIPE_PRICE_YEARLY=price_YOUR_YEARLY_ID
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# AWS SES (uses instance role, no explicit credentials needed)
AWS_REGION=us-east-1
EMAIL_FROM=noreply@lawrencehook.com
```

Save: `Ctrl+O`, `Enter`, `Ctrl+X`

### Create Data Directory

```bash
mkdir -p data
echo '[]' > data/grandfathered.json
```

To add grandfathered users (past donors with lifetime access):
```bash
echo '["donor1@example.com", "donor2@example.com"]' > data/grandfathered.json
```

### Test Server Starts

```bash
npm start
```

Expected output:
```
Loaded X grandfathered emails
RYS Premium Server running on port 3005
Base URL: https://server.lawrencehook.com/rys
```

Press `Ctrl+C` to stop.

### Start with PM2

```bash
pm2 start src/index.js --name rys-premium
pm2 save
```

### Configure PM2 Auto-Start on Reboot

```bash
pm2 startup
# Run the command it outputs (starts with: sudo env PATH=...)
pm2 save
```

---

## Apache Configuration

Your Lightsail instance uses Bitnami's Apache with path-based proxying.

### Edit SSL Config

Edit your local deployments repo:

```bash
nano ~/github/deployments/opt/bitnami/apache/conf/bitnami/bitnami-ssl.conf
```

Add these lines inside the `<VirtualHost _default_:443>` block:

```apache
ProxyPass /rys/ http://localhost:3005/
ProxyPassReverse /rys/ http://localhost:3005/
```

### Deploy Apache Config

```bash
# Local machine
cd ~/github/deployments
git add -A && git commit -m "Add RYS Premium server proxy config" && git push

# On server
cd ~/github/deployments && git pull
./update_apache_conf.sh
```

---

## Extension Setup

### Verify Config Points to Production

Check `src/shared/config.js`:

```javascript
const PREMIUM_CONFIG = {
  SERVER_URL: 'https://server.lawrencehook.com/rys',
  // ...
};
```

### Build the Extension

**For Chrome:**
```bash
./make_chrome.sh
```

**For Firefox:**
```bash
./make_firefox.sh
```

### Load in Chrome

1. Navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select: `chrome_extension/`

### Load in Firefox

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on..."**
3. Select: `src/firefox_manifest.json`

---

## Testing

### Automated Tests

```bash
cd server
npm test
```

All tests should pass (currently 46).

### Health Check

```bash
curl https://server.lawrencehook.com/rys/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Magic Link Flow

**Via curl:**
```bash
curl -X POST https://server.lawrencehook.com/rys/auth/send-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
# Expected: {"request_id":"abc123-..."}
```

**Via extension:**
1. Go to any YouTube page
2. Click the RYS extension icon
3. Click the gear icon (settings menu)
4. Click **"Sign In"**
5. Enter your email and click **"Send Sign-In Link"**
6. Check your email and click the magic link
7. Return to extension — should show "Signed in successfully"

### License Check

After signing in:
1. Click gear icon → **"Account"**
2. Should show your email and status: **"Free"**

**For grandfathered users:**
- Add email to `data/grandfathered.json` on server
- Restart: `pm2 restart rys-premium`
- Sign out and sign back in
- Status should show: **"Premium (Lifetime)"**

### Checkout Flow

1. Open Account modal
2. Click **"Upgrade to Premium"**
3. Select a plan (Monthly or Yearly)
4. Click **"Continue to Checkout"**
5. Complete payment with test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any valid ZIP (e.g., `12345`)
6. After success page, return to extension
7. Open Account — status should show **"Premium Active"**

### Billing Portal

1. With an active subscription, open Account modal
2. Click **"Manage Subscription"**
3. Stripe billing portal opens in new tab
4. Can cancel subscription here for testing

### Webhook Verification

1. Go to Stripe Dashboard → Webhooks → your endpoint
2. Click **"Send test webhook"**
3. Select `checkout.session.completed`
4. Check server logs: `pm2 logs rys-premium`

### Extension Smoke Tests

- **Sign-in flow:** Send magic link → click link → see "Signed in successfully"
- **Poll cancel:** Start sign-in → hit Cancel → spinner stops, no sign-in after cancel
- **Premium gate:** Mark option as premium → non-premium click opens upgrade modal
- **License refresh:** Open Account → premium label reflects correct status
- **Upgrade flow:** Choose plan → click checkout → Stripe checkout opens
- **Billing portal:** With subscription → click "Manage Subscription" → portal opens

### Pre-Launch Checklist

- [ ] All automated tests pass
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

### Test Cards Reference

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0025 0000 3155` | Requires authentication |

---

## Troubleshooting

### Server won't start

```bash
pm2 logs rys-premium --lines 50
```

Common issues:
- Missing .env variables
- JWT_SECRET too short (needs 32+ chars)
- Port already in use

### Magic link emails not sending

- Check SES is configured
- Verify EMAIL_FROM domain is verified in SES
- If in SES sandbox, recipient must also be verified

### CORS errors in extension

```bash
# Verify server is running
curl http://localhost:3005/health
```

### SSL certificate issues

```bash
sudo /opt/bitnami/bncert-tool  # regenerate if needed
```

### Extension can't connect

```bash
# Test endpoint
curl https://server.lawrencehook.com/rys/health

# Check Apache config
sudo apachectl configtest
```

---

## Maintenance

### Update Server Code

```bash
cd ~/github/remove-youtube-suggestions
git pull
git checkout feature/monetize
cd server
npm install
pm2 restart rys-premium
```

### View Logs

```bash
pm2 logs rys-premium           # Tail logs
pm2 logs rys-premium --lines 100  # Last 100 lines
```

### Server Commands

```bash
pm2 restart rys-premium  # Restart
pm2 stop rys-premium     # Stop
pm2 status               # Check status
```

### Add to Deployment Script

Add to `~/github/deployments/run`:

```bash
# RYS Premium Server (pm2)
cd /home/bitnami/github/remove-youtube-suggestions && git checkout -- . && git pull && git checkout feature/monetize;
cd server && npm install && npm audit fix;
pm2 restart rys-premium || pm2 start src/index.js --name rys-premium;
```

### Updating Grandfathered List

1. Edit `data/grandfathered.json`
2. Restart: `pm2 restart rys-premium`

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3005` |
| `BASE_URL` | Public URL | `https://server.lawrencehook.com/rys` |
| `JWT_SECRET` | 32+ char secret | (generate with `openssl rand -base64 32`) |
| `STRIPE_SECRET_KEY` | Stripe API secret | `sk_test_...` |
| `STRIPE_PRICE_MONTHLY` | Monthly plan price ID | `price_...` |
| `STRIPE_PRICE_YEARLY` | Yearly plan price ID | `price_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | `whsec_...` |
| `AWS_REGION` | AWS region for SES | `us-east-1` |
| `EMAIL_FROM` | Sender email address | `noreply@lawrencehook.com` |

---

## API Endpoints Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/auth/send-magic-link` | POST | No | Send magic link email |
| `/auth/verify` | GET | No | Magic link target (HTML) |
| `/auth/poll` | GET | No | Poll for auth status |
| `/license/check` | GET | Yes | Check premium status |
| `/checkout/create` | POST | Yes | Create Stripe checkout |
| `/checkout/success` | GET | No | Success page (HTML) |
| `/checkout/cancel` | GET | No | Cancel page (HTML) |
| `/billing/portal` | POST | Yes | Create billing portal session |
| `/billing/return` | GET | No | Return page (HTML) |
| `/webhook/stripe` | POST | No* | Stripe webhook |

*Authenticated via Stripe signature
