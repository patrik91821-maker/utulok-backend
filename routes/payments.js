const express = require('express');
const knex = require('../db');
const Stripe = require('stripe');
require('dotenv').config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

// Create subscription checkout session for shelter (30 EUR/mo - price created in Stripe)
router.post('/create-subscription-session', async (req, res) => {
  const { shelter_id, success_url, cancel_url } = req.body;
  if (!shelter_id) return res.status(400).json({ error: 'shelter_id required' });
  const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;
  if (!priceId) return res.status(500).json({ error: 'Stripe subscription price not configured' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success_url || `${process.env.FRONTEND_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${process.env.FRONTEND_URL}/subscription-cancel`,
      metadata: { shelter_id: shelter_id.toString() }
    });

    // create pending payment record
    await knex('payments').insert({
      shelter_id,
      provider: 'stripe',
      provider_payment_id: session.id,
      amount_cents: null,
      purpose: 'subscription',
      status: 'pending'
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stripe create session failed' });
  }
});

// Create donation (one-time) checkout session
router.post('/create-donation-session', async (req, res) => {
  const { shelter_id, dog_id, amount_cents, currency = 'EUR', success_url, cancel_url } = req.body;
  if (!shelter_id || !amount_cents) return res.status(400).json({ error: 'Missing fields' });
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency,
          product_data: { name: `Dar pre útulok ${shelter_id}` },
          unit_amount: amount_cents
        },
        quantity: 1
      }],
      success_url: success_url || `${process.env.FRONTEND_URL}/donation-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${process.env.FRONTEND_URL}/donation-cancel`,
      metadata: { shelter_id: shelter_id?.toString(), dog_id: dog_id?.toString() }
    });

    // store pending payment
    await knex('payments').insert({
      shelter_id,
      dog_id: (dog_id && dog_id > 0) ? dog_id : null,
      provider: 'stripe',
      provider_payment_id: session.id,
      amount_cents,
      currency,
      purpose: 'donation',
      status: 'pending'
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stripe create donation failed' });
  }
});

// Webhook endpoint - must be configured in Stripe dashboard to call /payments/webhook
// Use raw body parser for webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;
  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // handle events
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const providerPaymentId = session.id;
      const metadata = session.metadata || {};
      // Update payments table
      await knex('payments').where({ provider_payment_id: providerPaymentId }).update({ status: 'succeeded' });

      // If subscription
      if (session.mode === 'subscription' || session.subscription) {
        // get subscription id from session if available
        const subscriptionId = session.subscription || null;
        const shelterId = metadata.shelter_id ? parseInt(metadata.shelter_id) : null;

        await knex('subscriptions').insert({
          shelter_id: shelterId,
          provider: 'stripe',
          provider_subscription_id: subscriptionId,
          amount_cents: null,
          status: 'active',
          start_at: knex.fn.now()
        });

        // mark shelter active
        if (shelterId) {
          await knex('shelters').where({ id: shelterId }).update({ active: true });
        }
      } else {
        // one-time payment -> maybe store payment_intent info
        // Get total from session? prefer payment_intent succeeded event
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      // find subscription by provider_subscription_id and mark active and update dates
      const sub = await knex('subscriptions').where({ provider_subscription_id: subscriptionId }).first();
      if (sub) {
        await knex('subscriptions').where({ id: sub.id }).update({ status: 'active', start_at: knex.fn.now() });
        // set shelter active
        await knex('shelters').where({ id: sub.shelter_id }).update({ active: true });
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;
      const sub = await knex('subscriptions').where({ provider_subscription_id: subscriptionId }).first();
      if (sub) {
        await knex('subscriptions').where({ id: sub.id }).update({ status: 'past_due' });
        await knex('shelters').where({ id: sub.shelter_id }).update({ active: false });
      }
    }
  } catch (err) {
    console.error('Error handling event', err);
  }

  res.json({ received: true });
});

module.exports = router;
