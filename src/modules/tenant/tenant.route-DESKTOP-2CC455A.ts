/**
 * Tenant Routes
 * Defines all tenant management endpoints
 */

import { Router } from 'express';
import * as tenantController from './tenant.controller';
import * as propertyDocumentController from '../property-document/property-document.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';

const router = Router();

/**
 * Public routes (authentication not required for signup)
 */

// Accept lease invitation and create tenant account
router.post('/accept-invitation/:leaseId', apiLimiter, tenantController.acceptLeaseInvitation);

/**
 * Protected routes (authentication required)
 */

// Invite tenant (landlord only)
router.post('/invite', authMiddleware, apiLimiter, tenantController.inviteTenant);

// Get tenant's own lease details
router.get('/my-lease', authMiddleware, tenantController.getMyLease);

// Get documents for tenant's leased property
router.get(
  '/my-property/documents',
  authMiddleware,
  authorize('tenant'),
  propertyDocumentController.listMyPropertyDocuments
);

// Get all tenants for landlord
router.get('/my-tenants', authMiddleware, tenantController.getMyTenants);

// Resend invitation
router.post('/:leaseId/resend-invitation', authMiddleware, apiLimiter, tenantController.resendInvitation);

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

export default router;
