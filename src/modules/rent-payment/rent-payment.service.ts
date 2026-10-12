/**
 * Rent Payment Service — core business logic
 */

import mongoose from 'mongoose';
import RentPayment from './rent-payment.model';
import type { IRentPaymentDocument } from './rent-payment.model';
import AutoPaySetting from './auto-pay.model';
import PaymentReminderLog from './payment-reminder-log.model';
import Notification from './notification.model';
import DeviceToken from './device-token.model';
import tenantModels from '../tenant/tenant.model';
import Property from '../property/property.model';
import User from '../user/user.model';
import ApiError from '../../utils/ApiError';
import logger from '../../config/logger';
import { buildPaginationMeta } from '../../utils/pagination';
import {
  DEFAULT_CURRENCY,
  getBillingMonth,
  formatBillingTitle,
  formatBillingLabel,
  buildDueDate,
  parseDateOnly,
  getDaysUntilDue,
  getReminderSlot,
  formatCurrency,
  isFirstOfMonthUtc,
} from './rent-payment.utils';
import {
  createRentPaymentIntent,
  isStripeConfigured,
  getOrCreateStripeCustomer,
  createAutoPaySetupIntent,
  retrieveSetupIntent,
  chargeAutoPayOffSession,
  resolvePaymentMethodFromIntent,
  getStripePublishableKey,
  registerApplePayDomain,
} from './stripe.service';
import { notifyUserAllChannels } from './notification.service';
import type {
  CreateManualPaymentInput,
  UpdateManualPaymentInput,
  ListRentPaymentsQuery,
  TenantDashboardResult,
  LandlordSummaryResult,
  MonthlyReportResult,
  CreatePaymentIntentResult,
  ApplePayConfigResult,
  RentPaymentStatus,
} from './rent-payment.types';

const { LeaseAgreement } = tenantModels;

const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── Billing Generation ───────────────────────────────────────────────────────

export const generateMonthlyRentBills = async (options?: {
  force?: boolean;
}): Promise<number> => {
  if (!options?.force && !isFirstOfMonthUtc()) {
    logger.debug('Bill generation skipped — runs only on the 1st of each month (UTC)');
    return 0;
  }

  const billingMonth = getBillingMonth();
  const leases = await LeaseAgreement.find({
    status: { $in: ['accepted', 'active'] },
    tenantId: { $ne: null },
  });

  let created = 0;

  for (const lease of leases) {
    const exists = await RentPayment.findOne({ leaseId: lease._id, billingMonth });
    if (exists) continue;

    try {
      await RentPayment.create({
        leaseId: lease._id,
        propertyId: lease.propertyId,
        unitId: lease.unitId,
        tenantId: lease.tenantId,
        landlordId: lease.landlordId,
        billingMonth,
        title: formatBillingTitle(billingMonth),
        amount: lease.rentAmount,
        currency: DEFAULT_CURRENCY,
        dueDate: buildDueDate(billingMonth, lease.paymentDueDay),
        status: 'pending',
        createdBy: 'system',
        isActive: true,
      });
      created++;
    } catch (err) {
      logger.warn(`Skipped bill for lease ${lease._id}: duplicate or error`);
    }
  }

  if (created > 0) {
    logger.info(`Rent billing: created ${created} payment(s) for ${billingMonth}`);
  }

  const autoCharged = await processAutoPayCharges(billingMonth);
  if (autoCharged > 0) {
    logger.info(`Auto-pay: charged ${autoCharged} payment(s) for ${billingMonth}`);
  }

  return created;
};

export const markOverduePayments = async (): Promise<number> => {
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const result = await RentPayment.updateMany(
    {
      status: 'pending',
      dueDate: { $lt: startOfToday },
      isActive: true,
    },
    { $set: { status: 'overdue' } }
  );

  if (result.modifiedCount > 0) {
    logger.info(`Rent billing: marked ${result.modifiedCount} payment(s) as overdue`);
  }

  return result.modifiedCount;
};

// ─── Payment Reminders ────────────────────────────────────────────────────────

