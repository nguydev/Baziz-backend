import { Router } from 'express';
import * as sdController from './stamp-duty.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';

const router = Router();

// Publicly readable rates for the calculators
router.get('/rates/active', sdController.getActiveRates);

// Protected routes (Admin / Edge functions)
router.use(authMiddleware);

// Ideally restrict to 'admin', assuming such a role exists or edge auth token
router.post('/rates', sdController.createProposal);
router.get('/rates', sdController.getAllRateSets);
router.patch('/rates/:id/approve', sdController.approveProposal);
router.patch('/rates/:id/revert', sdController.revertActiveRate);

export default router;
