import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as userController from './user.controller';
import validate from '../../middlewares/validate';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { uploadAvatar } from '../../middlewares/upload.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';
import { changePasswordSchema, listUsersSchema } from './user.validation';

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, statusCode: 429, message: 'Too many requests, please try again later' },
});

const router = Router();

router.use(authMiddleware);

/** Profile routes — any authenticated user */
router.get('/me', readLimiter, userController.getProfile);
router.patch('/me', apiLimiter, uploadAvatar.single('profilePhoto'), userController.updateProfile);
router.patch('/me/settings', apiLimiter, userController.updateSettings);
router.patch('/me/notifications', apiLimiter, userController.updateNotificationPreferences);
router.delete('/me/avatar', apiLimiter, userController.removeAvatar);
router.patch('/me/password', apiLimiter, validate(changePasswordSchema), userController.changePassword);
router.delete('/me/data', apiLimiter, userController.deleteMyData);
router.delete('/me/profile', apiLimiter, userController.deactivateProfile);

/** Admin-only routes */
router.get('/', authorize('admin'), readLimiter, validate(listUsersSchema, 'query'), userController.listUsers);
router.get('/:id', authorize('admin'), readLimiter, userController.getUserById);
router.delete('/:id', authorize('admin'), apiLimiter, userController.deleteUser);

export default router;
