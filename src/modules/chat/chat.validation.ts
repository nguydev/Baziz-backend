import Joi from 'joi';

const objectId = Joi.string().hex().length(24);

export const listConversationsSchema = Joi.object({
  category: Joi.string().valid('tenant', 'marketplace', 'group', 'all').default('all'),
  search: Joi.string().trim().max(100).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

export const createDirectConversationSchema = Joi.object({
  propertyId: objectId.required(),
  otherUserId: objectId.required(),
});

export const createGroupConversationSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  propertyId: objectId.required(),
  memberIds: Joi.array().items(objectId).min(1).max(50).required(),
});

export const createSupportConversationSchema = Joi.object({
  queue: Joi.string().valid('marketplace', 'general').required(),
});

export const updateConversationSchema = Joi.object({
  title: Joi.string().trim().min(1).max(100).optional(),
  mutedUntil: Joi.alternatives().try(Joi.date().iso(), Joi.valid(null)).optional(),
}).min(1);

export const manageMembersSchema = Joi.object({
  action: Joi.string().valid('add', 'remove').required(),
  memberIds: Joi.array().items(objectId).min(1).max(50).required(),
});

export const listMessagesSchema = Joi.object({
  cursor: objectId.optional(),
  limit: Joi.number().integer().min(1).max(100).default(30),
});

export const sendMessageSchema = Joi.object({
  clientMessageId: Joi.string().uuid().required(),
  type: Joi.string().valid('text', 'image', 'file', 'audio').required(),
  content: Joi.object({
    text: Joi.string().max(5000).allow('', null).optional(),
    media: Joi.object({
      url: Joi.string().uri().required(),
      mimeType: Joi.string().required(),
      fileName: Joi.string().required(),
      sizeBytes: Joi.number().integer().min(0).required(),
      durationSec: Joi.number().min(0).optional(),
      thumbnailUrl: Joi.string().uri().optional(),
      storagePath: Joi.string().required(),
    }).optional(),
  }).required(),
});

export const editMessageSchema = Joi.object({
  text: Joi.string().trim().min(1).max(5000).required(),
});

export const markReadSchema = Joi.object({
  lastReadMessageId: objectId.required(),
});

export const mediaUploadUrlSchema = Joi.object({
  conversationId: objectId.required(),
  fileName: Joi.string().trim().min(1).max(255).required(),
  mimeType: Joi.string().required(),
  sizeBytes: Joi.number().integer().min(1).required(),
});

export const mediaConfirmSchema = Joi.object({
  conversationId: objectId.required(),
  clientMessageId: Joi.string().uuid().required(),
  type: Joi.string().valid('image', 'file', 'audio').required(),
  storagePath: Joi.string().required(),
  url: Joi.string().uri().required(),
  mimeType: Joi.string().required(),
  fileName: Joi.string().required(),
  sizeBytes: Joi.number().integer().min(1).required(),
  durationSec: Joi.number().min(0).optional(),
  thumbnailUrl: Joi.string().uri().optional(),
  caption: Joi.string().max(5000).optional(),
});

export const deleteMessageQuerySchema = Joi.object({
  scope: Joi.string().valid('me', 'everyone').default('me'),
});

export const reactionSchema = Joi.object({
  type: Joi.string().valid('like', 'love', 'haha', 'wow', 'sad', 'angry').required(),
});
