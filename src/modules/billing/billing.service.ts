import User from '../user/user.model';
import Property from '../property/property.model';
import Organization from '../team/organization.model';
import TeamMember from '../team/team-member.model';
import LandlordSubscription from './landlord-subscription.model';
import SubscriptionInvoice from './subscription-invoice.model';
import ApiError from '../../utils/ApiError';
import logger from '../../config/logger';
import { buildPaginationMeta } from '../../utils/pagination';
import {
  GRACE_PERIOD_DAYS,
  SUBSCRIPTION_PLANS,
  getPlan,
  isUnlimited,
  type PlanId,
} from './billing.constants';
import type {
  CheckoutInput,
  DowngradeInput,
  InvoiceListItem,
  LoginSubscriptionPayload,
  PortalInput,
  SubscriptionResponse,
  UpdateBillingInfoInput,
  UsageResponse,
} from './billing.types';
import {
  createBillingPortalSession,
  createCheckoutSession,
  extractPaymentMethod,
  getBillingPriceId,
  getOrCreateLandlordStripeCustomer,
  isBillingStripeConfigured,
  retrieveInvoice,
  retrieveSubscription,
  scheduleSubscriptionCancel,
  logBillingStripeWarning,
  toSubscriptionSnapshot,
} from './billing-stripe.service';
import { queueEmail } from '../../jobs/email.job';

/** Subscription is billed to the organization owner. */
export const resolveBillingLandlordId = async (userId: string): Promise<string> => {
  const org = await Organization.findOne({ ownerId: userId });
  if (org) return userId;

  const membership = await TeamMember.findOne({ userId, status: 'active' });
  if (membership) {
    const ownerOrg = await Organization.findById(membership.orgId);
    if (ownerOrg) return ownerOrg.ownerId.toString();
  }

  return userId;
};

export const getOrCreateSubscription = async (landlordId: string) => {
  let sub = await LandlordSubscription.findOne({ landlordId });
  if (sub) return sub;

  sub = await LandlordSubscription.create({
    landlordId,
    planId: 'free',
    status: 'active',
    priceMonthly: 0,
  });

  return sub;
};

export const provisionLandlordSubscription = async (
  landlordId: string,
  email: string,
  name?: string
): Promise<void> => {
  const sub = await getOrCreateSubscription(landlordId);

  if (sub.stripeCustomerId || !isBillingStripeConfigured()) return;

  try {
    const customerId = await getOrCreateLandlordStripeCustomer({
      landlordId,
      email,
      name,
    });
    sub.stripeCustomerId = customerId;
    sub.billingEmail = email;
    await sub.save();
    logger.info(`[Billing] Stripe customer created for landlord ${landlordId}`);
  } catch (err) {
    logBillingStripeWarning(
      `Customer create failed for ${landlordId}: ${err instanceof Error ? err.message : 'Unknown'}`
    );
  }
};

const countUsage = async (landlordId: string) => {
  const org = await Organization.findOne({ ownerId: landlordId });
  const [properties, teamMembers] = await Promise.all([
    Property.countDocuments({ landlordId, isActive: true }),
    org
      ? TeamMember.countDocuments({ orgId: org._id, status: 'active' })
      : Promise.resolve(1),
  ]);
  return { properties, teamMembers };
};

export const getUsageForLandlord = async (landlordId: string): Promise<UsageResponse> => {
  const sub = await getOrCreateSubscription(landlordId);
  const plan = getPlan(sub.planId);
  const used = await countUsage(landlordId);

  const canAddProperty =
    isUnlimited(plan.limits.maxProperties) || used.properties < plan.limits.maxProperties;

  const canAddTeamMember =
    isUnlimited(plan.limits.maxTeamMembers) || used.teamMembers < plan.limits.maxTeamMembers;

  return {
    planId: plan.id,
    limits: {
      maxProperties: plan.limits.maxProperties,
      maxTeamMembers: plan.limits.maxTeamMembers,
    },
    used,
    canAddProperty,
    canAddTeamMember,
  };
};

export const buildLoginSubscriptionPayload = async (
  userId: string
): Promise<LoginSubscriptionPayload | null> => {
  const user = await User.findById(userId);
  if (!user || user.role !== 'landlord') return null;

  const billingLandlordId = await resolveBillingLandlordId(userId);
  const sub = await getOrCreateSubscription(billingLandlordId);
  const usage = await getUsageForLandlord(billingLandlordId);
  const plan = getPlan(sub.planId);

  return {
    planId: plan.id,
    status: sub.status,
    limits: usage.limits,
    used: usage.used,
  };
};

