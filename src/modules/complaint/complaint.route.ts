/**
 * Complaint Routes
 * All routes under /api/v1/complaints
 */

import { Router } from 'express';
import * as complaintController from './complaint.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';

const router = Router();

// POST / — Submit a new complaint (Tenant)
router.post(
  '/',
  authMiddleware,
  authorize('tenant'),
  apiLimiter,
  complaintController.submitComplaint
);

// DELETE /:complaintId — Soft-delete own in-review complaint (Tenant)
router.delete(
  '/:complaintId',
  authMiddleware,
  authorize('tenant'),
  complaintController.softDeleteComplaint
);

// PATCH /:complaintId/status — Update complaint status (Landlord)
router.patch(
  '/:complaintId/status',
  authMiddleware,
  authorize('landlord'),
  complaintController.updateStatus
);

// GET / — List complaints (scoped by role)
router.get(
  '/',
  authMiddleware,
  authorize('tenant', 'landlord'),
  complaintController.listComplaints
);

// GET /:complaintId — Get single complaint
router.get(
  '/:complaintId',
  authMiddleware,
  authorize('tenant', 'landlord'),
  complaintController.getComplaintById
);

export default router;
