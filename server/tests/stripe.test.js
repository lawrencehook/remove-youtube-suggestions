const { describe, it } = require('node:test');
const assert = require('node:assert');

require('./setup');
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_old, whsec_new';

const { stripe, constructWebhookEvent, getEventProductIds, getActiveSubscription, checkPremiumStatus } = require('../src/services/stripe');

function signed(secret) {
  const payload = JSON.stringify({ id: 'evt_1', type: 'invoice.payment_succeeded' });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { payload, header };
}

describe('constructWebhookEvent', () => {
  it('accepts events signed with any configured secret', () => {
    for (const secret of ['whsec_old', 'whsec_new']) {
      const { payload, header } = signed(secret);
      assert.strictEqual(constructWebhookEvent(payload, header).id, 'evt_1');
    }
  });

  it('rejects events signed with an unknown secret', () => {
    const { payload, header } = signed('whsec_other');
    assert.throws(() => constructWebhookEvent(payload, header));
  });
});

describe('getEventProductIds for invoices', () => {
  it('reads products from both old and new invoice line shapes', async () => {
    const event = {
      type: 'invoice.payment_succeeded',
      data: { object: { lines: { data: [
        { price: { product: 'prod_old_shape' } },
        { pricing: { price_details: { product: 'prod_new_shape' } } },
      ] } } },
    };
    assert.deepStrictEqual(await getEventProductIds(event), ['prod_old_shape', 'prod_new_shape']);
  });
});

describe('getActiveSubscription / checkPremiumStatus product allowlist', () => {
  it('ignores active subscriptions belonging to other products on the same Stripe account', async () => {
    const origCustomers = stripe.customers;
    const origSubs = stripe.subscriptions;
    try {
      stripe.customers = {
        list: async () => ({ data: [{ id: 'cus_foreign' }] }),
      };
      stripe.subscriptions = {
        list: async () => ({
          data: [
            {
              id: 'sub_other',
              current_period_end: 1800000000,
              items: { data: [{ price: { product: 'prod_other_app' } }] },
            },
          ],
        }),
      };

      assert.strictEqual(await getActiveSubscription('cus_foreign'), null);
      assert.deepStrictEqual(await checkPremiumStatus('foreign@example.com'), {
        premium: false,
        expiresAt: null,
      });
    } finally {
      stripe.customers = origCustomers;
      stripe.subscriptions = origSubs;
    }
  });

  it('finds an allowed subscription even when another product subscription appears first', async () => {
    const origCustomers = stripe.customers;
    const origSubs = stripe.subscriptions;
    try {
      stripe.customers = {
        list: async () => ({ data: [{ id: 'cus_multi' }] }),
      };
      stripe.subscriptions = {
        list: async () => ({
          data: [
            {
              id: 'sub_other',
              current_period_end: 1800000000,
              items: { data: [{ price: { product: 'prod_other_app' } }] },
            },
            {
              id: 'sub_rys',
              current_period_end: 1800000000,
              items: { data: [{ price: { product: 'prod_test_rys' } }] },
            },
          ],
        }),
      };

      const sub = await getActiveSubscription('cus_multi');
      assert.strictEqual(sub.id, 'sub_rys');
      const status = await checkPremiumStatus('multi@example.com');
      assert.strictEqual(status.premium, true);
    } finally {
      stripe.customers = origCustomers;
      stripe.subscriptions = origSubs;
    }
  });
});