export const assertCanAddProperty = async (userId: string): Promise<void> => {
  const billingLandlordId = await resolveBillingLandlordId(userId);
  const usage = await getUsageForLandlord(billingLandlordId);
  if (!usage.canAddProperty) {
    throw ApiError.forbidden('Free plan: max 3 properties. Upgrade to Pro.', 'UPGRADE_REQUIRED');
  }
};

export const assertCanAddTeamMember = async (userId: string): Promise<void> => {
  const billingLandlordId = await resolveBillingLandlordId(userId);
  const usage = await getUsageForLandlord(billingLandlordId);
  if (!usage.canAddTeamMember) {
    throw ApiError.forbidden(
      'Team member limit reached for your plan. Upgrade to Pro.',
      'UPGRADE_REQUIRED'
    );
  }
};

const formatSubscription = (sub: InstanceType<typeof LandlordSubscription>): SubscriptionResponse => {
  const plan = getPlan(sub.planId);
  return {
    planId: plan.id,
    planName: plan.name,
    status: sub.status,
    priceMonthly: sub.priceMonthly,
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    billingEmail: sub.billingEmail,
    billingAddress: sub.billingAddress,
    paymentMethod: sub.paymentMethod,
  };
};

export const listPlans = () => ({
  plans: Object.values(SUBSCRIPTION_PLANS).map((p) => ({
    id: p.id,
    name: p.name,
    priceMonthly: p.priceMonthly,
    currency: p.currency,
    features: p.features,
    limits: p.limits,
  })),
});

export const getSubscription = async (userId: string): Promise<SubscriptionResponse> => {
  const billingLandlordId = await resolveBillingLandlordId(userId);
  const sub = await getOrCreateSubscription(billingLandlordId);
  return formatSubscription(sub);
};

export const getUsage = async (userId: string): Promise<UsageResponse> => {
  const billingLandlordId = await resolveBillingLandlordId(userId);
  return getUsageForLandlord(billingLandlordId);
};

export const createCheckout = async (userId: string, input: CheckoutInput) => {
  const billingLandlordId = await resolveBillingLandlordId(userId);
  if (billingLandlordId !== userId) {
    throw ApiError.forbidden('Only the organization owner can manage billing', 'BILLING_ACCESS_DENIED');
  }

  const sub = await getOrCreateSubscription(billingLandlordId);
  if (sub.planId === 'pro' && sub.status === 'active' && !sub.cancelAtPeriodEnd) {
    throw ApiError.conflict('Already subscribed to Pro plan', 'ALREADY_SUBSCRIBED');
  }

  if (!isBillingStripeConfigured()) {
    throw ApiError.badRequest('Stripe billing is not configured on the server');
  }

  if (!getBillingPriceId()) {
    throw ApiError.badRequest(
      'Stripe Pro plan price is not configured. Set STRIPE_BILLING_PRICE_ID in server environment.',
      [],
      'BILLING_NOT_CONFIGURED'
    );
  }

  const user = await User.findById(billingLandlordId);
  if (!user) throw ApiError.notFound('User not found');

  const customerId = await getOrCreateLandlordStripeCustomer({
    landlordId: billingLandlordId,
    email: user.email,
    name: user.firstName,
    existingCustomerId: sub.stripeCustomerId,
  });

  if (sub.stripeCustomerId !== customerId) {
    sub.stripeCustomerId = customerId;
    await sub.save();
  }

  const session = await createCheckoutSession({
    customerId,
    landlordId: billingLandlordId,
    planId: input.planId,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });

  return session;
};

export const createPortal = async (userId: string, input: PortalInput) => {
  const billingLandlordId = await resolveBillingLandlordId(userId);
  if (billingLandlordId !== userId) {
    throw ApiError.forbidden('Only the organization owner can manage billing', 'BILLING_ACCESS_DENIED');
  }

  const sub = await getOrCreateSubscription(billingLandlordId);
  if (!sub.stripeCustomerId) {
    throw ApiError.badRequest('No Stripe customer found. Complete checkout first.');
  }

  return createBillingPortalSession({
    customerId: sub.stripeCustomerId,
    returnUrl: input.returnUrl,
  });
};