export const processRentReminders = async (): Promise<number> => {
  const slot = getReminderSlot();
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  const payments = await RentPayment.find({
    status: { $in: ['pending', 'overdue'] },
    isActive: true,
  });

  let sent = 0;

  for (const payment of payments) {
    const daysUntil = getDaysUntilDue(payment.dueDate);

    // Remind from 5 days before due date until paid (includes overdue)
    if (daysUntil > 5) continue;

    const [tenant, landlord] = await Promise.all([
      User.findById(payment.tenantId),
      User.findById(payment.landlordId),
    ]);

    if (!tenant || !landlord) continue;

    const amountLabel = formatCurrency(payment.amount, payment.currency);
    const dueLabel =
      daysUntil < 0
        ? `overdue by ${Math.abs(daysUntil)} day(s)`
        : daysUntil === 0
          ? 'due today'
          : `due in ${daysUntil} day(s)`;

    const tenantTitle = 'Rent Payment Reminder';
    const tenantBody = `${payment.title} — ${amountLabel} is ${dueLabel}. Please pay via the app.`;

    const landlordTitle = 'Tenant Rent Reminder';
    const landlordBody = `${tenant.firstName} has not paid ${payment.title} (${amountLabel}). Status: ${dueLabel}.`;

    const tenantPrefs = tenant.notificationPreferences;
    const landlordPrefs = landlord.notificationPreferences;

    const channels: Array<{ role: 'tenant' | 'landlord'; user: typeof tenant; title: string; body: string; type: 'rent_due' | 'rent_overdue'; prefs: typeof tenantPrefs }> = [
      {
        role: 'tenant',
        user: tenant,
        title: tenantTitle,
        body: tenantBody,
        type: daysUntil < 0 ? 'rent_overdue' : 'rent_due',
        prefs: tenantPrefs,
      },
      {
        role: 'landlord',
        user: landlord,
        title: landlordTitle,
        body: landlordBody,
        type: daysUntil < 0 ? 'rent_overdue' : 'rent_due',
        prefs: landlordPrefs,
      },
    ];

    for (const target of channels) {
      if (!target.prefs.paymentDue) continue;

      const alreadySent = await PaymentReminderLog.findOne({
        rentPaymentId: payment._id,
        recipientId: target.user._id,
        reminderSlot: slot,
      });
      if (alreadySent) continue;

      await notifyUserAllChannels({
        userId: target.user._id.toString(),
        email: target.user.email,
        phone: target.user.phone,
        title: target.title,
        body: target.body,
        type: target.type,
        rentPaymentId: payment._id.toString(),
        sendEmail: target.prefs.emailNotifications !== false,
        sendSms: target.prefs.smsNotifications,
        sendPush: target.prefs.pushNotifications !== false,
      });

      await PaymentReminderLog.create({
        rentPaymentId: payment._id,
        recipientId: target.user._id,
        recipientRole: target.role,
        channel: 'email',
        reminderSlot: slot,
      });

      sent++;
    }

    payment.reminderCount += 1;
    payment.lastReminderAt = new Date();
    await payment.save();
  }

  if (sent > 0) {
    logger.info(`Rent reminders: sent ${sent} notification(s) in slot ${slot}`);
  }

  return sent;
};

// ─── Mark Paid (internal + webhook) ───────────────────────────────────────────

export const markPaymentAsPaid = async (
  payment: IRentPaymentDocument,
  method: 'card' | 'apple_pay' | 'manual' | 'auto_pay',
  stripeChargeId?: string
): Promise<IRentPaymentDocument> => {
  if (payment.status === 'paid') return payment;

  payment.status = 'paid';
  payment.paidAt = new Date();
  payment.paymentMethod = method;
  if (stripeChargeId) payment.stripeChargeId = stripeChargeId;

  await payment.save();

  const [tenant, landlord] = await Promise.all([
    User.findById(payment.tenantId),
    User.findById(payment.landlordId),
  ]);

  const amountLabel = formatCurrency(payment.amount, payment.currency);

  if (tenant?.notificationPreferences.paymentDue) {
    await notifyUserAllChannels({
      userId: tenant._id.toString(),
      email: tenant.email,
      phone: tenant.phone,
      title: 'Rent Payment Successful',
      body: `Your payment of ${amountLabel} for ${payment.title} was successful.`,
      type: 'rent_paid',
      rentPaymentId: payment._id.toString(),
      sendSms: tenant.notificationPreferences.smsNotifications,
    });
  }

  if (landlord?.notificationPreferences.paymentReceived) {
    await notifyUserAllChannels({
      userId: landlord._id.toString(),
      email: landlord.email,
      phone: landlord.phone,
      title: 'Rent Payment Received',
      body: `${tenant?.firstName ?? 'Tenant'} paid ${amountLabel} for ${payment.title}.`,
      type: 'rent_received',
      rentPaymentId: payment._id.toString(),
      sendSms: landlord.notificationPreferences.smsNotifications,
    });
  }

  return payment;
};

