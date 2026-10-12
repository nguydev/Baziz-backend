/**
 * Landlord Rent Payment Routes
 */

import { Router } from 'express';
import * as rentPaymentController from './rent-payment.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';

const router = Router();

router.use(authMiddleware, authorize('landlord'));

router.get('/summary', requirePermission('fin_view_acct'), rentPaymentController.getLandlordSummary);
router.get('/report', requirePermission('fin_view_reports'), rentPaymentController.getMonthlyReport);
router.post('/generate-bills', apiLimiter, requirePermission('fin_edit_acct'), rentPaymentController.triggerBilling);
router.post('/apple-pay/register-domain', apiLimiter, requirePermission('admin_billing'), rentPaymentController.registerApplePayDomain);
router.post('/manual', apiLimiter, requirePermission('fin_edit_acct'), rentPaymentController.createManualPayment);
router.get('/', requirePermission('fin_view_acct'), rentPaymentController.listLandlordPayments);
router.patch('/:paymentId', apiLimiter, requirePermission('fin_edit_acct'), rentPaymentController.updateManualPayment);

export default router;
