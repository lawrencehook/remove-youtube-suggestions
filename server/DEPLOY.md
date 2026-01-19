# Testing and Deployment Guide

This document outlines the manual steps you need to take to test and deploy the premium subscription server.

---

## Prerequisites

Before starting, ensure you have:

- [ ] Node.js 20+ installed
- [ ] An AWS account with SES access
- [ ] A Stripe account
- [ ] A domain for the server (e.g., `api.yourdomain.com`)
- [ ] SSL certificate for the domain (or use a service that provides it)

---

## Part 1: Local Setup

### 1.1 Install Dependencies

```bash
cd server
npm install
```

### 1.2 Create Environment File

```bash
cp .env.example .env
```

### 1.3 Run Tests

```bash
npm test
```

All 46 tests should pass.

---

## Part 2: Stripe Configuration

### 2.1 Create Stripe Account (if needed)

1. Go to https://stripe.com
2. Create an account or sign in
3. Complete business verification (for production)

### 2.2 Create Products and Prices

In Stripe Dashboard → Products:

1. **Create a new product:**
   - Name: "RYS Premium"
   - Description: "Premium features for Remove YouTube Suggestions"

2. **Add Monthly Price:**
   - Click "Add price"
   - Price: $3.00
   - Billing period: Monthly
   - Copy the Price ID (starts with `price_`)

3. **Add Yearly Price:**
   - Click "Add price"
   - Price: $24.00
   - Billing period: Yearly
   - Copy the Price ID

### 2.3 Get API Keys

In Stripe Dashboard → Developers → API keys:

1. Copy the **Secret key** (starts with `sk_test_` or `sk_live_`)
2. For testing, use test mode keys
3. For production, switch to live mode keys

### 2.4 Configure Billing Portal

In Stripe Dashboard → Settings → Billing → Customer portal:

1. Enable the customer portal
2. Configure allowed actions:
   - [x] Update payment methods
   - [x] View invoice history
   - [x] Cancel subscriptions
3. Save changes

### 2.5 Set Up Webhook (after server is deployed)

In Stripe Dashboard → Developers → Webhooks:

1. Click "Add endpoint"
2. URL: `https://your-server.com/webhook/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.payment_succeeded`
4. Copy the **Signing secret** (starts with `whsec_`)

---

## Part 3: AWS SES Configuration

### 3.1 Verify Sender Email/Domain

In AWS Console → SES → Verified identities:

1. Click "Create identity"
2. Choose Email address or Domain
3. For email: click the verification link sent to you
4. For domain: add the DNS records provided

### 3.2 Request Production Access (if needed)

SES starts in sandbox mode (can only send to verified emails).

1. Go to SES → Account dashboard
2. Click "Request production access"
3. Fill out the form explaining your use case
4. Wait for approval (usually 24-48 hours)

### 3.3 Create IAM User for SES

In AWS Console → IAM → Users:

1. Create a new user (e.g., `rys-premium-ses`)
2. Attach policy: `AmazonSESFullAccess` (or create a more restrictive policy)
3. Create access keys
4. Copy the **Access Key ID** and **Secret Access Key**

---

## Part 4: Environment Configuration

Update your `.env` file with all values:

```bash
# Server
PORT=3000
BASE_URL=https://api.yourdomain.com

# JWT - Generate a secure random string (min 32 chars)
# Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-generated-secret-here

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS SES
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
EMAIL_FROM=noreply@yourdomain.com
```

---

## Part 5: Create Grandfathered Donors List

### 5.1 Create Data Directory

```bash
mkdir -p server/data
```

### 5.2 Create Grandfathered File

```bash
# Create with your actual donor emails
cat > server/data/grandfathered.json << 'EOF'
[
  "donor1@example.com",
  "donor2@example.com"
]
EOF
```

**Important:** This file contains private email addresses. Keep it secure and never commit it to git.

---

## Part 6: Local Testing

### 6.1 Start the Server

```bash
npm run dev
```

### 6.2 Test Health Endpoint

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 6.3 Test Magic Link Flow (Manual)

1. **Send magic link:**
```bash
curl -X POST http://localhost:3000/auth/send-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com"}'
```

2. Check your email for the magic link

3. Click the link (or copy the `request_id` and test poll endpoint)

4. **Poll for verification:**
```bash
curl "http://localhost:3000/auth/poll?request_id=YOUR_REQUEST_ID"
```

### 6.4 Test with Stripe Test Mode

1. Ensure you're using test mode API keys
2. Use Stripe test card: `4242 4242 4242 4242`
3. Any future expiry date and any CVC

---

## Part 7: Production Deployment

### 7.1 Server Setup

On your server:

```bash
# Clone repo (or copy files)
git clone <your-repo>
cd remove-youtube-suggestions/server

# Install dependencies
npm install --production

# Create data directory
mkdir -p data

# Copy your grandfathered.json to data/
# Copy your .env file
```

### 7.2 Process Manager (Recommended: PM2)

```bash
# Install PM2
npm install -g pm2

# Start the server
pm2 start src/index.js --name rys-premium

# Save PM2 config
pm2 save

# Set up startup script
pm2 startup
```

### 7.3 Reverse Proxy (Nginx)

Example Nginx configuration:

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 7.4 Configure Stripe Webhook (Now that server is live)

Go back to Stripe Dashboard → Webhooks and add your production endpoint.

---

## Part 8: Verification Checklist

### Pre-Launch Checks

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

### Stripe Webhook Verification

After adding the webhook in Stripe:

1. Go to Webhooks → your endpoint
2. Click "Send test webhook"
3. Select `checkout.session.completed`
4. Check server logs for the event

### End-to-End Test (Test Mode)

1. Start fresh (no auth token stored)
2. Send magic link to your email
3. Click magic link
4. Verify you get a session token
5. Check license status (should be non-premium)
6. Create checkout session
7. Complete payment with test card
8. Check license status (should be premium)
9. Access billing portal
10. Cancel subscription
11. Check license status (should be non-premium after webhook)

---

## Part 9: Monitoring and Maintenance

### Log Monitoring

```bash
# With PM2
pm2 logs rys-premium

# Follow logs
pm2 logs rys-premium --lines 100
```

### Common Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Emails not received | SES sandbox mode | Request production access |
| Webhook 400 errors | Wrong webhook secret | Update STRIPE_WEBHOOK_SECRET |
| 401 on license check | Expired token | Re-authenticate |
| Checkout fails | Missing price ID | Check STRIPE_PRICE_* env vars |

### Updating Grandfathered List

1. Edit `data/grandfathered.json`
2. Restart the server: `pm2 restart rys-premium`

---

## Security Reminders

- [ ] Never commit `.env` to git
- [ ] Never commit `data/grandfathered.json` to git
- [ ] Use strong JWT_SECRET (32+ random characters)
- [ ] Keep Stripe API keys secure
- [ ] Keep AWS credentials secure
- [ ] Use HTTPS in production
- [ ] Regularly rotate secrets

---

## Quick Reference: API Endpoints

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
