/**
 * Marketplace Routes
 *
 * GET    /marketplace/listings                    → Browse property listings
 * GET    /marketplace/listings/:id                → Listing detail
 * POST   /marketplace/listings/portfolio          → Tab 0: Portfolio listing
 * POST   /marketplace/listings/new-property       → Tab 1: New property listing
 * PATCH  /marketplace/listings/:id                → Edit listing
 * DELETE /marketplace/listings/:id                → Soft delete listing
 * POST   /marketplace/listings/:id/inquiry        → Express interest
 *
 * GET    /marketplace/joint-ventures              → Browse JV projects
 * POST   /marketplace/joint-ventures              → Tab 2: Create JV
 * PATCH  /marketplace/joint-ventures/:id          → Edit JV
 * DELETE /marketplace/joint-ventures/:id          → Soft delete JV
 *
 * POST   /marketplace/media/upload-url            → Firebase signed upload URL
 * POST   /marketplace/valuations/estimate         → Automated valuation
 * POST   /marketplace/saved/:id?type=listing|joint_venture → Bookmark toggle
 */

import { Router } from 'express';
import * as marketplaceController from './marketplace.controller';
import { authMiddleware, authorize, optionalAuth } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';
import { uploadMarketplaceImage } from '../../middlewares/upload.middleware';

const router = Router();

router.get('/listings', optionalAuth, marketplaceController.browseListings);
router.get('/joint-ventures', optionalAuth, marketplaceController.browseJointVentures);
router.get('/listings/:id', marketplaceController.getListingById);

router.use(authMiddleware);

router.post('/media/upload-url', apiLimiter, marketplaceController.createMediaUploadUrl);
router.post('/valuations/estimate', apiLimiter, authorize('landlord'), marketplaceController.estimateValuation);
router.post('/saved/:id', marketplaceController.toggleSavedItem);
router.post('/listings/:id/inquiry', apiLimiter, marketplaceController.createListingInquiry);

router.use(authorize('landlord'));

router.post(
  '/listings/portfolio',
  apiLimiter,
  requirePermission('mkt_manage'),
  uploadMarketplaceImage.single('image'),
  marketplaceController.createPortfolioListing
);
router.post(
  '/listings/new-property',
  apiLimiter,
  requirePermission('mkt_manage'),
  uploadMarketplaceImage.single('image'),
  marketplaceController.createNewPropertyListing
);
router.post(
  '/joint-ventures',
  apiLimiter,
  requirePermission('mkt_manage'),
  uploadMarketplaceImage.single('image'),
  marketplaceController.createJointVenture
);
router.patch(
  '/listings/:id',
  apiLimiter,
  requirePermission('mkt_manage'),
  uploadMarketplaceImage.single('image'),
  marketplaceController.updateListing
);
router.delete('/listings/:id', apiLimiter, requirePermission('mkt_manage'), marketplaceController.deleteListing);
router.patch(
  '/joint-ventures/:id',
  apiLimiter,
  requirePermission('mkt_manage'),
  uploadMarketplaceImage.single('image'),
  marketplaceController.updateJointVenture
);
router.delete('/joint-ventures/:id', apiLimiter, requirePermission('mkt_manage'), marketplaceController.deleteJointVenture);

export default router;
