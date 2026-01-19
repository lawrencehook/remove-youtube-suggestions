# RYS Premium Server

Backend server for Remove YouTube Suggestions premium subscription system.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the values:
   ```bash
   cp .env.example .env
   ```

3. Configure Stripe:
   - Create products and prices in Stripe dashboard
   - Set up webhook endpoint pointing to `/webhook/stripe`
   - Copy the price IDs and webhook secret to `.env`

4. Configure AWS SES:
   - Verify your sender email in SES
   - Create IAM credentials with SES send permissions
   - Add credentials to `.env`

## Running

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

## Testing

```bash
npm test
```

## API Endpoints

### Authentication

- `POST /auth/send-magic-link` - Send magic link email
- `GET /auth/verify?token={request_id}` - Magic link target (HTML)
- `GET /auth/poll?request_id={id}` - Poll for verification status

### License

- `GET /license/check` - Check premium status (requires auth)

### Checkout

- `POST /checkout/create` - Create Stripe checkout session (requires auth)
- `GET /checkout/success` - Success page (HTML)
- `GET /checkout/cancel` - Cancel page (HTML)

### Billing

- `POST /billing/portal` - Create Stripe billing portal session (requires auth)
- `GET /billing/return` - Return page from portal (HTML)

### Webhook

- `POST /webhook/stripe` - Stripe webhook receiver

### Health

- `GET /health` - Health check

## File Structure

```
server/
├── src/
│   ├── index.js           # Main entry point
│   ├── config.js          # Configuration constants
│   ├── routes/            # Express route handlers
│   │   ├── auth.js
│   │   ├── license.js
│   │   ├── checkout.js
│   │   ├── billing.js
│   │   └── webhook.js
│   ├── services/          # Business logic
│   │   ├── email.js       # AWS SES integration
│   │   ├── jwt.js         # JWT token handling
│   │   └── stripe.js      # Stripe API integration
│   └── storage/           # File-based storage
│       └── index.js
├── data/
│   ├── grandfathered.json # Donor emails (read-only)
│   ├── auth-requests/     # Pending auth requests (auto-created)
│   └── rate-limits/       # Rate limit counters (auto-created)
├── tests/
└── package.json
```

## Grandfathered Users

Past donors are stored in `data/grandfathered.json` as a simple array of email addresses. This file is read-only and cached in memory on server start. These users receive lifetime premium access.

**Note:** The `data/` directory is gitignored to protect donor privacy. See `data.example/` for the expected format. On deployment, create `data/grandfathered.json` with actual donor emails.

```json
[
  "donor1@example.com",
  "donor2@example.com"
]
```
