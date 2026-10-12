/**
 * Rent Payment Controllers — Tenant + Landlord + Webhook
 */

import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import * as rentPaymentService from './rent-payment.service';
import {
  listRentPaymentsSchema,
  createManualPaymentSchema,
  updateManualPaymentSchema,
  monthlyReportSchema,
  updateAutoPaySchema,
  registerDeviceTokenSchema,
  confirmAutoPaySchema,
  registerApplePayDomainSchema,
} from './rent-payment.validation';
import { constructStripeEvent, parseStripeEventPayload, normalizePaymentIntentId } from './stripe.service';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import logger from '../../config/logger';
import env from '../../config/env';
import { generateMonthlyReportPdf } from './rent-report.pdf';
import type {
  ListRentPaymentsQuery,
  CreateManualPaymentInput,
  UpdateManualPaymentInput,
} from './rent-payment.types';

const validateBody = <T>(schema: Joi.Schema, body: unknown): T => {
  const { error, value } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw ApiError.badRequest('Validation failed', error.details.map((d) => d.message));
  }
  return value as T;
};

const formatPayment = (p: any) => ({
  id: p._id,
  leaseId: p.leaseId,
  propertyId: p.propertyId,
  tenantId: p.tenantId,
  billingMonth: p.billingMonth,
  title: p.title,
  amount: p.amount,
  currency: p.currency,
  dueDate: p.dueDate,
  paidAt: p.paidAt,
  status: p.status,
  paymentMethod: p.paymentMethod,
  createdAt: p.createdAt,
  tenant: p.tenantId?.firstName
    ? { name: p.tenantId.firstName, email: p.tenantId.email }
    : undefined,
  property: p.propertyId?.propertyName
    ? { name: p.propertyId.propertyName }
    : undefined,
});

// ─── Tenant ───────────────────────────────────────────────────────────────────

export const getTenantDashboard = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = req.user!._id.toString();
    const dashboard = await rentPaymentService.getTenantDashboard(tenantId);
    if (!dashboard) {
      res.status(200).json(
        ApiResponse.ok('Payment dashboard retrieved', {
          upcomingRent: null,
          recentPayments: [],
          autoPayEnabled: false,
        })
      );
      return;
    }
    res.status(200).json(
      ApiResponse.ok('Payment dashboard retrieved', {
        ...dashboard,
        recentPayments: dashboard.recentPayments.map(formatPayment),
      })
    );
  }
);

export const listTenantPayments = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = req.user!._id.toString();
    const query = validateBody<ListRentPaymentsQuery>(listRentPaymentsSchema, req.query);
    const result = await rentPaymentService.listTenantPayments(tenantId, query);
    res.status(200).json(
      ApiResponse.ok('Payments retrieved', {
        payments: result.payments.map(formatPayment),
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage,
        },
      })
    );
  }
);

export const getTenantPaymentById = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = req.user!._id.toString();
    const payment = await rentPaymentService.getTenantPaymentById(
      tenantId,
      req.params.paymentId
    );
    res.status(200).json(ApiResponse.ok('Payment retrieved', { payment: formatPayment(payment) }));
  }
);

export const createPaymentIntent = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = req.user!._id.toString();
    try {
      const result = await rentPaymentService.createTenantPaymentIntent(
        tenantId,
        req.params.paymentId,
        'card'
      );
      res.status(200).json(ApiResponse.ok('Payment intent created', result));
    } catch (err) {
      if (err instanceof Error && err.message === 'STRIPE_NOT_CONFIGURED') {
        throw ApiError.badRequest('Stripe is not configured on the server');
      }
      throw err;
    }
  }
);

export const createApplePayPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = req.user!._id.toString();
    try {
      const result = await rentPaymentService.createTenantApplePayIntent(
        tenantId,
        req.params.paymentId
      );
      res.status(200).json(
        ApiResponse.ok('Apple Pay payment intent created', {
          clientSecret: result.clientSecret,
          paymentIntentId: result.paymentIntentId,
          amount: result.amount,
          currency: result.currency,
          paymentMethod: 'apple_pay',
          applePay: result.applePay,
        })
      );
    } catch (err) {
      if (err instanceof Error && err.message === 'STRIPE_NOT_CONFIGURED') {
        throw ApiError.badRequest('Stripe is not configured on the server');
      }
      throw err;
    }
  }
);

