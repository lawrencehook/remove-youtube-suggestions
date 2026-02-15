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
};
