import mongoose, { Document, Model } from 'mongoose';

export type ConversationType = 'direct' | 'group' | 'support';
export type ConversationCategory = 'tenant' | 'marketplace' | 'group';
export type ParticipantRole = 'owner' | 'member' | 'admin' | 'support_agent';
export type MessagePreviewType = 'text' | 'image' | 'file' | 'audio' | 'system';

export interface ILastMessagePreview {
  messageId: mongoose.Types.ObjectId;
  text: string;
  senderId: mongoose.Types.ObjectId;
  type: MessagePreviewType;
  sentAt: Date;
}

export interface IConversationParticipant {
  userId: mongoose.Types.ObjectId;
  role: ParticipantRole;
  joinedAt: Date;
  leftAt?: Date | null;
  mutedUntil?: Date | null;
  archivedAt?: Date | null;
  lastReadMessageId?: mongoose.Types.ObjectId | null;
  unreadCount: number;
}

export interface IConversationMetadata {
  isSupport: boolean;
  supportQueue?: 'marketplace' | 'general' | null;
  avatarSeed?: string | null;
}

export interface IConversation {
  type: ConversationType;
  propertyId?: mongoose.Types.ObjectId | null;
  title?: string | null;
  category: ConversationCategory;
  participants: IConversationParticipant[];
  lastMessage?: ILastMessagePreview | null;
  metadata: IConversationMetadata;
  createdBy: mongoose.Types.ObjectId;
  isArchived: boolean;
}

export interface IConversationDocument extends IConversation, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationModel extends Model<IConversationDocument> {}

const lastMessagePreviewSchema = new mongoose.Schema<ILastMessagePreview>(
  {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
    text: { type: String, required: true, maxlength: 200 },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'system'],
      required: true,
    },
    sentAt: { type: Date, required: true },
  },
  { _id: false }
);

const participantSchema = new mongoose.Schema<IConversationParticipant>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ['owner', 'member', 'admin', 'support_agent'],
      default: 'member',
    },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    mutedUntil: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    lastReadMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    unreadCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const metadataSchema = new mongoose.Schema<IConversationMetadata>(
  {
    isSupport: { type: Boolean, default: false },
    supportQueue: {
      type: String,
      enum: ['marketplace', 'general', null],
      default: null,
    },
    avatarSeed: { type: String, default: null },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema<IConversationDocument, IConversationModel>(
  {
    type: {
      type: String,
      enum: ['direct', 'group', 'support'],
      required: true,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
    },
    title: { type: String, trim: true, maxlength: 100, default: null },
    category: {
      type: String,
      enum: ['tenant', 'marketplace', 'group'],
      required: true,
      index: true,
    },
    participants: {
      type: [participantSchema],
      validate: {
        validator: (v: IConversationParticipant[]) => v.length >= 1,
        message: 'Conversation must have at least one participant',
      },
    },
    lastMessage: { type: lastMessagePreviewSchema, default: null },
    metadata: { type: metadataSchema, default: () => ({ isSupport: false }) },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

conversationSchema.index({ 'participants.userId': 1, updatedAt: -1 });
conversationSchema.index({ type: 1, category: 1 });
conversationSchema.index({ propertyId: 1 });

const Conversation = mongoose.model<IConversationDocument, IConversationModel>(
  'Conversation',
  conversationSchema
);

export default Conversation;
