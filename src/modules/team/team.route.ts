/**
 * Team & Permissions Routes — /api/v1/team/*
 */

import { Router } from 'express';
import * as teamController from './team.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';

const router = Router();

router.post('/members/accept-invite', apiLimiter, teamController.acceptInvite);

router.use(authMiddleware, authorize('landlord'));

router.get('/permissions', requirePermission('admin_team'), teamController.listPermissions);

router.get('/roles', requirePermission('admin_team'), teamController.listRoles);
router.post('/roles', apiLimiter, requirePermission('admin_team'), teamController.createRole);
router.patch('/roles/:id', apiLimiter, requirePermission('admin_team'), teamController.updateRole);
router.delete('/roles/:id', apiLimiter, requirePermission('admin_team'), teamController.deleteRole);

router.get('/members', requirePermission('admin_team'), teamController.listMembers);
router.post('/members/invite', apiLimiter, requirePermission('admin_team'), teamController.inviteMember);
router.patch('/members/:id/role', apiLimiter, requirePermission('admin_team'), teamController.updateMemberRole);
router.delete('/members/:id', apiLimiter, requirePermission('admin_team'), teamController.removeMember);

router.get(
  '/projects/:projectId/members',
  requirePermission('proj_view'),
  teamController.listProjectMembers
);
router.post(
  '/projects/:projectId/members',
  apiLimiter,
  requirePermission('proj_edit'),
  teamController.assignProjectMember
);
router.delete(
  '/projects/:projectId/members/:memberId',
  apiLimiter,
  requirePermission('proj_edit'),
  teamController.removeProjectMember
);

export default router;