export const handleStripePaymentSuccess = async (
  paymentIntentId: string,
  chargeId?: string,
  isAutoPay?: boolean
): Promise<void> => {
  const payment = await RentPayment.findOne({ stripePaymentIntentId: paymentIntentId });
  if (!payment) {
    logger.warn(`Stripe webhook: no payment found for intent ${paymentIntentId}`);
    return;
  }

  let method: 'card' | 'apple_pay' | 'auto_pay' = isAutoPay ? 'auto_pay' : 'card';

  if (!isAutoPay && isStripeConfigured()) {
    try {
      const resolved = await resolvePaymentMethodFromIntent(paymentIntentId);
      if (resolved === 'apple_pay') method = 'apple_pay';
    } catch {
      // fall back to card
    }
  }

  await markPaymentAsPaid(payment, method, chargeId);
};

export const handleSetupIntentSuccess = async (setupIntentId: string): Promise<void> => {
  const intent = await retrieveSetupIntent(setupIntentId);
  if (intent.status !== 'succeeded') return;

  const tenantId = intent.metadata?.tenantId;
  const paymentMethodId =
    typeof intent.payment_method === 'string' ? intent.payment_method : intent.payment_method?.id;
  const customerId =
    typeof intent.customer === 'string' ? intent.customer : intent.customer?.id;

  if (!tenantId || !paymentMethodId || !customerId) {
    logger.warn(`SetupIntent ${setupIntentId}: missing tenantId, payment method, or customer`);
    return;
  }

  const lease = await LeaseAgreement.findOne({
    tenantId,
    status: { $in: ['accepted', 'active'] },
  });
  if (!lease) return;

  await AutoPaySetting.findOneAndUpdate(
    { tenantId },
    {
      tenantId,
      leaseId: lease._id,
      stripeCustomerId: customerId,
      stripePaymentMethodId: paymentMethodId,
    },
    { upsert: true, new: true }
  );

  logger.info(`Auto-pay payment method saved for tenant ${tenantId}`);
};

export const processAutoPayCharges = async (billingMonth?: string): Promise<number> => {
  if (!isStripeConfigured()) return 0;

  const month = billingMonth ?? getBillingMonth();
  const settings = await AutoPaySetting.find({
    enabled: true,
    stripeCustomerId: { $ne: null },
    stripePaymentMethodId: { $ne: null },
  });

  let charged = 0;

  for (const setting of settings) {
    const payment = await RentPayment.findOne({
      tenantId: setting.tenantId,
      billingMonth: month,
      status: { $in: ['pending', 'overdue'] },
      isActive: true,
    });

    if (!payment) continue;

    const tenant = await User.findById(setting.tenantId);
    if (!tenant) continue;

    try {
      const result = await chargeAutoPayOffSession({
        amount: payment.amount,
        currency: payment.currency,
        customerId: setting.stripeCustomerId!,
        paymentMethodId: setting.stripePaymentMethodId!,
        rentPaymentId: payment._id.toString(),
        tenantId: setting.tenantId.toString(),
        tenantEmail: tenant.email,
      });

      payment.stripePaymentIntentId = result.paymentIntentId;

      if (result.status === 'succeeded') {
        await markPaymentAsPaid(payment, 'auto_pay');
        setting.lastChargedAt = new Date();
        await setting.save();
        charged++;
      } else {
        await payment.save();
      }
    } catch (err) {
      logger.error(
        `Auto-pay failed for tenant ${setting.tenantId}: ${err instanceof Error ? err.message : 'Unknown'}`
      );
      await notifyUserAllChannels({
        userId: setting.tenantId.toString(),
        email: tenant.email,
        phone: tenant.phone,
        title: 'Auto-Pay Failed',
        body: `We could not charge your rent for ${payment.title}. Please pay manually or update your card.`,
        type: 'rent_due',
        rentPaymentId: payment._id.toString(),
        sendSms: tenant.notificationPreferences?.smsNotifications,
      });
    }
  }

  return charged;
};

