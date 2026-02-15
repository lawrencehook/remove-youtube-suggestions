# RYS Premium Server

Backend server for the premium subscription system.

## Quick Start

```bash
# Install dependencies
npm install

# Copy env and fill in values
cp .env.example .env

# Run tests
npm test

# Start development server
npm run dev

# Start production server
npm start
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/auth/send-magic-link` | POST | No | Send magic link email |
| `/auth/verify` | GET | No | Magic link target (HTML) |
| `/auth/poll` | GET | No | Poll for verification status |
| `/license/check` | GET | Yes | Check premium status |
| `/checkout/create` | POST | Yes | Create Stripe checkout session |
| `/checkout/success` | GET | No | Success page (HTML) |
| `/checkout/cancel` | GET | No | Cancel page (HTML) |
| `/billing/portal` | POST | Yes | Create billing portal session |
| `/billing/return` | GET | No | Return page (HTML) |
| `/webhook/stripe` | POST | No* | Stripe webhook |

*Authenticated via Stripe signature

## File Structure

```
server/
├── src/
│   ├── index.js        # Entry point
│   ├── config.js       # Configuration
│   ├── routes/         # Express routes
│   ├── services/       # Stripe, JWT, email
│   └── storage/        # File-based storage
├── data/
│   ├── grandfathered.json   # Donor emails (gitignored)
│   ├── auth-requests/       # Pending auth (auto-created)
│   └── rate-limits/         # Rate limit counters (auto-created)
├── tests/
└── package.json
```

## Grandfathered Users

Past donors get lifetime premium. Store emails in `data/grandfathered.json`:

```json
["donor1@example.com", "donor2@example.com"]
```

This file is gitignored. See `data.example/` for format.

## Full Documentation

See [DEPLOYMENT.md](../DEPLOYMENT.md) for complete setup, deployment, and testing instructions.
