/**
 * Property Routes
 * All routes are landlord-only (protected)
 *
 * POST   /api/v1/properties              → Create property (multipart/form-data)
 * GET    /api/v1/properties              → List my properties
 * GET    /api/v1/properties/summary      → Summary list (for tenant invite dropdown)
 * GET    /api/v1/properties/:id/current-tenants → Current tenants for a property
 * PATCH  /api/v1/properties/:id          → Update property (multipart/form-data)
 * DELETE /api/v1/properties/:id          → Soft-delete property
 * POST   /api/v1/properties/:id/units    → Add unit
 * DELETE /api/v1/properties/:id/units/:unitId → Delete unit
 * POST   /api/v1/properties/:propertyId/expenses → Add expense
 * GET    /api/v1/properties/:propertyId/expenses → List expenses
 * GET    /api/v1/properties/:propertyId/expenses/report → Expense report
 */

import { Router } from 'express';
import * as propertyController from './property.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { uploadPropertyImage } from '../../middlewares/upload.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';
import expenseRoutes from '../expense/expense.route';

const router = Router();

// All property routes require authentication and landlord role
router.use(authMiddleware, authorize('landlord'));

// ── Property CRUD ──────────────────────────────────────────────────────────────
router.post(
  '/',
  apiLimiter,
  uploadPropertyImage.single('propertyImage'),
  propertyController.createProperty
);

router.get('/', propertyController.getMyProperties);

// Summary for tenant invite dropdown (must be before /:id)
router.get('/summary', propertyController.getPropertySummary);

router.get('/:id/current-tenants', propertyController.getCurrentTenants);

router.get('/:id', propertyController.getPropertyById);

router.patch(
  '/:id',
  apiLimiter,
  uploadPropertyImage.single('propertyImage'),
  propertyController.updateProperty
);

router.delete('/:id', apiLimiter, propertyController.deleteProperty);

// ── Unit Management ────────────────────────────────────────────────────────────
router.post('/:id/units', apiLimiter, propertyController.addUnit);
router.delete('/:propertyId/units/:unitId', apiLimiter, propertyController.deleteUnit);

// ── Property Expenses ──────────────────────────────────────────────────────────
router.use('/:propertyId/expenses', expenseRoutes);

export default router;