export const mockPaymentSuccess = asyncHandler(
  async (req: Request, res: Response) => {
    const tenantId = req.user!._id.toString();
    const payment = await rentPaymentService.getTenantPaymentById(tenantId, req.params.paymentId);
    if (!['pending', 'overdue'].includes(payment.status)) {
      throw ApiError.badRequest(`Cannot pay a payment with status: ${payment.status}`);
    }
    const updated = await rentPaymentService.markPaymentAsPaid(payment, 'card');
    res.status(200).json(ApiResponse.ok('Payment successful (mocked)', { payment: formatPayment(updated) }));
  }
);

export const getApplePayConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = rentPaymentService.getApplePayConfig();
  res.status(200).json(ApiResponse.ok('Apple Pay configuration retrieved', { applePay: config }));
});

export const registerApplePayDomain = asyncHandler(async (req: Request, res: Response) => {
  const { domain } = validateBody<{ domain: string }>(
    registerApplePayDomainSchema,
    req.body
  );
  const result = await rentPaymentService.registerApplePayWebDomain(domain);
  res.status(201).json(ApiResponse.created('Apple Pay domain registered with Stripe', result));
});

export const setupAutoPay = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!._id.toString();
  try {
    const result = await rentPaymentService.setupAutoPay(tenantId);
    res.status(200).json(ApiResponse.ok('Auto-pay setup started', result));
  } catch (err) {
    if (err instanceof Error && err.message === 'STRIPE_NOT_CONFIGURED') {
      throw ApiError.badRequest('Stripe is not configured on the server');
    }
    throw err;
  }
});

export const confirmAutoPaySetup = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!._id.toString();
  const { setupIntentId } = validateBody<{ setupIntentId: string }>(
    confirmAutoPaySchema,
    req.body
  );
  const settings = await rentPaymentService.confirmAutoPaySetup(tenantId, setupIntentId);
  res.status(200).json(ApiResponse.ok('Payment method saved for auto-pay', settings));
});

export const getAutoPay = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!._id.toString();
  const settings = await rentPaymentService.getAutoPaySettings(tenantId);
  res.status(200).json(ApiResponse.ok('Auto-pay settings retrieved', settings));
});

export const updateAutoPay = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.user!._id.toString();
  const { enabled } = validateBody<{ enabled: boolean }>(updateAutoPaySchema, req.body);
  const settings = await rentPaymentService.updateAutoPaySettings(tenantId, enabled);
  res.status(200).json(ApiResponse.ok('Auto-pay settings updated', settings));
});

export const registerDeviceToken = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const input = validateBody<{ token: string; platform: 'ios' | 'android' | 'web' }>(
      registerDeviceTokenSchema,
      req.body
    );
    await rentPaymentService.registerDeviceToken(userId, input.token, input.platform);
    res.status(200).json(ApiResponse.ok('Device token registered'));
  }
);

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!._id.toString();
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const result = await rentPaymentService.listUserNotifications(userId, page, limit);
  res.status(200).json(
    ApiResponse.ok('Notifications retrieved', {
      notifications: result.notifications,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
    })
  );
});

export const markNotificationRead = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!._id.toString();
    const notification = await rentPaymentService.markNotificationRead(
      userId,
      req.params.notificationId
    );
    res.status(200).json(ApiResponse.ok('Notification marked as read', { notification }));
  }
);

// ─── Landlord ─────────────────────────────────────────────────────────────────

export const getLandlordSummary = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = req.user!._id.toString();
  const summary = await rentPaymentService.getLandlordSummary(landlordId);
  res.status(200).json(ApiResponse.ok('Payment summary retrieved', { summary }));
});

export const listLandlordPayments = asyncHandler(
  async (req: Request, res: Response) => {
    const landlordId = req.user!._id.toString();
    const query = validateBody<ListRentPaymentsQuery>(listRentPaymentsSchema, req.query);
    const result = await rentPaymentService.listLandlordPayments(landlordId, query);
    res.status(200).json(
      ApiResponse.ok('Payments retrieved', {
        payments: result.payments.map(formatPayment),
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage,
        },
      })
    );
  }
);

