/**
 * Chat helpers — authorization, formatting, message previews
 */

import mongoose from 'mongoose';
import Conversation, { type IConversationDocument, type IConversationParticipant } from './conversation.model';
import Message, { type IMessageDocument } from './message.model';
import User from '../user/user.model';
import ApiError from '../../utils/ApiError';
import type { FormattedConversation, FormattedMessage } from './chat.types';

const EDIT_WINDOW_MS = 15 * 60 * 1000;

export const sanitizeMessageText = (text: string): string =>
  text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();

export const getMessagePreviewText = (
  type: string,
  text?: string | null
): string => {
  if (type === 'image') return 'Photo';
  if (type === 'file') return 'Document';
  if (type === 'audio') return 'Audio';
  if (type === 'system') return text || 'System message';
  return (text || '').slice(0, 200);
};

/** Fix conversation preview when it still points at a deleted-for-everyone message. */
export const refreshLastMessageIfStale = async (
  conversation: IConversationDocument
): Promise<IConversationDocument> => {
  if (!conversation.lastMessage?.messageId) return conversation;

  const preview = await Message.findById(conversation.lastMessage.messageId).select(
    'deletedAt type content.text senderId sentAt'
  );
  if (!preview?.deletedAt) return conversation;

  const previous = await Message.findOne({
    conversationId: conversation._id,
    deletedAt: null,
  })
    .sort({ sentAt: -1 })
    .limit(1);

  if (!previous) {
    await Conversation.findByIdAndUpdate(conversation._id, {
      $set: { lastMessage: null, updatedAt: new Date() },
    });
    conversation.lastMessage = null;
    return conversation;
  }

  const lastMessage = {
    messageId: previous._id,
    text: getMessagePreviewText(previous.type, previous.content.text),
    senderId: previous.senderId,
    type: previous.type,
    sentAt: previous.sentAt,
  };

  await Conversation.findByIdAndUpdate(conversation._id, {
    $set: { lastMessage, updatedAt: new Date() },
  });
  conversation.lastMessage = lastMessage;

  return conversation;
};

export const findActiveParticipant = (
  conversation: IConversationDocument,
  userId: string
): IConversationParticipant | undefined =>
  conversation.participants.find(
    (p) => p.userId.toString() === userId && !p.leftAt && !p.archivedAt
  );

export const ensureParticipant = async (
  conversationId: string,
  userId: string
): Promise<IConversationDocument> => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw ApiError.notFound('Conversation not found');
  }

  const participant = findActiveParticipant(conversation, userId);
  if (!participant) {
    throw ApiError.forbidden('You are not a participant in this conversation');
  }

  return conversation;
};

export const formatMessage = (message: IMessageDocument): FormattedMessage => ({
  id: message._id.toString(),
  conversationId: message.conversationId.toString(),
  senderId: message.senderId.toString(),
  clientMessageId: message.clientMessageId,
  type: message.type,
  content: message.content,
  status: message.status,
  readBy: message.readBy.map((r) => ({
    userId: r.userId.toString(),
    readAt: r.readAt.toISOString(),
  })),
  reactions: message.reactions?.map((r) => ({
    userId: r.userId.toString(),
    type: r.type,
  })) || [],
  isEdited: message.isEdited,
  editedAt: message.editedAt ? message.editedAt.toISOString() : null,
  replyToMessageId: message.replyToMessageId?.toString() ?? null,
  deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
  sentAt: message.sentAt.toISOString(),
  createdAt: message.createdAt.toISOString(),
});

export const formatConversation = async (
  conversation: IConversationDocument,
  viewerUserId: string
): Promise<FormattedConversation> => {
  const refreshed = await refreshLastMessageIfStale(conversation);

  const viewerParticipant = refreshed.participants.find(
    (p) => p.userId.toString() === viewerUserId
  );

  const participantUserIds = refreshed.participants
    .filter((p) => !p.leftAt)
    .map((p) => p.userId);

  const users = await User.find({ _id: { $in: participantUserIds } }).select(
    'firstName avatar role isOnline lastSeenAt'
  );

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return {
    id: refreshed._id.toString(),
    type: refreshed.type,
    category: refreshed.category,
    propertyId: refreshed.propertyId?.toString() ?? null,
    title: refreshed.title ?? null,
    participants: refreshed.participants
      .filter((p) => !p.leftAt)
      .map((p) => {
        const user = userMap.get(p.userId.toString());
        return {
          userId: p.userId.toString(),
          role: p.role,
          unreadCount: p.unreadCount,
          lastReadMessageId: p.lastReadMessageId?.toString() ?? null,
          mutedUntil: p.mutedUntil ? p.mutedUntil.toISOString() : null,
          archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
          user: user
            ? {
                id: user._id.toString(),
                firstName: user.firstName,
                avatar: user.avatar,
                role: user.role,
                isOnline: (user as { isOnline?: boolean }).isOnline,
                lastSeenAt: (user as { lastSeenAt?: Date }).lastSeenAt?.toISOString() ?? null,
              }
            : undefined,
        };
      }),
    lastMessage: refreshed.lastMessage
      ? {
          messageId: refreshed.lastMessage.messageId.toString(),
          text: refreshed.lastMessage.text,
          senderId: refreshed.lastMessage.senderId.toString(),
          type: refreshed.lastMessage.type,
          sentAt: refreshed.lastMessage.sentAt.toISOString(),
        }
      : null,
    metadata: {
      isSupport: refreshed.metadata.isSupport,
      supportQueue: refreshed.metadata.supportQueue ?? null,
      avatarSeed: refreshed.metadata.avatarSeed ?? null,
    },
    unreadCount: viewerParticipant?.unreadCount ?? 0,
    createdAt: refreshed.createdAt.toISOString(),
    updatedAt: refreshed.updatedAt.toISOString(),
  };
};

export const createSystemMessage = async (
  conversationId: mongoose.Types.ObjectId,
  senderId: mongoose.Types.ObjectId,
  text: string
): Promise<IMessageDocument> => {
  const message = new Message({
    conversationId,
    senderId,
    clientMessageId: new mongoose.Types.ObjectId().toString(),
    type: 'system',
    content: { text },
    status: 'sent',
    sentAt: new Date(),
  });

  await message.save();
  return message;
};

export const isWithinEditWindow = (message: IMessageDocument): boolean =>
  Date.now() - message.sentAt.getTime() <= EDIT_WINDOW_MS;

export const isMessageVisibleToUser = (
  message: IMessageDocument,
  userId: string
): boolean => {
  if (message.deletedFor.some((id) => id.toString() === userId)) return false;
  if (message.deletedAt && message.senderId.toString() !== userId) return false;
  return true;
};

export const buildDirectConversationKey = (
  propertyId: string,
  userIdA: string,
  userIdB: string
): string[] => {
  const sorted = [userIdA, userIdB].sort();
  return sorted;
};
