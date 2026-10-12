import { Router } from 'express';
import * as projectController from './project.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import validate from '../../middlewares/validate';
import { createProjectSchema, updateProjectSchema } from './project.validation';

const router = Router();

/**
 * Protected routes
 */
router.use(authMiddleware);

// Create project
router.post('/', validate(createProjectSchema), projectController.createProject);

// List projects
router.get('/', projectController.listProjects);

// Get project statistics
router.get('/stats/overview', projectController.getProjectStats);

// Get projects by status
router.get('/status/:status', projectController.getProjectsByStatus);

// Get project by ID
router.get('/:projectId', projectController.getProject);

// Update project
router.patch('/:projectId', validate(updateProjectSchema), projectController.updateProject);

// Delete project
router.delete('/:projectId', projectController.deleteProject);

export default router;