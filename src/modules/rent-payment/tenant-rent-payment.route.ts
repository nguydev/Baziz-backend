/**
 * Tenant Rent Payment Routes
 */

import { Router } from 'express';
import * as rentPaymentController from './rent-payment.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';

const router = Router();

router.use(authMiddleware, authorize('tenant'));

router.get('/apple-pay/config', rentPaymentController.getApplePayConfig);
router.get('/dashboard', rentPaymentController.getTenantDashboard);
router.get('/', rentPaymentController.listTenantPayments);
router.get('/notifications', rentPaymentController.listNotifications);
router.patch('/notifications/:notificationId/read', rentPaymentController.markNotificationRead);
router.post('/device-token', apiLimiter, rentPaymentController.registerDeviceToken);
router.get('/auto-pay', rentPaymentController.getAutoPay);
router.post('/auto-pay/setup', apiLimiter, rentPaymentController.setupAutoPay);
router.post('/auto-pay/confirm', apiLimiter, rentPaymentController.confirmAutoPaySetup);
router.patch('/auto-pay', apiLimiter, rentPaymentController.updateAutoPay);
router.get('/:paymentId', rentPaymentController.getTenantPaymentById);
router.post('/:paymentId/pay/apple-pay', apiLimiter, rentPaymentController.createApplePayPayment);
router.post('/:paymentId/pay-mock', apiLimiter, rentPaymentController.mockPaymentSuccess);
router.post('/:paymentId/pay', apiLimiter, rentPaymentController.createPaymentIntent);

export default router;
