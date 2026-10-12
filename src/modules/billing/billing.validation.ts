import Joi from 'joi';
import type {
  CheckoutInput,
  DowngradeInput,
  PortalInput,
  UpdateBillingInfoInput,
} from './billing.types';

export const checkoutSchema = Joi.object<CheckoutInput>({
  planId: Joi.string().valid('pro').required(),
  successUrl: Joi.string().uri().required(),
  cancelUrl: Joi.string().uri().required(),
}).options({ stripUnknown: true });

export const portalSchema = Joi.object<PortalInput>({
  returnUrl: Joi.string().uri().required(),
}).options({ stripUnknown: true });

export const downgradeSchema = Joi.object<DowngradeInput>({
  planId: Joi.string().valid('free', 'pro').default('free'),
})
  .default({ planId: 'free' })
  .options({ stripUnknown: true });

export const updateBillingInfoSchema = Joi.object<UpdateBillingInfoInput>({
  billingEmail: Joi.string().trim().email().optional(),
  billingAddress: Joi.string().trim().max(500).optional(),
})
  .min(1)
  .options({ stripUnknown: true });

export const listInvoicesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
}).options({ stripUnknown: true });