export const downgradePlan = async (userId: string, input: DowngradeInput) => {
  const billingLandlordId = await resolveBillingLandlordId(userId);
  if (billingLandlordId !== userId) {
    throw ApiError.forbidden('Only the organization owner can manage billing', 'BILLING_ACCESS_DENIED');
  }

  const sub = await getOrCreateSubscription(billingLandlordId);

  if (sub.planId === 'free' && !sub.stripeSubscriptionId) {
    return {
      message: 'Already on Free plan',
      effectiveDate: null,
      cancelAtPeriodEnd: false,
    };
  }

  if (!sub.stripeSubscriptionId) {
    sub.planId = 'free';
    sub.status = 'active';
    sub.priceMonthly = 0;
    sub.cancelAtPeriodEnd = false;
    await sub.save();
    return {
      message: 'Downgraded to Free plan',
      effectiveDate: new Date().toISOString().slice(0, 10),
      cancelAtPeriodEnd: false,
    };
  }

  const updated = toSubscriptionSnapshot(await scheduleSubscriptionCancel(sub.stripeSubscriptionId));
  sub.cancelAtPeriodEnd = true;
  sub.currentPeriodEnd = updated.current_period_end
    ? new Date(updated.current_period_end * 1000)
    : sub.currentPeriodEnd;
  await sub.save();

  return {
    message: 'Downgrade scheduled',
    effectiveDate: sub.currentPeriodEnd?.toISOString().slice(0, 10) ?? null,
    cancelAtPeriodEnd: true,
  };
};

export const updateBillingInfo = async (userId: string, input: UpdateBillingInfoInput) => {
  const billingLandlordId = await resolveBillingLandlordId(userId);
  if (billingLandlordId !== userId) {
    throw ApiError.forbidden('Only the organization owner can manage billing', 'BILLING_ACCESS_DENIED');
  }

  const sub = await getOrCreateSubscription(billingLandlordId);
  if (input.billingEmail !== undefined) sub.billingEmail = input.billingEmail;
  if (input.billingAddress !== undefined) sub.billingAddress = input.billingAddress;
  await sub.save();

  return { message: 'Billing info updated' };
};

export const listInvoices = async (
  userId: string,
  page = 1,
  limit = 10
): Promise<{ invoices: InvoiceListItem[]; pagination: ReturnType<typeof buildPaginationMeta> }> => {
  const billingLandlordId = await resolveBillingLandlordId(userId);
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    SubscriptionInvoice.find({ landlordId: billingLandlordId })
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(limit),
    SubscriptionInvoice.countDocuments({ landlordId: billingLandlordId }),
  ]);

  return {
    invoices: items.map((inv) => ({
      id: inv._id.toString(),
      date: inv.invoiceDate.toISOString().slice(0, 10),
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      planName: inv.planName,
      pdfUrl: inv.pdfUrl,
    })),
    pagination: buildPaginationMeta(total, page, limit),
  };
};

export const getInvoiceById = async (userId: string, invoiceId: string): Promise<InvoiceListItem> => {
  const billingLandlordId = await resolveBillingLandlordId(userId);
  const inv = await SubscriptionInvoice.findOne({
    _id: invoiceId,
    landlordId: billingLandlordId,
  });
  if (!inv) throw ApiError.notFound('Invoice not found', 'SUBSCRIPTION_NOT_FOUND');

  return {
    id: inv._id.toString(),
    date: inv.invoiceDate.toISOString().slice(0, 10),
    amount: inv.amount,
    currency: inv.currency,
    status: inv.status,
    planName: inv.planName,
    pdfUrl: inv.pdfUrl,
  };
};

const applyProPlan = async (
  landlordId: string,
  stripeSubscriptionId: string,
  periodStart?: number | null,
  periodEnd?: number | null,
  paymentMethod?: ReturnType<typeof extractPaymentMethod>
): Promise<void> => {
  const sub = await getOrCreateSubscription(landlordId);
  const plan = getPlan('pro');
  sub.planId = 'pro';
  sub.status = 'active';
  sub.priceMonthly = plan.priceMonthly;
  sub.stripeSubscriptionId = stripeSubscriptionId;
  sub.cancelAtPeriodEnd = false;
  sub.gracePeriodEndsAt = null;
  sub.currentPeriodStart = periodStart ? new Date(periodStart * 1000) : new Date();
  sub.currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;
  if (paymentMethod) sub.paymentMethod = paymentMethod;
  await sub.save();
};

const applyFreePlan = async (landlordId: string): Promise<void> => {
  const sub = await getOrCreateSubscription(landlordId);
  sub.planId = 'free';
  sub.status = 'active';
  sub.priceMonthly = 0;
  sub.stripeSubscriptionId = null;
  sub.cancelAtPeriodEnd = false;
  sub.gracePeriodEndsAt = null;
  sub.currentPeriodStart = null;
  sub.currentPeriodEnd = null;
  sub.paymentMethod = null;
  await sub.save();
};

