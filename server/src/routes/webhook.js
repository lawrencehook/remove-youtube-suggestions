const express = require('express');
const { constructWebhookEvent } = require('../services/stripe');

const router = express.Router();

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
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log(`Checkout completed for customer: ${session.customer}`);
      // Could send welcome email here
      break;
    }

    case 'customer.subscription.created': {
      const subscription = event.data.object;
      console.log(`Subscription created: ${subscription.id} for customer: ${subscription.customer}`);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      console.log(`Subscription updated: ${subscription.id}, status: ${subscription.status}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log(`Subscription canceled: ${subscription.id} for customer: ${subscription.customer}`);
      // Could send cancellation confirmation email here
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log(`Payment failed for invoice: ${invoice.id}, customer: ${invoice.customer}`);
      // Could send payment failure notification here
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      console.log(`Payment succeeded for invoice: ${invoice.id}`);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;