// ─── Tenant APIs ──────────────────────────────────────────────────────────────

export const getTenantDashboard = async (
  tenantId: string
): Promise<TenantDashboardResult | null> => {
  const lease = await LeaseAgreement.findOne({
    tenantId,
    status: { $in: ['accepted', 'active'] },
  });

  if (!lease) {
    return null;
  }

  const billingMonth = getBillingMonth();

  let upcoming = await RentPayment.findOne({
    tenantId,
    status: { $in: ['pending', 'overdue'] },
    isActive: true,
  }).sort({ dueDate: 1 });

  if (!upcoming) {
    upcoming = await RentPayment.findOne({
      tenantId,
      billingMonth,
      isActive: true,
    });
  }

  const recentPayments = await RentPayment.find({
    tenantId,
    status: 'paid',
    isActive: true,
  })
    .sort({ paidAt: -1 })
    .limit(3);

  const autoPay = await AutoPaySetting.findOne({ tenantId });

  return {
    currentRent: {
      amount: lease.rentAmount,
      currency: DEFAULT_CURRENCY,
      dueDay: lease.paymentDueDay,
      dueLabel: `Due: ${lease.paymentDueDay}${getOrdinal(lease.paymentDueDay)} of each month`,
    },
    upcoming: upcoming
      ? {
          rentPaymentId: upcoming._id.toString(),
          title: upcoming.title,
          amount: upcoming.amount,
          currency: upcoming.currency,
          dueDate: upcoming.dueDate,
          daysUntilDue: getDaysUntilDue(upcoming.dueDate),
          status: upcoming.status,
        }
      : null,
    autoPay: {
      enabled: autoPay?.enabled ?? false,
      hasPaymentMethod: Boolean(autoPay?.stripePaymentMethodId),
    },
    recentPayments,
  };
};

export const listTenantPayments = async (
  tenantId: string,
  query: ListRentPaymentsQuery
) => {
  const filter: Record<string, unknown> = { tenantId, isActive: true };
  if (query.status) filter.status = query.status;
  if (query.billingMonth) filter.billingMonth = query.billingMonth;

  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    RentPayment.find(filter).sort({ dueDate: -1 }).skip(skip).limit(limit),
    RentPayment.countDocuments(filter),
  ]);

  const meta = buildPaginationMeta(total, page, limit);
  return { payments, ...meta };
};

export const getTenantPaymentById = async (
  tenantId: string,
  paymentId: string
): Promise<IRentPaymentDocument> => {
  if (!mongoose.isValidObjectId(paymentId)) {
    throw ApiError.badRequest('Invalid payment ID');
  }

  const payment = await RentPayment.findOne({
    _id: paymentId,
    tenantId,
    isActive: true,
  });

  if (!payment) throw ApiError.notFound('Payment not found');
  return payment;
};

export const createTenantPaymentIntent = async (
  tenantId: string,
  paymentId: string,
  paymentChannel: 'card' | 'apple_pay' = 'card'
): Promise<CreatePaymentIntentResult> => {
  if (!isStripeConfigured()) {
    throw ApiError.badRequest(
      'Online payment is not configured. Contact your landlord or try again later.'
    );
  }

  const payment = await getTenantPaymentById(tenantId, paymentId);

  if (!['pending', 'overdue'].includes(payment.status)) {
    throw ApiError.badRequest(`Cannot pay a payment with status: ${payment.status}`);
  }

  const tenant = await User.findById(tenantId);
  if (!tenant) throw ApiError.notFound('Tenant not found');

  const { clientSecret, paymentIntentId } = await createRentPaymentIntent({
    amount: payment.amount,
    currency: payment.currency,
    rentPaymentId: payment._id.toString(),
    tenantId,
    tenantEmail: tenant.email,
    paymentChannel,
  });

  payment.stripePaymentIntentId = paymentIntentId;
  await payment.save();

  return {
    clientSecret,
    paymentIntentId,
    amount: payment.amount,
    currency: payment.currency,
    paymentMethod: paymentChannel,
  };
};