const saveInvoiceFromStripe = async (
  landlordId: string,
  stripeInvoice: { id: string; amount_paid: number; currency: string; status: string | null; invoice_pdf?: string | null; created: number }
): Promise<void> => {
  const exists = await SubscriptionInvoice.findOne({ stripeInvoiceId: stripeInvoice.id });
  if (exists) return;

  await SubscriptionInvoice.create({
    landlordId,
    stripeInvoiceId: stripeInvoice.id,
    amount: stripeInvoice.amount_paid / 100,
    currency: stripeInvoice.currency,
    status: stripeInvoice.status ?? 'paid',
    planName: 'Pro',
    pdfUrl: stripeInvoice.invoice_pdf ?? null,
    invoiceDate: new Date(stripeInvoice.created * 1000),
  });
};

export const handleBillingWebhookEvent = async (event: {
  type: string;
  data: { object: Record<string, unknown> };
}): Promise<void> => {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as {
        metadata?: { landlordId?: string; planId?: string };
        subscription?: string;
        customer?: string;
      };
      const landlordId = session.metadata?.landlordId;
      if (!landlordId || !session.subscription) break;

      const stripeSub = toSubscriptionSnapshot(await retrieveSubscription(session.subscription));
      const pm = extractPaymentMethod(stripeSub.default_payment_method);
      await applyProPlan(
        landlordId,
        session.subscription,
        stripeSub.current_period_start,
        stripeSub.current_period_end,
        pm ?? undefined
      );
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as {
        id: string;
        customer?: string;
        amount_paid: number;
        currency: string;
        status: string | null;
        invoice_pdf?: string | null;
        created: number;
        subscription?: string;
      };
      const sub = await LandlordSubscription.findOne({ stripeCustomerId: invoice.customer });
      if (!sub) break;
      await saveInvoiceFromStripe(sub.landlordId.toString(), invoice);
      if (invoice.subscription) {
        const stripeSub = toSubscriptionSnapshot(await retrieveSubscription(invoice.subscription));
        await applyProPlan(
          sub.landlordId.toString(),
          invoice.subscription,
          stripeSub.current_period_start,
          stripeSub.current_period_end
        );
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as { customer?: string };
      const sub = await LandlordSubscription.findOne({ stripeCustomerId: invoice.customer });
      if (!sub) break;
      sub.status = 'past_due';
      sub.gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      await sub.save();

      const user = await User.findById(sub.landlordId);
      if (user?.email) {
        void queueEmail({
          to: user.email,
          subject: 'Propertera — Payment failed',
          html: `<p>Your Pro subscription payment failed. Please update your card within ${GRACE_PERIOD_DAYS} days.</p>`,
        });
      }
      break;
    }

    case 'customer.subscription.updated': {
      const stripeSub = event.data.object as {
        id: string;
        metadata?: { landlordId?: string };
        status: string;
        cancel_at_period_end: boolean;
        current_period_start: number;
        current_period_end: number;
        default_payment_method?: { card?: { brand: string; last4: string; exp_month: number; exp_year: number } } | string | null;
      };
      const landlordId = stripeSub.metadata?.landlordId;
      if (!landlordId) break;

      if (stripeSub.status === 'active' || stripeSub.status === 'trialing') {
        const pm = extractPaymentMethod(stripeSub.default_payment_method);
        await applyProPlan(
          landlordId,
          stripeSub.id,
          stripeSub.current_period_start,
          stripeSub.current_period_end,
          pm ?? undefined
        );
        const sub = await getOrCreateSubscription(landlordId);
        sub.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;
        await sub.save();
      } else if (stripeSub.status === 'past_due') {
        const sub = await getOrCreateSubscription(landlordId);
        sub.status = 'past_due';
        await sub.save();
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const stripeSub = event.data.object as {
        metadata?: { landlordId?: string };
      };
      const landlordId = stripeSub.metadata?.landlordId;
      if (!landlordId) {
        const sub = await LandlordSubscription.findOne({
          stripeSubscriptionId: (event.data.object as { id: string }).id,
        });
        if (sub) await applyFreePlan(sub.landlordId.toString());
        break;
      }
      await applyFreePlan(landlordId);
      break;
    }

    default:
      logger.debug(`[Billing Webhook] Unhandled event: ${event.type}`);
  }
};

/** Downgrade past_due subscriptions after grace period (call from job or webhook). */
export const processExpiredGracePeriods = async (): Promise<number> => {
  const now = new Date();
  const expired = await LandlordSubscription.find({
    status: 'past_due',
    gracePeriodEndsAt: { $lte: now },
  });

  for (const sub of expired) {
    await applyFreePlan(sub.landlordId.toString());
  }

  return expired.length;
};
