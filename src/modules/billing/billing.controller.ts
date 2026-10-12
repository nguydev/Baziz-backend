import type { Request, Response } from 'express';
import Joi from 'joi';
import * as billingService from './billing.service';
import {
  checkoutSchema,
  downgradeSchema,
  listInvoicesSchema,
  portalSchema,
  updateBillingInfoSchema,
} from './billing.validation';
import { constructBillingWebhookEvent } from './billing-stripe.service';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import logger from '../../config/logger';
import type { CheckoutInput, DowngradeInput, PortalInput, UpdateBillingInfoInput } from './billing.types';

const validate = <T>(schema: Joi.ObjectSchema<T>, data: unknown): T => {
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw ApiError.badRequest('Validation failed', error.details.map((d) => d.message));
  }
  return value as T;
};

const getUserId = (req: Request): string => {
  if (!req.user) throw ApiError.unauthorized('User not authenticated');
  return req.user._id.toString();
};

export const listPlans = asyncHandler(async (_req: Request, res: Response) => {
  const data = billingService.listPlans();
  res.status(200).json(ApiResponse.ok('Plans retrieved', data));
});

export const getSubscription = asyncHandler(async (req: Request, res: Response) => {
  const subscription = await billingService.getSubscription(getUserId(req));
  res.status(200).json(ApiResponse.ok('Subscription retrieved', subscription));
});

export const getUsage = asyncHandler(async (req: Request, res: Response) => {
  const usage = await billingService.getUsage(getUserId(req));
  res.status(200).json(ApiResponse.ok('Usage retrieved', usage));
});

export const createCheckout = asyncHandler(async (req: Request, res: Response) => {
  const input = validate<CheckoutInput>(checkoutSchema, req.body);
  const session = await billingService.createCheckout(getUserId(req), input);
  res.status(200).json(ApiResponse.ok('Checkout session created', session));
});

export const createPortal = asyncHandler(async (req: Request, res: Response) => {
  const input = validate<PortalInput>(portalSchema, req.body);
  const portal = await billingService.createPortal(getUserId(req), input);
  res.status(200).json(ApiResponse.ok('Billing portal session created', portal));
});

export const downgradePlan = asyncHandler(async (req: Request, res: Response) => {
  const input = validate<DowngradeInput>(downgradeSchema, req.body);
  const result = await billingService.downgradePlan(getUserId(req), input);
  res.status(200).json(ApiResponse.ok(result.message, result));
});

export const updateBillingInfo = asyncHandler(async (req: Request, res: Response) => {
  const input = validate<UpdateBillingInfoInput>(updateBillingInfoSchema, req.body);
  const result = await billingService.updateBillingInfo(getUserId(req), input);
  res.status(200).json(ApiResponse.ok(result.message, result));
});

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  const query = validate<{ page?: number; limit?: number }>(listInvoicesSchema, req.query);
  const { invoices, pagination } = await billingService.listInvoices(
    getUserId(req),
    query.page ?? 1,
    query.limit ?? 10
  );
  res.status(200).json(ApiResponse.ok('Invoices retrieved', { invoices }, pagination));
});

export const getInvoiceById = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await billingService.getInvoiceById(getUserId(req), req.params.id);
  res.status(200).json(ApiResponse.ok('Invoice retrieved', { invoice }));
});

export const handleStripeBillingWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    throw ApiError.badRequest('Missing stripe-signature header');
  }

  try {
    const event = constructBillingWebhookEvent(req.body as Buffer, signature);
    await billingService.handleBillingWebhookEvent(
      event as unknown as { type: string; data: { object: Record<string, unknown> } }
    );
    res.status(200).json({ received: true });
  } catch (err) {
    logger.error(
      `[Billing Webhook] Error: ${err instanceof Error ? err.message : 'Unknown'}`
    );
    throw ApiError.badRequest('Webhook signature verification failed');
  }
});
