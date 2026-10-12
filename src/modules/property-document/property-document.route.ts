/**
 * Property Document Routes
 * Mounted at /api/v1/properties/:propertyId/documents
 */

import { Router } from 'express';
import * as documentController from './property-document.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { uploadPropertyDocument } from '../../middlewares/upload.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';

const router = Router({ mergeParams: true });

router.post(
  '/',
  authMiddleware,
  authorize('landlord'),
  apiLimiter,
  uploadPropertyDocument.single('document'),
  documentController.uploadDocument
);

router.get(
  '/',
  authMiddleware,
  authorize('landlord', 'tenant'),
  documentController.listDocuments
);

router.get(
  '/:documentId',
  authMiddleware,
  authorize('landlord', 'tenant'),
  documentController.getDocumentById
);

router.delete(
  '/:documentId',
  authMiddleware,
  authorize('landlord'),
  documentController.deleteDocument
);

export default router;
