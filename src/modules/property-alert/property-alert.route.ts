import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as propertyAlertController from './property-alert.controller';

const router = Router();

// Protect all routes
router.use(authMiddleware);

// Configs
router.post('/configs', propertyAlertController.createConfig);
router.get('/configs', propertyAlertController.getConfigs);
router.patch('/configs/:id/toggle', propertyAlertController.toggleConfig);

// Notifications
router.post('/notifications/send-live', propertyAlertController.sendLiveNotification);
router.get('/notifications', propertyAlertController.getNotifications);
router.patch('/notifications/:id/read', propertyAlertController.markAsRead);
router.delete('/notifications/:id', propertyAlertController.deleteNotification);

export default router;
