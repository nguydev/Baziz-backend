/**
 * Chat Controller — HTTP handlers for chat REST API
 */

import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import * as conversationService from './conversation.service';
import * as messageService from './message.service';
import * as mediaService from './media.service';
import {
  listConversationsSchema,
  createDirectConversationSchema,
  createGroupConversationSchema,
  createSupportConversationSchema,
  updateConversationSchema,
  manageMembersSchema,
  listMessagesSchema,
  sendMessageSchema,
  editMessageSchema,
  markReadSchema,
  mediaUploadUrlSchema,
  mediaConfirmSchema,
  deleteMessageQuerySchema,
  reactionSchema,
} from './chat.validation';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import type {
  AuthUser,
  CreateDirectConversationInput,
  CreateGroupConversationInput,
  CreateSupportConversationInput,
  EditMessageInput,
  ListConversationsQuery,
  ListMessagesQuery,
  ManageMembersInput,
  MarkReadInput,
  MediaConfirmInput,
  MediaUploadUrlInput,
  SendMessageInput,
  UpdateConversationInput,
} from './chat.types';

const validateBody = <T>(schema: Joi.Schema, body: unknown): T => {
  const { error, value } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw ApiError.badRequest('Validation failed', error.details.map((d) => d.message));
  }
  return value as T;
};

const validateQuery = <T>(schema: Joi.Schema, query: unknown): T => {
  const { error, value } = schema.validate(query, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw ApiError.badRequest('Validation failed', error.details.map((d) => d.message));
  }
  return value as T;
};

const getAuthUser = (req: Request): AuthUser => {
  if (!req.user) throw ApiError.unauthorized('User not authenticated');
  return req.user as AuthUser;
};

export const listConversations = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const query = validateQuery<ListConversationsQuery>(listConversationsSchema, req.query);
    const result = await conversationService.listConversations(user, query);
    res.json(ApiResponse.ok('Conversations retrieved', result));
  }
);

export const createDirectConversation = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const input = validateBody<CreateDirectConversationInput>(createDirectConversationSchema, req.body);
    const conversation = await conversationService.getOrCreateDirectConversation(user, input);
    res.status(201).json(ApiResponse.created('Conversation ready', { conversation }));
  }
);

export const createGroupConversation = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const input = validateBody<CreateGroupConversationInput>(createGroupConversationSchema, req.body);
    const conversation = await conversationService.createGroupConversation(user, input);
    res.status(201).json(ApiResponse.created('Group created', { conversation }));
  }
);

export const createSupportConversation = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const input = validateBody<CreateSupportConversationInput>(createSupportConversationSchema, req.body);
    const conversation = await conversationService.createSupportConversation(user, input);
    res.status(201).json(ApiResponse.created('Support conversation ready', { conversation }));
  }
);

export const getTenantDefaultConversation = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const conversation = await conversationService.getTenantDefaultConversation(user);
    res.json(ApiResponse.ok('Default conversation retrieved', { conversation }));
  }
);

export const getConversation = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const conversation = await conversationService.getConversationById(req.params.id, user);
    res.json(ApiResponse.ok('Conversation retrieved', { conversation }));
  }
);

export const updateConversation = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const input = validateBody<UpdateConversationInput>(updateConversationSchema, req.body);
    const conversation = await conversationService.updateConversation(req.params.id, user, input);
    res.json(ApiResponse.ok('Conversation updated', { conversation }));
  }
);

export const archiveConversation = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const result = await conversationService.archiveConversation(req.params.id, user);
    res.json(ApiResponse.ok('Conversation archived', result));
  }
);

export const manageMembers = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const input = validateBody<ManageMembersInput>(manageMembersSchema, req.body);
    const conversation = await conversationService.manageMembers(req.params.id, user, input);
    res.json(ApiResponse.ok('Members updated', { conversation }));
  }
);

export const listMessages = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const query = validateQuery<ListMessagesQuery>(listMessagesSchema, req.query);
    const result = await messageService.getMessages(req.params.id, user, query);
    res.json(ApiResponse.ok('Messages retrieved', result));
  }
);

export const sendMessage = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const input = validateBody<SendMessageInput>(sendMessageSchema, req.body);
    const message = await messageService.sendMessage(req.params.id, user, input);
    res.status(201).json(ApiResponse.created('Message sent', { message }));
  }
);

export const editMessage = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const input = validateBody<EditMessageInput>(editMessageSchema, req.body);
    const message = await messageService.editMessage(req.params.messageId, user, input);
    res.json(ApiResponse.ok('Message updated', { message }));
  }
);

export const deleteMessage = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { scope } = validateQuery<{ scope: 'me' | 'everyone' }>(deleteMessageQuerySchema, req.query);
    const result = await messageService.deleteMessage(req.params.messageId, user, scope);
    res.json(ApiResponse.ok('Message deleted', result));
  }
);

export const markAsRead = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const input = validateBody<MarkReadInput>(markReadSchema, req.body);
    const result = await messageService.markAsRead(req.params.id, user, input);
    res.json(ApiResponse.ok('Marked as read', result));
  }
);

export const createUploadUrl = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const input = validateBody<MediaUploadUrlInput>(mediaUploadUrlSchema, req.body);
    const result = await mediaService.createUploadUrl(user, input);
    res.json(ApiResponse.ok('Upload URL generated', result));
  }
);

export const confirmMediaUpload = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const input = validateBody<MediaConfirmInput>(mediaConfirmSchema, req.body);
    const message = await messageService.confirmMediaMessage(user, input);
    res.status(201).json(ApiResponse.created('Media message sent', { message }));
  }
);

export const addReaction = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { type } = validateBody<{ type: string }>(reactionSchema, req.body);
    const message = await messageService.addReaction(req.params.messageId, user, type);
    res.json(ApiResponse.ok('Reaction added', { message }));
  }
);

export const removeReaction = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const message = await messageService.removeReaction(req.params.messageId, user);
    res.json(ApiResponse.ok('Reaction removed', { message }));
  }
);
