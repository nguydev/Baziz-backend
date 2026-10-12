/**
 * Stripe Billing — landlord SaaS subscription (separate from tenant rent payments)
 */

import StripeSdk from 'stripe';
import logger from '../../config/logger';

type StripeClient = InstanceType<typeof StripeSdk>;

let stripeClient: StripeClient | null = null;

const getStripe = (): StripeClient | null => {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key?.startsWith('sk_')) return null;
  if (!stripeClient) stripeClient = new StripeSdk(key);
  return stripeClient;
};

export const isBillingStripeConfigured = (): boolean => Boolean(getStripe());

export const getBillingPriceId = (): string | null => {
  const priceId = process.env.STRIPE_BILLING_PRICE_ID?.trim();
  return priceId?.startsWith('price_') ? priceId : null;
};

const requireStripe = (): StripeClient => {
  const client = getStripe();
  if (!client) throw new Error('STRIPE_NOT_CONFIGURED');
  return client;
};

export const getOrCreateLandlordStripeCustomer = async (params: {
  landlordId: string;
  email: string;
  name?: string;
  existingCustomerId?: string | null;
}): Promise<string> => {
  const client = requireStripe();

  if (params.existingCustomerId) {
    try {
      const existing = await client.customers.retrieve(params.existingCustomerId);
      if (!existing.deleted) return params.existingCustomerId;
    } catch {
      // create below
    }
  }

  const customer = await client.customers.create({
    email: params.email,
    name: params.name,
    metadata: { landlordId: params.landlordId, type: 'landlord_subscription' },
  });

  return customer.id;
};

export const createCheckoutSession = async (params: {
  customerId: string;
  landlordId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ checkoutUrl: string; sessionId: string }> => {
  const client = requireStripe();
  const priceId = getBillingPriceId();
  if (!priceId) {
    throw new Error('STRIPE_BILLING_PRICE_ID not configured');
  }

  const session = await client.checkout.sessions.create({
    customer: params.customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { landlordId: params.landlordId, planId: params.planId },
    subscription_data: {
      metadata: { landlordId: params.landlordId, planId: params.planId },
    },
  });

  if (!session.url) throw new Error('Stripe checkout URL missing');

  return { checkoutUrl: session.url, sessionId: session.id };
};

export const createBillingPortalSession = async (params: {
  customerId: string;
  returnUrl: string;
}): Promise<{ portalUrl: string }> => {
  const client = requireStripe();
  const session = await client.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
  return { portalUrl: session.url };
};

export const scheduleSubscriptionCancel = async (stripeSubscriptionId: string) => {
  const client = requireStripe();
  return client.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
};

export const retrieveSubscription = async (stripeSubscriptionId: string) => {
  const client = requireStripe();
  return client.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ['default_payment_method'],
  });
};

export const retrieveInvoice = async (invoiceId: string) => {
  const client = requireStripe();
  return client.invoices.retrieve(invoiceId);
};

export const constructBillingWebhookEvent = (
  payload: Buffer | string,
  signature: string
) => {
  const client = requireStripe();
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error('STRIPE_BILLING_WEBHOOK_SECRET not configured');
  return client.webhooks.constructEvent(payload, signature, secret);
};

export const extractPaymentMethod = (
  paymentMethod: { card?: { brand: string; last4: string; exp_month: number; exp_year: number } } | string | null | undefined
): { brand: string; last4: string; expMonth: number; expYear: number } | null => {
  if (!paymentMethod || typeof paymentMethod === 'string') return null;
  const card = paymentMethod.card;
  if (!card) return null;
  return {
    brand: card.brand,
    last4: card.last4,
    expMonth: card.exp_month,
    expYear: card.exp_year,
  };
};

export const logBillingStripeWarning = (message: string): void => {
  logger.warn(`[Billing Stripe] ${message}`);
};

/** Normalizes Stripe SDK subscription objects for billing handlers. */
export type StripeSubscriptionSnapshot = {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  default_payment_method?:
    | { card?: { brand: string; last4: string; exp_month: number; exp_year: number } }
    | string
    | null;
  metadata?: { landlordId?: string };
};

export const toSubscriptionSnapshot = (subscription: unknown): StripeSubscriptionSnapshot => {
  const raw =
    subscription && typeof subscription === 'object' && 'data' in subscription
      ? (subscription as { data: unknown }).data
      : subscription;
  return raw as StripeSubscriptionSnapshot;
};
