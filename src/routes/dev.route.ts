/**
 * Development-only helpers (payment tester page)
 */

import { Router, Request, Response } from 'express';
import env from '../config/env';
import { getStripePublishableKey, isStripeConfigured, isPublishableKeyConfigured } from '../modules/rent-payment/stripe.service';

const router = Router();

router.get('/payment-config', (_req: Request, res: Response) => {
  if (env.NODE_ENV === 'production') {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      apiBaseUrl: `/api/${env.API_VERSION}`,
      stripeConfigured: isStripeConfigured(),
      publishableKeyConfigured: isPublishableKeyConfigured(),
      publishableKey: getStripePublishableKey(),
      webhookDevMode: process.env.STRIPE_WEBHOOK_DEV_MODE === 'true',
    },
  });
});

export default router;
