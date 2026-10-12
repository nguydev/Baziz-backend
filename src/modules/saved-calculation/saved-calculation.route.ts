import { Router } from 'express';
import * as calcController from './saved-calculation.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

// Public route for shared calculations
router.get('/shared/:token', calcController.getSharedCalculation);

// Protected routes
router.use(authMiddleware);

router.post('/', calcController.saveCalculation);
router.get('/', calcController.getSavedCalculations);
router.patch('/:id', calcController.updateCalculation);
router.delete('/:id', calcController.deleteCalculation);

router.post('/:id/share', calcController.enableSharing);
router.delete('/:id/share', calcController.disableSharing);

export default router;
