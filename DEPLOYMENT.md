# RYS Premium Server Deployment & Testing Guide

This guide covers deploying the premium subscription server to AWS Lightsail and testing the full monetization flow.

**Server URL:** `https://server.lawrencehook.com/rys/`

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Stripe Setup](#part-1-stripe-setup)
3. [Server Deployment](#part-2-server-deployment)
4. [Apache Configuration](#part-3-apache-configuration)
5. [Extension Setup](#part-4-extension-setup)
6. [Testing the Full Flow](#part-5-testing-the-full-flow)
7. [Troubleshooting](#troubleshooting)
8. [Maintenance](#maintenance)

---

## Prerequisites

- AWS Lightsail instance (Bitnami stack)
- Node.js v20+ on the server
- Stripe account (test mode for development)
- AWS SES configured for sending emails

---

## Part 1: Stripe Setup

### 1.1: Create Products in Stripe

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

### 1.2: Get API Keys

1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy the **Secret key** (starts with `sk_test_...`)

### 1.3: Create Webhook Endpoint

1. Go to https://dashboard.stripe.com/test/webhooks
2. Click **"+ Add endpoint"**
3. Endpoint URL: `https://server.lawrencehook.com/rys/webhook/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_...`)

---

## Part 2: Server Deployment

### 2.1: SSH to Lightsail Instance

```bash
ssh bitnami@your-instance-ip
```

### 2.2: Install Node.js 20+ (if needed)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Should show v20.x.x
```

### 2.3: Install PM2

```bash
sudo npm install -g pm2
```

### 2.4: Clone and Setup Repository

```bash
cd ~/github
git clone https://github.com/lawrencehook/remove-youtube-suggestions.git
cd remove-youtube-suggestions
git checkout feature/monetize
cd server
npm install
```

### 2.5: Create Environment File

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

### 2.6: Create Data Directory

```bash
mkdir -p data
echo '[]' > data/grandfathered.json
```

To add grandfathered users (past donors with lifetime access):
```bash
echo '["donor1@example.com", "donor2@example.com"]' > data/grandfathered.json
```

### 2.7: Test Server Starts

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

### 2.8: Start with PM2

```bash
pm2 start src/index.js --name rys-premium
pm2 save
```

### 2.9: Configure PM2 Auto-Start on Reboot

```bash
pm2 startup
# Run the command it outputs (starts with: sudo env PATH=...)
pm2 save
```

---

## Part 3: Apache Configuration

Your Lightsail instance uses Bitnami's Apache with path-based proxying. Add ProxyPass rules for `/rys/`.

### 3.1: Edit SSL Config (Local Machine)

Edit your local deployments repo:

```bash
nano ~/github/deployments/opt/bitnami/apache/conf/bitnami/bitnami-ssl.conf
```

Add these lines inside the existing `<VirtualHost _default_:443>` block (alongside the other ProxyPass rules):

```apache
  ProxyPass /rys/ http://localhost:3005/
  ProxyPassReverse /rys/ http://localhost:3005/
```

It should look like this with the existing rules:

```apache
  ProxyPass /HeadgumPodcastSearch/ http://localhost:3004/
  ProxyPassReverse /HeadgumPodcastSearch/ http://localhost:3004/

  ProxyPass /rys/ http://localhost:3005/
  ProxyPassReverse /rys/ http://localhost:3005/
```

### 3.2: Deploy Apache Config

Push changes and apply on server:

```bash
# Local machine
cd ~/github/deployments
git add -A && git commit -m "Add RYS Premium server proxy config" && git push

# On server
cd ~/github/deployments && git pull
./update_apache_conf.sh
```

---

## Part 4: Extension Setup

### 4.1: Verify Config Points to Production

The extension should already point to the correct server. Verify in `src/shared/config.js`:

```javascript
const PREMIUM_CONFIG = {
  SERVER_URL: 'https://server.lawrencehook.com/rys',
  // ...
};
```

### 4.2: Build the Extension

**For Chrome:**
```bash
cd ~/github/remove-youtube-suggestions
./make_chrome.sh
```

**For Firefox:**
```bash
./make_firefox.sh
```

### 4.3: Load in Chrome

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right)
4. Click **"Load unpacked"**
5. Select: `~/github/remove-youtube-suggestions/chrome_extension`

### 4.4: Load in Firefox

1. Open Firefox
2. Navigate to `about:debugging#/runtime/this-firefox`
3. Click **"Load Temporary Add-on..."**
4. Select: `~/github/remove-youtube-suggestions/src/firefox_manifest.json`

---

## Part 5: Testing the Full Flow

### 5.1: Verify Server Health

```bash
curl https://server.lawrencehook.com/rys/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 5.2: Test Magic Link Authentication

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

### 5.3: Test License Check

After signing in:
1. Click gear icon → **"Account"**
2. Should show your email and status: **"Free"**

**For grandfathered users:**
- Add email to `data/grandfathered.json` on server
- Restart: `pm2 restart rys-premium`
- Sign out and sign back in
- Status should show: **"Premium (Lifetime - Thank you for your donation!)"**

### 5.4: Test Checkout Flow

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

### 5.5: Test Billing Portal

1. With an active subscription, open Account modal
2. Click **"Manage Subscription"**
3. Stripe billing portal opens in new tab
4. Can cancel subscription here for testing

### 5.6: Test Webhook

In Stripe Dashboard:
1. Go to Webhooks → your endpoint
2. Click **"Send test webhook"**
3. Select `checkout.session.completed`
4. Check server logs: `pm2 logs rys-premium`

### 5.7: Test Premium Feature Gating

To test that premium features are properly gated:

1. Edit `src/shared/main.js`
2. Add `premium: true` to any option (e.g., "Hide all Shorts")
3. Rebuild extension: `./make_chrome.sh`
4. Reload in `chrome://extensions/`
5. As non-premium user: clicking the toggle should show upgrade modal
6. As premium user: toggle should work normally

---

## Troubleshooting

### Server won't start

```bash
# Check logs
pm2 logs rys-premium --lines 50

# Common issues:
# - Missing .env variables
# - JWT_SECRET too short (needs 32+ chars)
# - Port already in use
```

### Magic link emails not sending

```bash
# Check SES is configured
# Verify EMAIL_FROM domain is verified in SES
# If in SES sandbox, recipient must also be verified
```

### CORS errors in extension

```bash
# Verify Apache ProxyPass is configured
# Check server is running on correct port
curl http://localhost:3005/health  # from server
```

### SSL certificate issues

```bash
# Check cert paths in VirtualHost config
# Verify cert covers the subdomain
sudo /opt/bitnami/bncert-tool  # regenerate if needed
```

### Extension can't connect

```bash
# Test endpoint from local machine
curl https://server.lawrencehook.com/rys/health

# Check Apache config on server
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

### Restart Server

```bash
pm2 restart rys-premium
```

### Stop Server

```bash
pm2 stop rys-premium
```

### Check Status

```bash
pm2 status
```

### Add to Deployment Script

Add to `~/github/deployments/run`:

```bash
# RYS Premium Server (pm2)
cd /home/bitnami/github/remove-youtube-suggestions && git checkout -- . && git pull && git checkout feature/monetize;
cd server && npm install && npm audit fix;
pm2 restart rys-premium || pm2 start src/index.js --name rys-premium;
```

---

## Test Credentials Reference

| Item | Value |
|------|-------|
| Test Card (Success) | `4242 4242 4242 4242` |
| Test Card (Declined) | `4000 0000 0000 0002` |
| Test Card (Requires Auth) | `4000 0025 0000 3155` |
| Expiry | Any future date |
| CVC | Any 3 digits |
| ZIP | Any valid ZIP |

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3005` |
| `BASE_URL` | Public URL | `https://server.lawrencehook.com/rys` |
| `JWT_SECRET` | 32+ char secret for signing tokens | (generate with `openssl rand -base64 32`) |
| `STRIPE_SECRET_KEY` | Stripe API secret key | `sk_test_...` |
| `STRIPE_PRICE_MONTHLY` | Monthly plan price ID | `price_...` |
| `STRIPE_PRICE_YEARLY` | Yearly plan price ID | `price_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | `whsec_...` |
| `AWS_REGION` | AWS region for SES | `us-east-1` |
| `EMAIL_FROM` | Sender email address | `noreply@lawrencehook.com` |
