const { describe, it } = require('node:test');
const assert = require('node:assert');

require('./setup');
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_old, whsec_new';

const { stripe, constructWebhookEvent, getEventProductIds } = require('../src/services/stripe');

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
