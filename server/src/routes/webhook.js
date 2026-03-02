const express = require('express');
const { constructWebhookEvent, stripe } = require('../services/stripe');
const { sendWelcomeEmail, sendCancellationEmail } = require('../services/email');
const storage = require('../storage');

const router = express.Router();

async function getCustomerEmail(customerId) {
  const customer = await stripe.customers.retrieve(customerId);
  return customer.email ? customer.email.toLowerCase() : null;
}

// POST /webhook/stripe
// Note: This route needs raw body, configured in index.js
router.post('/stripe', async (req, res) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;

  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      try {
        const email = session.customer_email || await getCustomerEmail(session.customer);
        if (email) {
          storage.setSubscriptionStatus(email, true, session.customer);
          await sendWelcomeEmail(email);
          console.log(`[webhook] Checkout completed: ${email} (cache updated, welcome email sent)`);
        } else {
          console.log(`[webhook] Checkout completed: ${session.customer} (no email found)`);
        }
      } catch (err) {
        console.error(`[webhook] Checkout completed but failed:`, err.message);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      const premium = subscription.status === 'active';
      const action = event.type === 'customer.subscription.created' ? 'created' : 'updated';
      try {
        const email = await getCustomerEmail(subscription.customer);
        if (email) {
          // Skip non-active created events to avoid overwriting premium with incomplete status
          if (!premium && event.type === 'customer.subscription.created') {
            console.log(`[webhook] Subscription created: ${email} -> ${subscription.status} (skipped cache update)`);
            break;
          }
          storage.setSubscriptionStatus(email, premium, subscription.customer);
          console.log(`[webhook] Subscription ${action}: ${email} -> ${premium ? 'premium' : 'free'}`);

          // Send cancellation email when user cancels (before period ends)
          if (subscription.cancel_at_period_end && event.data.previous_attributes?.cancel_at_period_end === false) {
            await sendCancellationEmail(email);
            console.log(`[webhook] Cancellation scheduled: ${email} (cancellation email sent)`);
          }
        } else {
          console.log(`[webhook] Subscription ${action}: ${subscription.id} (no email found)`);
        }
      } catch (err) {
        console.error(`[webhook] Subscription ${action} cache error:`, err.message);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      try {
        const email = await getCustomerEmail(subscription.customer);
        if (email) {
          storage.setSubscriptionStatus(email, false, subscription.customer);
          console.log(`[webhook] Subscription ended: ${email} -> free`);
        } else {
          console.log(`[webhook] Subscription ended: ${subscription.id} (no email found)`);
        }
      } catch (err) {
        console.error('[webhook] Subscription ended error:', err.message);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log(`[webhook] Payment failed: ${invoice.id}, customer: ${invoice.customer}`);
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      console.log(`[webhook] Payment succeeded: ${invoice.id}`);
      break;
    }

    default:
      console.log(`[webhook] Unhandled event: ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;
