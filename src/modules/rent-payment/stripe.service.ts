/**
 * Stripe payment service — PaymentIntent, SetupIntent, auto-pay off-session charges
 */

import StripeSdk from 'stripe';
import logger from '../../config/logger';

type StripeClient = InstanceType<typeof StripeSdk>;

let stripeClient: StripeClient | null = null;

const getStripe = (): StripeClient | null => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new StripeSdk(key);
  }
  return stripeClient;
};

export const isStripeConfigured = (): boolean => {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return Boolean(key && key.startsWith('sk_'));
};

export const isPublishableKeyConfigured = (): boolean => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY?.trim();
  return Boolean(key && key.startsWith('pk_'));
};

const requireStripe = (): StripeClient => {
  const client = getStripe();
  if (!client) throw new Error('STRIPE_NOT_CONFIGURED');
  return client;
};

export const getOrCreateStripeCustomer = async (params: {
  tenantId: string;
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
      // create new below
    }
  }

  const customer = await client.customers.create({
    email: params.email,
    name: params.name,
    metadata: { tenantId: params.tenantId },
  });

  return customer.id;
};

export const createAutoPaySetupIntent = async (params: {
  customerId: string;
  tenantId: string;
}): Promise<{ clientSecret: string; setupIntentId: string }> => {
  const client = requireStripe();

  const setupIntent = await client.setupIntents.create({
    customer: params.customerId,
    automatic_payment_methods: { enabled: true },
    metadata: { tenantId: params.tenantId, purpose: 'auto_pay' },
  });

  if (!setupIntent.client_secret) {
    throw new Error('Stripe did not return a setup client secret');
  }

  return {
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
  };
};

export const retrieveSetupIntent = async (setupIntentId: string) => {
  const client = requireStripe();
  return client.setupIntents.retrieve(setupIntentId);
};

export const createRentPaymentIntent = async (params: {
  amount: number;
  currency: string;
  rentPaymentId: string;
  tenantId: string;
  tenantEmail: string;
  paymentChannel?: 'card' | 'apple_pay';
}): Promise<{ clientSecret: string; paymentIntentId: string }> => {
  const client = requireStripe();

  const amountInMinor = Math.round(params.amount * 100);
  const channel = params.paymentChannel ?? 'card';

  const intent = await client.paymentIntents.create({
    amount: amountInMinor,
    currency: params.currency.toLowerCase(),
    automatic_payment_methods: { enabled: true },
    metadata: {
      rentPaymentId: params.rentPaymentId,
      tenantId: params.tenantId,
      paymentChannel: channel,
    },
    receipt_email: params.tenantEmail,
  });

  if (!intent.client_secret) {
    throw new Error('Stripe did not return a client secret');
  }

  logger.info(
    `Stripe PaymentIntent (${channel}) created: ${intent.id} for rent ${params.rentPaymentId}`
  );

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  };
};

/** Detect whether a succeeded PaymentIntent used Apple Pay wallet */
export const resolvePaymentMethodFromIntent = async (
  paymentIntentId: string
): Promise<'apple_pay' | 'card'> => {
  const client = requireStripe();

  const intent = await client.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });

  if (intent.metadata?.paymentChannel === 'apple_pay') {
    return 'apple_pay';
  }

  const charge = intent.latest_charge;
  if (charge && typeof charge === 'object') {
    const walletType = charge.payment_method_details?.card?.wallet?.type;
    if (walletType === 'apple_pay') return 'apple_pay';
  }

  return 'card';
};

export const getStripePublishableKey = (): string | null => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY?.trim();
  return key && key.startsWith('pk_') ? key : null;
};

/** Register a domain for Apple Pay on the Web (Stripe Dashboard alternative) */
export const registerApplePayDomain = async (domain: string) => {
  const client = requireStripe();
  return client.applePayDomains.create({ domain_name: domain });
};

export const chargeAutoPayOffSession = async (params: {
  amount: number;
  currency: string;
  customerId: string;
  paymentMethodId: string;
  rentPaymentId: string;
  tenantId: string;
  tenantEmail: string;
}): Promise<{ paymentIntentId: string; status: string }> => {
  const client = requireStripe();
  const amountInMinor = Math.round(params.amount * 100);

  const intent = await client.paymentIntents.create({
    amount: amountInMinor,
    currency: params.currency.toLowerCase(),
    customer: params.customerId,
    payment_method: params.paymentMethodId,
    off_session: true,
    confirm: true,
    metadata: {
      rentPaymentId: params.rentPaymentId,
      tenantId: params.tenantId,
      autoPay: 'true',
    },
    receipt_email: params.tenantEmail,
  });

  logger.info(`Auto-pay charge ${intent.id} for rent ${params.rentPaymentId}: ${intent.status}`);

  return { paymentIntentId: intent.id, status: intent.status };
};

export const constructStripeEvent = (payload: Buffer, signature: string) => {
  const client = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!client || !secret) {
    throw new Error('STRIPE_WEBHOOK_NOT_CONFIGURED');
  }
  return client.webhooks.constructEvent(payload, signature, secret);
};

/** Dev/test only — parse webhook body (raw Buffer or express.json() object) */
export const parseStripeEventPayload = (
  payload: Buffer | string | Record<string, unknown>
): { type: string; data: { object: Record<string, unknown> } } => {
  if (payload && typeof payload === 'object' && !Buffer.isBuffer(payload) && 'type' in payload) {
    return payload as { type: string; data: { object: Record<string, unknown> } };
  }

  const raw = Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload);
  return JSON.parse(raw) as { type: string; data: { object: Record<string, unknown> } };
};

/** Strip `_secret_...` if client secret was sent instead of payment intent id */
export const normalizePaymentIntentId = (id: string): string => {
  const trimmed = id.trim();
  const secretIdx = trimmed.indexOf('_secret_');
  if (secretIdx > 0) return trimmed.slice(0, secretIdx);
  return trimmed;
};
