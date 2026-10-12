import type { IUserDocument } from '../user/user.model';
import type { IConversationDocument } from './conversation.model';
import type { IMessageDocument } from './message.model';

export type AuthUser = IUserDocument;

export interface ListConversationsQuery {
  category?: 'tenant' | 'marketplace' | 'group' | 'all';
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateDirectConversationInput {
  propertyId: string;
  otherUserId: string;
}

export interface CreateGroupConversationInput {
  name: string;
  propertyId: string;
  memberIds: string[];
}

export interface CreateSupportConversationInput {
  queue: 'marketplace' | 'general';
}

export interface UpdateConversationInput {
  title?: string;
  mutedUntil?: string | null;
}

export interface ManageMembersInput {
  action: 'add' | 'remove';
  memberIds: string[];
}

export interface ListMessagesQuery {
  cursor?: string;
  limit?: number;
}

export interface SendMessageInput {
  clientMessageId: string;
  type: 'text' | 'image' | 'file' | 'audio' | 'system';
  content: {
    text?: string;
    media?: {
      url: string;
      mimeType: string;
      fileName: string;
      sizeBytes: number;
      durationSec?: number;
      thumbnailUrl?: string;
      storagePath: string;
    };
  };
}

export interface EditMessageInput {
  text: string;
}

export interface MarkReadInput {
  lastReadMessageId: string;
}

export interface MediaUploadUrlInput {
  conversationId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MediaConfirmInput {
  conversationId: string;
  clientMessageId: string;
  type: 'image' | 'file' | 'audio';
  storagePath: string;
  url: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  durationSec?: number;
  thumbnailUrl?: string;
  caption?: string;
}

export interface FormattedConversation {
  id: string;
  type: string;
  category: string;
  propertyId: string | null;
  title: string | null;
  participants: Array<{
    userId: string;
    role: string;
    unreadCount: number;
    lastReadMessageId: string | null;
    mutedUntil: string | null;
    archivedAt: string | null;
    user?: {
      id: string;
      firstName: string;
      avatar: string | null;
      role: string;
      isOnline?: boolean;
      lastSeenAt?: string | null;
    };
  }>;
  lastMessage: {
    messageId: string;
    text: string;
    senderId: string;
    type: string;
    sentAt: string;
  } | null;
  metadata: {
    isSupport: boolean;
    supportQueue: string | null;
    avatarSeed: string | null;
  };
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FormattedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  type: string;
  content: IMessageDocument['content'];
  status: string;
  readBy: Array<{ userId: string; readAt: string }>;
  reactions: Array<{ userId: string; type: string }>;
  isEdited: boolean;
  editedAt: string | null;
  replyToMessageId: string | null;
  deletedAt: string | null;
  sentAt: string;
  createdAt: string;
}

export interface ListConversationsResult {
  conversations: FormattedConversation[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ListMessagesResult {
  messages: FormattedMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type ConversationDoc = IConversationDocument;
export type MessageDoc = IMessageDocument;
