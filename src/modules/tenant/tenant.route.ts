/**
 * Tenant Routes
 * Defines all tenant management endpoints
 */

import { Router } from 'express';
import * as tenantController from './tenant.controller';
import * as propertyDocumentController from '../property-document/property-document.controller';
import tenantRentPaymentRoutes from '../rent-payment/tenant-rent-payment.route';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';

const router = Router();

/**
 * Public routes (authentication not required for signup)
 */

// Accept lease invitation and create tenant account
router.post('/accept-invitation/:leaseId', apiLimiter, tenantController.acceptLeaseInvitation);

// Get public lease preview for tenant signup page
router.get('/lease-preview/:leaseId', apiLimiter, tenantController.getLeasePreview);

/**
 * Protected routes (authentication required)
 */

// Invite tenant (landlord only)
router.post(
  '/invite',
  authMiddleware,
  authorize('landlord'),
  apiLimiter,
  requirePermission('tenant_invite'),
  tenantController.inviteTenant
);

// Get tenant's own lease details
router.get('/my-lease', authMiddleware, tenantController.getMyLease);

// Get documents for tenant's leased property
router.get(
  '/my-property/documents',
  authMiddleware,
  authorize('tenant'),
  propertyDocumentController.listMyPropertyDocuments
);

// Rent payments (tenant)
router.use('/rent-payments', tenantRentPaymentRoutes);

// Get all tenants for landlord
router.get(
  '/my-tenants',
  authMiddleware,
  authorize('landlord'),
  requirePermission('tenant_view'),
  tenantController.getMyTenants
);

// Update tenant details (landlord only)
router.put(
  '/:leaseId',
  authMiddleware,
  authorize('landlord'),
  requirePermission('tenant_invite'),
  tenantController.updateTenantLease
);

// Delete tenant (landlord only)
router.delete(
  '/:leaseId',
  authMiddleware,
  authorize('landlord'),
  requirePermission('tenant_invite'),
  tenantController.deleteTenantLease
);

// Resend invitation
router.post(
  '/:leaseId/resend-invitation',
  authMiddleware,
  authorize('landlord'),
  apiLimiter,
  requirePermission('tenant_invite'),
  tenantController.resendInvitation
);

/**
 * Property and Unit routes
 */

// Get unit details with parking
router.get('/properties/:propertyId/units/:unitId', authMiddleware, tenantController.getUnitDetails);

// Update parking bays
router.put(
  '/properties/:propertyId/units/:unitId/parking',
  authMiddleware,
  tenantController.updateParkingBays
);

// Allocate parking bay
router.post(
  '/properties/:propertyId/units/:unitId/parking/allocate',
  authMiddleware,
  authorize('landlord'),
  tenantController.allocateParkingBay
);

// Release parking bay
router.post(
  '/properties/:propertyId/units/:unitId/parking/release',
  authMiddleware,
  authorize('landlord'),
  tenantController.releaseParkingBay
);

export default router;
