/**
 * Message Service — send, history, edit, delete, read receipts
 */

import mongoose from 'mongoose';
import Message from './message.model';
import Conversation from './conversation.model';
import ApiError from '../../utils/ApiError';
import {
  ensureParticipant,
  formatMessage,
  getMessagePreviewText,
  isMessageVisibleToUser,
  isWithinEditWindow,
  refreshLastMessageIfStale,
  sanitizeMessageText,
} from './chat.helpers';
import { emitChatEvent } from './chat.socket';
import { sendChatPushNotification } from './chat-notification.service';
import type {
  AuthUser,
  EditMessageInput,
  ListMessagesQuery,
  ListMessagesResult,
  MarkReadInput,
  MediaConfirmInput,
  SendMessageInput,
} from './chat.types';

const incrementUnreadCounts = async (
  conversationId: mongoose.Types.ObjectId,
  senderId: string
): Promise<string[]> => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return [];

  const recipientIds: string[] = [];

  for (const participant of conversation.participants) {
    if (participant.leftAt || participant.archivedAt) continue;
    if (participant.userId.toString() === senderId) continue;

    participant.unreadCount += 1;
    recipientIds.push(participant.userId.toString());
  }

  conversation.markModified('participants');
  await conversation.save();

  return recipientIds;
};

const updateLastMessage = async (
  conversationId: mongoose.Types.ObjectId,
  message: InstanceType<typeof Message>
): Promise<void> => {
  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: {
      messageId: message._id,
      text: getMessagePreviewText(message.type, message.content.text),
      senderId: message.senderId,
      type: message.type,
      sentAt: message.sentAt,
    },
    updatedAt: new Date(),
  });
};

/** After delete-for-everyone, point conversation preview at the previous visible message. */
const recomputeLastMessage = async (
  conversationId: mongoose.Types.ObjectId
): Promise<void> => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return;
  await refreshLastMessageIfStale(conversation);
};

export const getMessages = async (
  conversationId: string,
  user: AuthUser,
  query: ListMessagesQuery
): Promise<ListMessagesResult> => {
  await ensureParticipant(conversationId, user._id.toString());

  const limit = Math.min(100, Math.max(1, query.limit ?? 30));
  const userId = user._id.toString();

  const filter: Record<string, unknown> = {
    conversationId,
    deletedFor: { $ne: user._id },
    $or: [
      { deletedAt: null },
      { senderId: user._id },
    ],
  };

  if (query.cursor) {
    const cursorMessage = await Message.findById(query.cursor);
    if (cursorMessage) {
      filter.sentAt = { $lt: cursorMessage.sentAt };
    }
  }

  const messages = await Message.find(filter)
    .sort({ sentAt: -1 })
    .limit(limit + 1);

  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? page[page.length - 1]._id.toString() : null;

  const visible = page.filter((m) => isMessageVisibleToUser(m, userId));

  return {
    messages: visible.map(formatMessage).reverse(),
    nextCursor,
    hasMore,
  };
};

export const sendMessage = async (
  conversationId: string,
  user: AuthUser,
  input: SendMessageInput
) => {
  const conversation = await ensureParticipant(conversationId, user._id.toString());
  const senderId = user._id.toString();

  if (input.type === 'text' && !input.content.text?.trim()) {
    throw ApiError.badRequest('Text messages require content.text');
  }

  if (input.type !== 'text' && !input.content.media) {
    throw ApiError.badRequest('Media messages require content.media');
  }

  const existing = await Message.findOne({
    senderId: user._id,
    clientMessageId: input.clientMessageId,
  });

  if (existing) {
    return formatMessage(existing);
  }

  const text = input.content.text
    ? sanitizeMessageText(input.content.text)
    : input.content.text;

  const message = await Message.create({
    conversationId,
    senderId: user._id,
    clientMessageId: input.clientMessageId,
    type: input.type,
    content: {
      text,
      media: input.content.media ?? null,
    },
    status: 'sent',
    sentAt: new Date(),
  });

  await updateLastMessage(conversation._id, message);
  const recipientIds = await incrementUnreadCounts(conversation._id, senderId);

  const formatted = formatMessage(message);
  const formattedConversation = await import('./chat.helpers').then((h) =>
    h.formatConversation(conversation, senderId)
  );

  emitChatEvent('message:new', {
    message: formatted,
    conversationId,
  }, `conversation:${conversationId}`);

  for (const recipientId of recipientIds) {
    emitChatEvent('conversation:updated', { conversation: formattedConversation }, `user:${recipientId}`);
    void sendChatPushNotification({
      recipientId,
      senderName: user.firstName,
      conversationId,
      messageId: message._id.toString(),
      previewText: getMessagePreviewText(message.type, message.content.text),
      messageType: message.type,
      mutedUntil: conversation.participants.find(
        (p) => p.userId.toString() === recipientId
      )?.mutedUntil,
    });
  }

  emitChatEvent('conversation:updated', { conversation: formattedConversation }, `user:${senderId}`);

  return formatted;
};

export const confirmMediaMessage = async (
  user: AuthUser,
  input: MediaConfirmInput
) => {
  return sendMessage(input.conversationId, user, {
    clientMessageId: input.clientMessageId,
    type: input.type,
    content: {
      text: input.caption ? sanitizeMessageText(input.caption) : undefined,
      media: {
        url: input.url,
        mimeType: input.mimeType,
        fileName: input.fileName,
        sizeBytes: input.sizeBytes,
        durationSec: input.durationSec,
        thumbnailUrl: input.thumbnailUrl,
        storagePath: input.storagePath,
      },
    },
  });
};

