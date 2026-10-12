/**
 * Monthly Bill Validation Schemas
 * Joi schemas for all monthly bill endpoints
 */

import Joi from 'joi';
import type {
  AddBillInput,
  UpdateBillInput,
  UpdateStatusInput,
  ListBillsQuery,
  BillType,
  PaymentStatus,
} from './monthly-bill.types';

// ─── Valid Enum Values ─────────────────────────────────────────────────────────

const BILL_TYPES: BillType[] = ['water', 'electricity', 'gas', 'council_tax', 'broadband', 'other'];

const BILLING_CYCLES = ['weekly', 'monthly', 'yearly', 'one_time'];

const PAYMENT_STATUSES: PaymentStatus[] = ['paid', 'pending', 'overdue'];

// ─── URL pattern ──────────────────────────────────────────────────────────────

const URL_PATTERN = /^https?:\/\/[^\s$.?#].[^\s]*$/;

// ─── Add Bill ─────────────────────────────────────────────────────────────────
// Note: propertyId and unitId are NOT accepted here — resolved from tenant's active lease

export const addBillSchema = Joi.object<AddBillInput>({
  billType: Joi.string()
    .valid(...BILL_TYPES)
    .required()
    .messages({
      'any.only': `Bill type must be one of: ${BILL_TYPES.join(', ')}`,
      'any.required': 'Bill type is required',
    }),
  billingCycle: Joi.string()
    .valid(...BILLING_CYCLES)
    .required()
    .messages({
      'any.only': `Billing cycle must be one of: ${BILLING_CYCLES.join(', ')}`,
      'any.required': 'Billing cycle is required',
    }),
  supplier: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Supplier name is required',
    'string.max': 'Supplier name cannot exceed 100 characters',
    'any.required': 'Supplier name is required',
  }),
  accountReference: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Account reference is required',
    'string.max': 'Account reference cannot exceed 100 characters',
    'any.required': 'Account reference is required',
  }),
  amount: Joi.number().min(0).required().messages({
    'number.base': 'Amount must be a number',
    'number.min': 'Amount cannot be negative',
    'any.required': 'Amount is required',
  }),
  dueDay: Joi.number().integer().min(1).max(365).required().messages({
    'number.base': 'Due day must be a number',
    'number.integer': 'Due day must be an integer',
    'number.min': 'Due day must be between 1 and 365',
    'number.max': 'Due day must be between 1 and 365',
    'any.required': 'Due day is required',
  }),
  tenantId: Joi.string().optional().messages({
    'string.base': 'tenantId must be a string',
  }),
  paymentStatus: Joi.string()
    .valid(...PAYMENT_STATUSES)
    .optional()
    .messages({
      'any.only': `Payment status must be one of: ${PAYMENT_STATUSES.join(', ')}`,
    }),
  supplierPhone: Joi.string().trim().max(20).optional().allow('', null).messages({
    'string.max': 'Supplier phone cannot exceed 20 characters',
  }),
  supplierWebsite: Joi.string()
    .trim()
    .pattern(URL_PATTERN)
    .optional()
    .allow('', null)
    .messages({
      'string.pattern.base': 'Supplier website must be a valid URL (http/https)',
    }),
  notes: Joi.string().trim().max(500).optional().allow('', null).messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
}).options({ stripUnknown: true });

// ─── Update Bill ──────────────────────────────────────────────────────────────

export const updateBillSchema = Joi.object<UpdateBillInput>({
  billType: Joi.string()
    .valid(...BILL_TYPES)
    .optional()
    .messages({
      'any.only': `Bill type must be one of: ${BILL_TYPES.join(', ')}`,
    }),
  billingCycle: Joi.string()
    .valid(...BILLING_CYCLES)
    .optional()
    .messages({
      'any.only': `Billing cycle must be one of: ${BILLING_CYCLES.join(', ')}`,
    }),
  supplier: Joi.string().trim().min(1).max(100).optional().messages({
    'string.empty': 'Supplier name cannot be empty',
    'string.max': 'Supplier name cannot exceed 100 characters',
  }),
  accountReference: Joi.string().trim().min(1).max(100).optional().messages({
    'string.empty': 'Account reference cannot be empty',
    'string.max': 'Account reference cannot exceed 100 characters',
  }),
  amount: Joi.number().min(0).optional().messages({
    'number.base': 'Amount must be a number',
    'number.min': 'Amount cannot be negative',
  }),
  dueDay: Joi.number().integer().min(1).max(365).optional().messages({
    'number.base': 'Due day must be a number',
    'number.integer': 'Due day must be an integer',
    'number.min': 'Due day must be between 1 and 365',
    'number.max': 'Due day must be between 1 and 365',
  }),
  paymentStatus: Joi.string()
    .valid(...PAYMENT_STATUSES)
    .optional()
    .messages({
      'any.only': `Payment status must be one of: ${PAYMENT_STATUSES.join(', ')}`,
    }),
  supplierPhone: Joi.string().trim().max(20).optional().allow('', null).messages({
    'string.max': 'Supplier phone cannot exceed 20 characters',
  }),
  supplierWebsite: Joi.string()
    .trim()
    .pattern(URL_PATTERN)
    .optional()
    .allow('', null)
    .messages({
      'string.pattern.base': 'Supplier website must be a valid URL (http/https)',
    }),
  notes: Joi.string().trim().max(500).optional().allow('', null).messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
}).options({ stripUnknown: true });

// ─── Update Payment Status ────────────────────────────────────────────────────

export const updateStatusSchema = Joi.object<UpdateStatusInput>({
  paymentStatus: Joi.string()
    .valid(...PAYMENT_STATUSES)
    .required()
    .messages({
      'any.only': `Payment status must be one of: ${PAYMENT_STATUSES.join(', ')}`,
      'any.required': 'Payment status is required',
    }),
});

// ─── List Bills Query ─────────────────────────────────────────────────────────

export const listBillsSchema = Joi.object<ListBillsQuery>({
  billType: Joi.string()
    .valid(...BILL_TYPES)
    .optional()
    .messages({
      'any.only': `Bill type must be one of: ${BILL_TYPES.join(', ')}`,
    }),
  paymentStatus: Joi.string()
    .valid(...PAYMENT_STATUSES)
    .optional()
    .messages({
      'any.only': `Payment status must be one of: ${PAYMENT_STATUSES.join(', ')}`,
    }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).options({ stripUnknown: true });
