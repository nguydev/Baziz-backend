/**
 * Chat Routes — /api/v1/chat/*
 */

import { Router } from 'express';
import * as chatController from './chat.controller';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';
import rateLimit from 'express-rate-limit';

const router = Router();

const chatMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages. Please slow down.' },
});

const chatUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many upload requests. Please slow down.' },
});

router.use(authMiddleware);
router.use(apiLimiter);

// Conversations (ChatListPage)
router.get('/conversations', requirePermission('msg_view'), chatController.listConversations);

router.post(
  '/conversations/direct',
  authorize('landlord', 'tenant'),
  chatController.createDirectConversation
);

router.post(
  '/conversations/group',
  authorize('landlord'),
  chatController.createGroupConversation
);

router.post(
  '/conversations/support',
  authorize('landlord', 'tenant', 'support_agent'),
  chatController.createSupportConversation
);

router.get(
  '/tenant/default-conversation',
  authorize('tenant'),
  chatController.getTenantDefaultConversation
);

router.get('/conversations/:id', chatController.getConversation);

router.patch('/conversations/:id', chatController.updateConversation);

router.delete('/conversations/:id', chatController.archiveConversation);

router.post(
  '/conversations/:id/members',
  authorize('landlord'),
  chatController.manageMembers
);

// Messages (ChatDetailsPage)
router.get('/conversations/:id/messages', chatController.listMessages);

router.post(
  '/conversations/:id/messages',
  chatMessageLimiter,
  requirePermission('msg_send'),
  chatController.sendMessage
);

router.post('/conversations/:id/read', chatController.markAsRead);

router.patch('/messages/:messageId', chatController.editMessage);

router.delete('/messages/:messageId', chatController.deleteMessage);

router.post('/messages/:messageId/reactions', chatController.addReaction);
router.delete('/messages/:messageId/reactions', chatController.removeReaction);

// Media
router.post(
  '/media/upload-url',
  chatUploadLimiter,
  chatController.createUploadUrl
);

router.post(
  '/media/confirm',
  chatUploadLimiter,
  chatController.confirmMediaUpload
);

export default router;
