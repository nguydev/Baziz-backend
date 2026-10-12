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
 * POST   /api/v1/properties/:propertyId/contacts → Add property contact
 * GET    /api/v1/properties/:propertyId/contacts → List property contacts
 */

import { Router } from 'express';
import * as propertyController from './property.controller';
import { getPropertiesMine } from '../marketplace/marketplace.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { uploadPropertyImage } from '../../middlewares/upload.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';
import expenseRoutes from '../expense/expense.route';
import propertyContactRoutes from '../property-contact/property-contact.route';

const router = Router();

// All property routes require authentication and landlord role
router.use(authMiddleware, authorize('landlord'));

// ── Property CRUD ──────────────────────────────────────────────────────────────
router.post(
  '/',
  apiLimiter,
  requirePermission('prop_create'),
  uploadPropertyImage.single('propertyImage'),
  propertyController.createProperty
);

router.get('/', requirePermission('prop_view'), propertyController.getMyProperties);

// Marketplace portfolio dropdown (must be before /:id)
router.get('/mine', requirePermission('prop_view'), getPropertiesMine);

// Summary for tenant invite dropdown (must be before /:id)
router.get('/summary', requirePermission('prop_view'), propertyController.getPropertySummary);

router.get('/:id/current-tenants', requirePermission('tenant_view'), propertyController.getCurrentTenants);

router.get('/:id', requirePermission('prop_view'), propertyController.getPropertyById);

router.patch(
  '/:id',
  apiLimiter,
  requirePermission('prop_edit'),
  uploadPropertyImage.single('propertyImage'),
  propertyController.updateProperty
);

router.delete('/:id', apiLimiter, requirePermission('prop_delete'), propertyController.deleteProperty);

// ── Unit Management ────────────────────────────────────────────────────────────
router.post('/:id/units', apiLimiter, requirePermission('prop_edit'), propertyController.addUnit);
router.delete('/:propertyId/units/:unitId', apiLimiter, requirePermission('prop_edit'), propertyController.deleteUnit);

// ── Property Expenses ──────────────────────────────────────────────────────────
router.use('/:propertyId/expenses', expenseRoutes);

// ── Property Contacts ──────────────────────────────────────────────────────────
router.use('/:propertyId/contacts', propertyContactRoutes);

export default router;
