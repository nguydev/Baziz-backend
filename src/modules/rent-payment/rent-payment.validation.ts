/**
 * Rent Payment Validation
 */

import Joi from 'joi';
import type {
  CreateManualPaymentInput,
  UpdateManualPaymentInput,
  ListRentPaymentsQuery,
  RentPaymentStatus,
} from './rent-payment.types';

const STATUSES: RentPaymentStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];

const billingMonthSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}$/)
  .messages({ 'string.pattern.base': 'billingMonth must be YYYY-MM' });

const isoDateSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .messages({ 'string.pattern.base': 'Date must be YYYY-MM-DD' });

export const listRentPaymentsSchema = Joi.object<ListRentPaymentsQuery>({
  status: Joi.string().valid(...STATUSES).optional(),
  billingMonth: billingMonthSchema.optional(),
  propertyId: Joi.string().optional(),
  search: Joi.string().trim().max(100).optional().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).options({ stripUnknown: true });

export const createManualPaymentSchema = Joi.object<CreateManualPaymentInput>({
  propertyId: Joi.string().required(),
  tenantId: Joi.string().required(),
  amount: Joi.number().positive().precision(2).required(),
  paymentDate: isoDateSchema.required(),
  status: Joi.string().valid('pending', 'paid', 'overdue').required(),
  billingMonth: billingMonthSchema.optional(),
}).options({ stripUnknown: true });

export const updateManualPaymentSchema = Joi.object<UpdateManualPaymentInput>({
  amount: Joi.number().positive().precision(2).optional(),
  paymentDate: isoDateSchema.optional(),
  status: Joi.string().valid(...STATUSES).optional(),
})
  .min(1)
  .messages({ 'object.min': 'At least one field must be provided' })
  .options({ stripUnknown: true });

export const monthlyReportSchema = Joi.object({
  billingMonth: billingMonthSchema.required(),
}).options({ stripUnknown: true });

export const updateAutoPaySchema = Joi.object({
  enabled: Joi.boolean().required(),
}).options({ stripUnknown: true });

export const registerDeviceTokenSchema = Joi.object({
  token: Joi.string().trim().required(),
  platform: Joi.string().valid('ios', 'android', 'web').required(),
}).options({ stripUnknown: true });

export const confirmAutoPaySchema = Joi.object({
  setupIntentId: Joi.string().trim().required(),
}).options({ stripUnknown: true });

export const registerApplePayDomainSchema = Joi.object({
  domain: Joi.string()
    .hostname()
    .required()
    .messages({ 'string.hostname': 'domain must be a valid hostname (e.g. app.example.com)' }),
}).options({ stripUnknown: true });