export const editMessage = async (
  messageId: string,
  user: AuthUser,
  input: EditMessageInput
) => {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');

  if (message.senderId.toString() !== user._id.toString()) {
    throw ApiError.forbidden('You can only edit your own messages');
  }

  if (message.type !== 'text') {
    throw ApiError.badRequest('Only text messages can be edited');
  }

  if (!isWithinEditWindow(message)) {
    throw ApiError.badRequest('Edit window has expired (15 minutes)');
  }

  message.content.text = sanitizeMessageText(input.text);
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  const formatted = formatMessage(message);

  emitChatEvent('message:updated', { message: formatted }, `conversation:${message.conversationId}`);

  return formatted;
};

export const deleteMessage = async (
  messageId: string,
  user: AuthUser,
  scope: 'me' | 'everyone'
) => {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');

  await ensureParticipant(message.conversationId.toString(), user._id.toString());

  if (scope === 'everyone') {
    if (message.senderId.toString() !== user._id.toString()) {
      throw ApiError.forbidden('You can only delete your own messages for everyone');
    }
    message.deletedAt = new Date();
    message.content.text = null;
    message.content.media = null;
  } else {
    if (!message.deletedFor.some((id) => id.toString() === user._id.toString())) {
      message.deletedFor.push(user._id);
    }
  }

  await message.save();

  if (scope === 'everyone') {
    const conversation = await Conversation.findById(message.conversationId);
    if (conversation?.lastMessage?.messageId?.toString() === messageId) {
      await recomputeLastMessage(message.conversationId);

      const updatedConversation = await Conversation.findById(message.conversationId);
      if (updatedConversation) {
        const { formatConversation } = await import('./chat.helpers');
        for (const participant of updatedConversation.participants) {
          if (participant.leftAt) continue;
          const formatted = await formatConversation(
            updatedConversation,
            participant.userId.toString()
          );
          emitChatEvent(
            'conversation:updated',
            { conversation: formatted },
            `user:${participant.userId.toString()}`
          );
        }
      }
    }
  }

  emitChatEvent(
    'message:deleted',
    { messageId, scope, conversationId: message.conversationId.toString() },
    `conversation:${message.conversationId}`
  );

  return { deleted: true, scope };
};

export const markAsRead = async (
  conversationId: string,
  user: AuthUser,
  input: MarkReadInput
) => {
  const conversation = await ensureParticipant(conversationId, user._id.toString());
  const userId = user._id.toString();

  const readMessage = await Message.findById(input.lastReadMessageId);
  if (!readMessage || readMessage.conversationId.toString() !== conversationId) {
    throw ApiError.badRequest('Invalid lastReadMessageId for this conversation');
  }

  const participant = conversation.participants.find(
    (p) => p.userId.toString() === userId
  );
  if (!participant) throw ApiError.forbidden('Not a participant');

  participant.lastReadMessageId = readMessage._id;
  participant.unreadCount = 0;
  conversation.markModified('participants');
  await conversation.save();

  const readAt = new Date();

  if (conversation.type === 'direct') {
    await Message.updateMany(
      {
        conversationId,
        senderId: { $ne: user._id },
        sentAt: { $lte: readMessage.sentAt },
        status: { $ne: 'read' },
      },
      { $set: { status: 'read' } }
    );
  } else {
    await Message.updateOne(
      { _id: readMessage._id },
      {
        $addToSet: {
          readBy: { userId: user._id, readAt },
        },
      }
    );
  }

  emitChatEvent(
    'message:read',
    {
      conversationId,
      userId,
      lastReadMessageId: input.lastReadMessageId,
      readAt: readAt.toISOString(),
    },
    `conversation:${conversationId}`
  );

  const formattedConversation = await import('./chat.helpers').then((h) =>
    h.formatConversation(conversation, userId)
  );

  emitChatEvent('conversation:updated', { conversation: formattedConversation }, `user:${userId}`);

  return { read: true, unreadCount: 0 };
};

export const addReaction = async (
  messageId: string,
  user: AuthUser,
  type: string
) => {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');

  await ensureParticipant(message.conversationId.toString(), user._id.toString());

  const existingIndex = message.reactions.findIndex(
    (r) => r.userId.toString() === user._id.toString()
  );

  if (existingIndex > -1) {
    message.reactions[existingIndex].type = type;
  } else {
    message.reactions.push({
      userId: user._id,
      type,
    });
  }

  await message.save();

  const formatted = formatMessage(message);

  emitChatEvent(
    'message:updated',
    { message: formatted },
    `conversation:${message.conversationId}`
  );

  return formatted;
};

export const removeReaction = async (
  messageId: string,
  user: AuthUser
) => {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');

  await ensureParticipant(message.conversationId.toString(), user._id.toString());

  message.reactions = message.reactions.filter(
    (r) => r.userId.toString() !== user._id.toString()
  );

  await message.save();

  const formatted = formatMessage(message);

  emitChatEvent(
    'message:updated',
    { message: formatted },
    `conversation:${message.conversationId}`
  );

  return formatted;
};
