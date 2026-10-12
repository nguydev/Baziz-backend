import { Router } from "express";
import * as maintenanceController from "./maintenance-request.controller";
import { authMiddleware, authorize } from "../../middlewares/auth.middleware";
import { requirePermission } from "../../middlewares/permission.middleware";
import { uploadMaintenancePhotos } from "../../middlewares/upload.middleware";
import { apiLimiter } from "../../middlewares/rateLimiter";

const router = Router();

router.post(
  "/",
  authMiddleware,
  authorize("tenant", "landlord", "admin"),
  apiLimiter,
  uploadMaintenancePhotos.array("photos", 5),
  maintenanceController.submitRequest,
);

// DELETE /:requestId — Soft-delete own open request
router.delete(
  "/:requestId",
  authMiddleware,
  authorize("tenant"),
  maintenanceController.softDeleteRequest,
);

// ─── Landlord Routes ──────────────────────────────────────────────────────────

// PATCH /:requestId/status — Update request status
router.patch(
  "/:requestId/status",
  authMiddleware,
  authorize("landlord"),
  requirePermission("maint_manage"),
  maintenanceController.updateStatus,
);

// ─── Shared Routes (Tenant + Landlord) ───────────────────────────────────────

// GET / — List all requests (scoped by role)
router.get(
  "/",
  authMiddleware,
  authorize("tenant", "landlord"),
  maintenanceController.listRequests,
);

// GET /:requestId — Get single request with comments
router.get(
  "/:requestId",
  authMiddleware,
  authorize("tenant", "landlord"),
  maintenanceController.getRequestById,
);

// POST /:requestId/comments — Add a comment
router.post(
  "/:requestId/comments",
  authMiddleware,
  authorize("tenant", "landlord"),
  maintenanceController.addComment,
);

export default router;
