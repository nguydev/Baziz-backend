import { Router } from "express";
import * as controller from "./ownership-entity.controller";
import { ownershipEntityValidation } from "./ownership-entity.validation";
import validate from "../../middlewares/validate";
import { authMiddleware, authorize } from "../../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware, authorize("landlord"));

router
  .route("/")
  .post(validate(ownershipEntityValidation.create.body), controller.createOwnershipEntity)
  .get(controller.getOwnershipEntities);

router
  .route("/:id")
  .get(controller.getOwnershipEntityById)
  .patch(validate(ownershipEntityValidation.update.body), controller.updateOwnershipEntity)
  .delete(controller.deleteOwnershipEntity);

export default router;