export const createTenantApplePayIntent = async (
  tenantId: string,
  paymentId: string
): Promise<CreatePaymentIntentResult & { applePay: ApplePayConfigResult }> => {
  const publishableKey = getStripePublishableKey();
  if (!publishableKey) {
    throw ApiError.badRequest(
      'Apple Pay is not configured — set STRIPE_PUBLISHABLE_KEY in server environment'
    );
  }

  const intent = await createTenantPaymentIntent(tenantId, paymentId, 'apple_pay');
  const payment = await getTenantPaymentById(tenantId, paymentId);

  const applePay = buildApplePayConfig(publishableKey, payment.title, payment.amount, payment.currency);
  applePay.clientSecret = intent.clientSecret;

  return { ...intent, applePay };
};

export const getApplePayConfig = (): ApplePayConfigResult => {
  const publishableKey = getStripePublishableKey();
  if (!publishableKey) {
    throw ApiError.badRequest(
      'Apple Pay is not configured — set STRIPE_PUBLISHABLE_KEY in server environment'
    );
  }

  return buildApplePayConfig(publishableKey);
};

export const registerApplePayWebDomain = async (domain: string) => {
  if (!isStripeConfigured()) {
    throw ApiError.badRequest('Stripe is not configured on the server');
  }

  const result = await registerApplePayDomain(domain);
  logger.info(`Apple Pay domain registered: ${domain}`);
  return { domain: result.domain_name, livemode: result.livemode };
};

const buildApplePayConfig = (
  publishableKey: string,
  label?: string,
  amount?: number,
  currency?: string
): ApplePayConfigResult => ({
  publishableKey,
  merchantDisplayName: process.env.APPLE_PAY_MERCHANT_DISPLAY_NAME ?? 'B-Aziz Rent',
  countryCode: process.env.APPLE_PAY_COUNTRY_CODE ?? 'GB',
  currencyCode: currency ?? DEFAULT_CURRENCY,
  supportedNetworks: ['visa', 'masterCard', 'amex'],
  ...(label && amount !== undefined
    ? {
        // Mobile SDK cart item hints (iOS / React Native Stripe SDK)
        cartLabel: label,
        cartAmount: amount,
      }
    : {}),
});

// ─── Landlord APIs ────────────────────────────────────────────────────────────

