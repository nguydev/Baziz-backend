/**
 * Task Routes — Landlord Only
 *
 * POST   /api/v1/tasks                  → Create task
 * GET    /api/v1/tasks                  → Get all tasks (filter: status, priority, propertyId)
 * GET    /api/v1/tasks/stats            → Dashboard stats
 * GET    /api/v1/tasks/:id              → Get single task
 * PATCH  /api/v1/tasks/:id              → Update task
 * PATCH  /api/v1/tasks/:id/complete     → Mark as completed
 * DELETE /api/v1/tasks/:id              → Soft-delete task
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as taskController from './task.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests, please try again later',
  },
});

const router = Router();

// Authenticate all routes
router.use(authMiddleware);

// Read operations: Accessible by both landlord and tenant
router.get('/stats', authorize('landlord'), readLimiter, taskController.getTaskStats);
router.get('/search', readLimiter, taskController.searchTasks);
router.get('/ai-suggestions', authorize('landlord'), readLimiter, taskController.getAITaskSuggestions);
router.get('/', readLimiter, taskController.getTasks);
router.get('/:id', readLimiter, taskController.getTaskById);

// Write/Modify operations: Restricted to landlords only
router.post('/', authorize('landlord'), apiLimiter, taskController.createTask);
router.patch('/:id', authorize('landlord'), apiLimiter, taskController.updateTask);
router.patch('/:id/complete', authorize('landlord'), apiLimiter, taskController.completeTask);
router.delete('/:id', authorize('landlord'), apiLimiter, taskController.deleteTask);

export default router;
