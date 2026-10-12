/**
 * Landlord SaaS Billing — /api/v1/billing/*
 * Separate from tenant rent Stripe payments.
 */

import { Router } from 'express';
import * as billingController from './billing.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';

const router = Router();

router.use(authMiddleware, authorize('landlord'), requirePermission('admin_billing'));

router.get('/plans', billingController.listPlans);
router.get('/subscription', billingController.getSubscription);
router.get('/usage', billingController.getUsage);
router.post('/checkout', apiLimiter, billingController.createCheckout);
router.post('/portal', apiLimiter, billingController.createPortal);
router.post('/downgrade', apiLimiter, billingController.downgradePlan);
router.patch('/info', apiLimiter, billingController.updateBillingInfo);
router.get('/invoices', billingController.listInvoices);
router.get('/invoices/:id', billingController.getInvoiceById);

export default router;