export const getLandlordSummary = async (
  landlordId: string
): Promise<LandlordSummaryResult> => {
  const base = { landlordId: new mongoose.Types.ObjectId(landlordId), isActive: true };

  const [collected, pending, overdue] = await Promise.all([
    RentPayment.aggregate([
      { $match: { ...base, status: 'paid' } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    RentPayment.aggregate([
      { $match: { ...base, status: 'pending' } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    RentPayment.aggregate([
      { $match: { ...base, status: 'overdue' } },
      { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  const map = (agg: Array<{ amount: number; count: number }>) => ({
    amount: Math.round((agg[0]?.amount ?? 0) * 100) / 100,
    currency: DEFAULT_CURRENCY,
    count: agg[0]?.count ?? 0,
  });

  return {
    collected: map(collected),
    pending: map(pending),
    overdue: map(overdue),
  };
};

export const listLandlordPayments = async (
  landlordId: string,
  query: ListRentPaymentsQuery
) => {
  const filter: Record<string, unknown> = {
    landlordId,
    isActive: true,
  };

  if (query.status) filter.status = query.status;
  if (query.billingMonth) filter.billingMonth = query.billingMonth;
  if (query.propertyId) filter.propertyId = query.propertyId;

  if (query.search?.trim()) {
    const escaped = escapeRegex(query.search.trim());
    const tenants = await User.find({
      firstName: { $regex: escaped, $options: 'i' },
      role: 'tenant',
    }).select('_id');
    const properties = await Property.find({
      propertyName: { $regex: escaped, $options: 'i' },
      landlordId,
    }).select('_id');

    filter.$or = [
      { tenantId: { $in: tenants.map((t) => t._id) } },
      { propertyId: { $in: properties.map((p) => p._id) } },
    ];
  }

  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    RentPayment.find(filter)
      .populate('tenantId', 'firstName email')
      .populate('propertyId', 'propertyName')
      .sort({ dueDate: -1 })
      .skip(skip)
      .limit(limit),
    RentPayment.countDocuments(filter),
  ]);

  const meta = buildPaginationMeta(total, page, limit);
  return { payments, ...meta };
};

export const createManualPayment = async (
  landlordId: string,
  input: CreateManualPaymentInput
): Promise<IRentPaymentDocument> => {
  const property = await Property.findOne({
    _id: input.propertyId,
    landlordId,
    isActive: true,
  });
  if (!property) throw ApiError.notFound('Property not found');

  const lease = await LeaseAgreement.findOne({
    propertyId: input.propertyId,
    tenantId: input.tenantId,
    landlordId,
    status: { $in: ['accepted', 'active'] },
  });
  if (!lease) throw ApiError.badRequest('No active lease for this tenant on this property');

  const billingMonth = input.billingMonth ?? getBillingMonth(parseDateOnly(input.paymentDate));
  const existing = await RentPayment.findOne({ leaseId: lease._id, billingMonth });
  if (existing) {
    throw ApiError.conflict(`Payment for ${billingMonth} already exists for this tenant`);
  }

  const payment = await RentPayment.create({
    leaseId: lease._id,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    tenantId: lease.tenantId,
    landlordId: lease.landlordId,
    billingMonth,
    title: formatBillingTitle(billingMonth),
    amount: input.amount,
    currency: DEFAULT_CURRENCY,
    dueDate: parseDateOnly(input.paymentDate),
    paidAt: input.status === 'paid' ? parseDateOnly(input.paymentDate) : null,
    status: input.status as RentPaymentStatus,
    paymentMethod: input.status === 'paid' ? 'manual' : null,
    createdBy: 'landlord',
    isActive: true,
  });

  return payment;
};

export const updateManualPayment = async (
  landlordId: string,
  paymentId: string,
  input: UpdateManualPaymentInput
): Promise<IRentPaymentDocument> => {
  if (!mongoose.isValidObjectId(paymentId)) {
    throw ApiError.badRequest('Invalid payment ID');
  }

  const payment = await RentPayment.findOne({
    _id: paymentId,
    landlordId,
    isActive: true,
  });
  if (!payment) throw ApiError.notFound('Payment not found');

  if (input.amount !== undefined) payment.amount = input.amount;
  if (input.paymentDate !== undefined) {
    payment.dueDate = parseDateOnly(input.paymentDate);
    if (payment.status === 'paid') payment.paidAt = parseDateOnly(input.paymentDate);
  }
  if (input.status !== undefined) {
    payment.status = input.status;
    if (input.status === 'paid') {
      payment.paidAt = payment.paidAt ?? new Date();
      payment.paymentMethod = 'manual';
    }
  }

  await payment.save();
  return payment;
};

export const getMonthlyReport = async (
  landlordId: string,
  billingMonth: string
): Promise<MonthlyReportResult> => {
  const payments = await RentPayment.find({
    landlordId,
    billingMonth,
    isActive: true,
  })
    .populate('tenantId', 'firstName')
    .populate('propertyId', 'propertyName');

  const summary = { paid: 0, pending: 0, overdue: 0, total: payments.length };

  const rows = payments.map((p) => {
    if (p.status === 'paid') summary.paid++;
    else if (p.status === 'pending') summary.pending++;
    else if (p.status === 'overdue') summary.overdue++;

    const tenant = p.tenantId as unknown as { firstName?: string };
    const property = p.propertyId as unknown as { propertyName?: string };

    return {
      tenantName: tenant?.firstName ?? 'Unknown',
      propertyName: property?.propertyName ?? 'Unknown',
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      paidAt: p.paidAt,
      dueDate: p.dueDate,
    };
  });

  return {
    billingMonth,
    label: formatBillingLabel(billingMonth),
    summary,
    payments: rows,
  };
};

// ─── Auto-Pay ─────────────────────────────────────────────────────────────────

export const setupAutoPay = async (tenantId: string) => {
  if (!isStripeConfigured()) {
    throw ApiError.badRequest('Stripe is not configured on the server');
  }

  const lease = await LeaseAgreement.findOne({
    tenantId,
    status: { $in: ['accepted', 'active'] },
  });
  if (!lease) throw ApiError.notFound('No active lease found');

  const tenant = await User.findById(tenantId);
  if (!tenant) throw ApiError.notFound('Tenant not found');

  const existing = await AutoPaySetting.findOne({ tenantId });

  const customerId = await getOrCreateStripeCustomer({
    tenantId,
    email: tenant.email,
    name: tenant.firstName,
    existingCustomerId: existing?.stripeCustomerId,
  });

  const { clientSecret, setupIntentId } = await createAutoPaySetupIntent({
    customerId,
    tenantId,
  });

  await AutoPaySetting.findOneAndUpdate(
    { tenantId },
    { tenantId, leaseId: lease._id, stripeCustomerId: customerId },
    { upsert: true, new: true }
  );

  return { clientSecret, setupIntentId, customerId };
};

export const confirmAutoPaySetup = async (tenantId: string, setupIntentId: string) => {
  if (!isStripeConfigured()) {
    throw ApiError.badRequest('Stripe is not configured on the server');
  }

  const intent = await retrieveSetupIntent(setupIntentId);
  if (intent.metadata?.tenantId !== tenantId) {
    throw ApiError.forbidden('SetupIntent does not belong to this tenant');
  }

  await handleSetupIntentSuccess(setupIntentId);

  const setting = await AutoPaySetting.findOne({ tenantId });
  return {
    enabled: setting?.enabled ?? false,
    hasPaymentMethod: Boolean(setting?.stripePaymentMethodId),
  };
};

export const getAutoPaySettings = async (tenantId: string) => {
  const setting = await AutoPaySetting.findOne({ tenantId });
  return {
    enabled: setting?.enabled ?? false,
    hasPaymentMethod: Boolean(setting?.stripePaymentMethodId),
    lastChargedAt: setting?.lastChargedAt ?? null,
  };
};

export const updateAutoPaySettings = async (tenantId: string, enabled: boolean) => {
  const lease = await LeaseAgreement.findOne({
    tenantId,
    status: { $in: ['accepted', 'active'] },
  });
  if (!lease) throw ApiError.notFound('No active lease found');

  const existing = await AutoPaySetting.findOne({ tenantId });

  if (enabled && !existing?.stripePaymentMethodId) {
    throw ApiError.badRequest(
      'Save a payment method first — call POST /auto-pay/setup and POST /auto-pay/confirm'
    );
  }

  const setting = await AutoPaySetting.findOneAndUpdate(
    { tenantId },
    { tenantId, leaseId: lease._id, enabled },
    { upsert: true, new: true }
  );

  return {
    enabled: setting.enabled,
    hasPaymentMethod: Boolean(setting.stripePaymentMethodId),
    lastChargedAt: setting.lastChargedAt ?? null,
  };
};

// ─── Notifications & Device Token ───────────────────────────────────────────

export const listUserNotifications = async (userId: string, page: number, limit: number) => {
  const skip = (page - 1) * limit;
  const filter = { userId };

  const [notifications, total] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);

  return { notifications, ...buildPaginationMeta(total, page, limit) };
};

export const markNotificationRead = async (userId: string, notificationId: string) => {
  if (!mongoose.isValidObjectId(notificationId)) {
    throw ApiError.badRequest('Invalid notification ID');
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { read: true },
    { new: true }
  );

  if (!notification) throw ApiError.notFound('Notification not found');
  return notification;
};

export const registerDeviceToken = async (
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web'
) => {
  await DeviceToken.findOneAndUpdate(
    { token },
    { userId, token, platform, isActive: true },
    { upsert: true, new: true }
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getOrdinal = (n: number): string => {
  if (n >= 11 && n <= 13) return 'th';
  const rem = n % 10;
  if (rem === 1) return 'st';
  if (rem === 2) return 'nd';
  if (rem === 3) return 'rd';
  return 'th';
};