export const createManualPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const landlordId = req.user!._id.toString();
    const input = validateBody<CreateManualPaymentInput>(
      createManualPaymentSchema,
      req.body
    );
    const payment = await rentPaymentService.createManualPayment(landlordId, input);
    res.status(201).json(
      ApiResponse.created('Payment recorded successfully', { payment: formatPayment(payment) })
    );
  }
);

export const updateManualPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const landlordId = req.user!._id.toString();
    const input = validateBody<UpdateManualPaymentInput>(
      updateManualPaymentSchema,
      req.body
    );
    const payment = await rentPaymentService.updateManualPayment(
      landlordId,
      req.params.paymentId,
      input
    );
    res.status(200).json(
      ApiResponse.ok('Payment updated successfully', { payment: formatPayment(payment) })
    );
  }
);

export const getMonthlyReport = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = req.user!._id.toString();
  const { billingMonth } = validateBody<{ billingMonth: string }>(
    monthlyReportSchema,
    req.query
  );
  const report = await rentPaymentService.getMonthlyReport(landlordId, billingMonth);

  if (req.query.format === 'pdf') {
    const pdf = await generateMonthlyReportPdf(report);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rent-report-${billingMonth}.pdf"`
    );
    res.send(pdf);
    return;
  }

  res.status(200).json(ApiResponse.ok('Monthly report generated', { report }));
});

export const triggerBilling = asyncHandler(async (req: Request, res: Response) => {
  const created = await rentPaymentService.generateMonthlyRentBills({ force: true });
  const overdue = await rentPaymentService.markOverduePayments();
  const autoCharged = await rentPaymentService.processAutoPayCharges();
  res.status(200).json(
    ApiResponse.ok('Billing job executed', {
      billsCreated: created,
      markedOverdue: overdue,
      autoCharged,
    })
  );
});

// ─── Stripe Webhook ───────────────────────────────────────────────────────────

export const handleStripeWebhook = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      throw ApiError.badRequest('Missing Stripe signature');
    }

    let event;
    try {
      event = constructStripeEvent(req.body as Buffer, signature);
    } catch (err) {
      logger.error(`Stripe webhook error: ${err instanceof Error ? err.message : 'Unknown'}`);
      throw ApiError.badRequest('Invalid Stripe webhook signature');
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as {
        id: string;
        latest_charge?: string | null;
        metadata?: { autoPay?: string };
      };
      await rentPaymentService.handleStripePaymentSuccess(
        intent.id,
        typeof intent.latest_charge === 'string' ? intent.latest_charge : undefined,
        intent.metadata?.autoPay === 'true'
      );
    }

    if (event.type === 'setup_intent.succeeded') {
      const intent = event.data.object as { id: string };
      await rentPaymentService.handleSetupIntentSuccess(intent.id);
    }

    res.status(200).json({ received: true });
  }
);

/** Dev/test webhook — skips signature when STRIPE_WEBHOOK_DEV_MODE=true */
export const handleStripeWebhookDev = asyncHandler(
  async (req: Request, res: Response) => {
    if (env.NODE_ENV === 'production' || process.env.STRIPE_WEBHOOK_DEV_MODE !== 'true') {
      throw ApiError.notFound('Not found');
    }

    const event = parseStripeEventPayload(req.body as Buffer | Record<string, unknown>);

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as {
        id: string;
        latest_charge?: string | null;
        metadata?: { autoPay?: string };
      };
      const paymentIntentId = normalizePaymentIntentId(intent.id);
      await rentPaymentService.handleStripePaymentSuccess(
        paymentIntentId,
        typeof intent.latest_charge === 'string' ? intent.latest_charge : undefined,
        intent.metadata?.autoPay === 'true'
      );
    }

    if (event.type === 'setup_intent.succeeded') {
      const intent = event.data.object as { id: string };
      await rentPaymentService.handleSetupIntentSuccess(intent.id);
    }

    res.status(200).json({ received: true, mode: 'dev' });
  }
);
