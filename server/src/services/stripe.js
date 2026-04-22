const Stripe = require('stripe');
const config = require('../config');

const stripe = new Stripe(config.STRIPE_SECRET_KEY);

async function findCustomerByEmail(email) {
  const customers = await stripe.customers.list({
    email: email.toLowerCase(),
    limit: 1,
  });
  return customers.data[0] || null;
}

async function createCustomer(email) {
  return stripe.customers.create({
    email: email.toLowerCase(),
  });
}

async function findOrCreateCustomer(email) {
  const existing = await findCustomerByEmail(email);
  if (existing) return existing;
  return createCustomer(email);
}

async function getActiveSubscription(customerId) {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });
  return subscriptions.data[0] || null;
}

async function checkPremiumStatus(email) {
  const customer = await findCustomerByEmail(email);

  if (!customer) {
    return { premium: false, expiresAt: null };
  }

  const subscription = await getActiveSubscription(customer.id);

  if (!subscription) {
    return { premium: false, expiresAt: null };
  }

  return {
    premium: true,
    expiresAt: new Date(subscription.current_period_end * 1000).toISOString(),
  };
}

async function createCheckoutSession(email, plan) {
  const customer = await findOrCreateCustomer(email);

  const priceId = plan === 'yearly'
    ? config.STRIPE_PRICE_YEARLY
    : config.STRIPE_PRICE_MONTHLY;

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${config.BASE_URL}/checkout/success`,
    cancel_url: `${config.BASE_URL}/checkout/cancel`,
  });

  return session;
}

async function createBillingPortalSession(email) {
  const customer = await findCustomerByEmail(email);

  if (!customer) {
    throw new Error('No customer found for this email');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: `${config.BASE_URL}/billing/return`,
  });

  return session;
}

function constructWebhookEvent(payload, signature) {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    config.STRIPE_WEBHOOK_SECRET
  );
}

// Extract the product IDs associated with a webhook event, or null if the event
// type has no product association we can determine. For checkout.session.completed
// we must re-fetch the session with line items expanded — the event payload
// doesn't include them.
async function getEventProductIds(event) {
  const obj = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = await stripe.checkout.sessions.retrieve(obj.id, {
        expand: ['line_items.data.price'],
      });
      return (session.line_items?.data || [])
        .map(li => li.price?.product)
        .filter(Boolean);
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return (obj.items?.data || [])
        .map(i => i.price?.product)
        .filter(Boolean);
    case 'invoice.payment_failed':
    case 'invoice.payment_succeeded':
      return (obj.lines?.data || [])
        .map(l => l.price?.product)
        .filter(Boolean);
    default:
      return null;
  }
}

function isAllowedProduct(productIds) {
  if (!productIds || productIds.length === 0) return false;
  const allowlist = new Set(config.STRIPE_ALLOWED_PRODUCT_IDS);
  return productIds.some(id => allowlist.has(id));
}

module.exports = {
  stripe,
  findCustomerByEmail,
  createCustomer,
  findOrCreateCustomer,
  getActiveSubscription,
  checkPremiumStatus,
  createCheckoutSession,
  createBillingPortalSession,
  constructWebhookEvent,
  getEventProductIds,
  isAllowedProduct,
};
