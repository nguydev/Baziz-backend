import { Router } from "express";
import * as billController from "./monthly-bill.controller";
import { authMiddleware, authorize } from "../../middlewares/auth.middleware";

const router = Router();

// POST / — Tenant adds a bill (propertyId/unitId auto-resolved from active lease)
router.post("/", authMiddleware, authorize("tenant"), billController.addBill);

// PATCH /:billId — Tenant edits their own bill fields
router.patch(
  "/:billId",
  authMiddleware,
  authorize("tenant"),
  billController.updateBill,
);

// DELETE /:billId — Tenant soft-deletes their own bill
router.delete(
  "/:billId",
  authMiddleware,
  authorize("tenant"),
  billController.deleteBill,
);

// ─── Landlord Routes ──────────────────────────────────────────────────────────

// PATCH /:billId/status — Landlord updates payment status (paid/pending/overdue)
router.patch(
  "/:billId/status",
  authMiddleware,
  authorize("landlord"),
  billController.updateStatus,
);

// ─── Shared Routes (Tenant + Landlord) ───────────────────────────────────────

// GET / — List bills (tenant sees own, landlord sees theirs)
router.get(
  "/",
  authMiddleware,
  authorize("tenant", "landlord"),
  billController.listBills,
);

// GET /:billId — Get single bill
router.get(
  "/:billId",
  authMiddleware,
  authorize("tenant", "landlord"),
  billController.getBillById,
);

export default router;
