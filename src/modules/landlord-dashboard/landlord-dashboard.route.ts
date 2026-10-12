/**
 * Landlord Dashboard Routes
 */

import { Router } from 'express';
import * as landlordDashboardController from './landlord-dashboard.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware, authorize('landlord'));

router.get('/portfolio-overview', landlordDashboardController.getPortfolioOverview);

export default router;
