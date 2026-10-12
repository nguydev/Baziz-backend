import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as contactController from './contact.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests, please try again later',
  },
});

const router = Router();

router.use(authMiddleware, authorize('landlord'));

router.get('/stats', readLimiter, contactController.getContactStats);

router.post('/', apiLimiter, contactController.createContact);
router.get('/', readLimiter, contactController.getContacts);
router.get('/:id', readLimiter, contactController.getContactById);
router.patch('/:id', apiLimiter, contactController.updateContact);
router.delete('/:id', apiLimiter, contactController.deleteContact);

export default router;
