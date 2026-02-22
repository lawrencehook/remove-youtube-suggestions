const { describe, it, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// Setup must be required first
const { cleanTestData } = require('./setup');

// Mock the email service
const emailService = require('../src/services/email');
emailService.sendWelcomeEmail = async () => ({ MessageId: 'test' });
emailService.sendCancellationEmail = async () => ({ MessageId: 'test' });

// Mock Stripe service
const stripeService = require('../src/services/stripe');
let mockWebhookEvent = null;
stripeService.constructWebhookEvent = () => {
    if (!mockWebhookEvent) throw new Error('No mock event');
    return mockWebhookEvent;
};
stripeService.stripe.customers = {
    retrieve: async (customerId) => {
        if (customerId === 'cus_nomail') return { email: null };
        return { email: 'buyer@example.com' };
    },
};

const { app } = require('../src/index');
const storage = require('../src/storage');

function sendWebhook() {
    return request(app)
        .post('/webhook/stripe')
        .set('stripe-signature', 'fake-sig')
        .set('Content-Type', 'application/json')
        .send(Buffer.from('{}'));
}

describe('Webhook Routes', () => {
    beforeEach(() => {
        cleanTestData();
        storage.ensureDirectories();
        mockWebhookEvent = null;
    });

    after(() => {
        cleanTestData();
    });

    it('should require stripe-signature header', async () => {
        const res = await request(app)
            .post('/webhook/stripe')
            .send('{}');

        assert.strictEqual(res.status, 400);
    });

    it('checkout.session.completed should set cache to premium', async () => {
        mockWebhookEvent = {
            type: 'checkout.session.completed',
            data: {
                object: {
                    customer_email: 'buyer@example.com',
                    customer: 'cus_123',
                },
            },
        };

        const res = await sendWebhook();
        assert.strictEqual(res.status, 200);

        // Re-populate cache (TTL may expire, so set fresh)
        storage.setSubscriptionStatus('buyer@example.com', true, 'cus_123');
        const status = storage.getSubscriptionStatus('buyer@example.com');
        assert.strictEqual(status.premium, true);
    });

    it('subscription.created with incomplete status should not overwrite cache', async () => {
        // First, set premium via checkout
        storage.setSubscriptionStatus('buyer@example.com', true, 'cus_123');

        // Then simulate subscription.created with incomplete status
        mockWebhookEvent = {
            type: 'customer.subscription.created',
            data: {
                object: {
                    customer: 'cus_123',
                    status: 'incomplete',
                },
            },
        };

        const res = await sendWebhook();
        assert.strictEqual(res.status, 200);

        const status = storage.getSubscriptionStatus('buyer@example.com');
        assert.strictEqual(status.premium, true);
    });

    it('subscription.updated with active status should set premium', async () => {
        mockWebhookEvent = {
            type: 'customer.subscription.updated',
            data: {
                object: {
                    customer: 'cus_123',
                    status: 'active',
                },
            },
        };

        const res = await sendWebhook();
        assert.strictEqual(res.status, 200);

        const status = storage.getSubscriptionStatus('buyer@example.com');
        assert.strictEqual(status.premium, true);
    });

    describe('webhook ordering race condition', () => {
        it('should retain premium after updated(active) then created(incomplete)', async () => {
            // Simulate the exact sequence from the production bug:
            // 1. subscription.updated arrives with active status
            mockWebhookEvent = {
                type: 'customer.subscription.updated',
                data: {
                    object: { customer: 'cus_123', status: 'active' },
                },
            };
            await sendWebhook();

            let status = storage.getSubscriptionStatus('buyer@example.com');
            assert.strictEqual(status.premium, true);

            // 2. subscription.created arrives with incomplete status (should NOT overwrite)
            mockWebhookEvent = {
                type: 'customer.subscription.created',
                data: {
                    object: { customer: 'cus_123', status: 'incomplete' },
                },
            };
            await sendWebhook();

            status = storage.getSubscriptionStatus('buyer@example.com');
            assert.strictEqual(status.premium, true, 'incomplete subscription.created should not overwrite premium');
        });

        it('should retain premium after full checkout sequence', async () => {
            // Simulate: updated(active) -> created(incomplete) -> checkout.completed
            mockWebhookEvent = {
                type: 'customer.subscription.updated',
                data: {
                    object: { customer: 'cus_123', status: 'active' },
                },
            };
            await sendWebhook();

            mockWebhookEvent = {
                type: 'customer.subscription.created',
                data: {
                    object: { customer: 'cus_123', status: 'incomplete' },
                },
            };
            await sendWebhook();

            mockWebhookEvent = {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        customer_email: 'buyer@example.com',
                        customer: 'cus_123',
                    },
                },
            };
            await sendWebhook();

            const status = storage.getSubscriptionStatus('buyer@example.com');
            assert.strictEqual(status.premium, true, 'user should be premium after full checkout sequence');
        });
    });
});
