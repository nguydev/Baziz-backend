import mongoose, { Document, Model } from 'mongoose';

export type MessageType = 'text' | 'image' | 'file' | 'audio' | 'system';
export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface IMessageMedia {
  url: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  durationSec?: number | null;
  thumbnailUrl?: string | null;
  storagePath: string;
}

export interface IMessageContent {
  text?: string | null;
  media?: IMessageMedia | null;
}

export interface IReadReceipt {
  userId: mongoose.Types.ObjectId;
  readAt: Date;
}

export interface IMessageReaction {
  userId: mongoose.Types.ObjectId;
  type: string; // 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry'
}

export interface IMessage {
  conversationId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  clientMessageId: string;
  type: MessageType;
  content: IMessageContent;
  status: MessageStatus;
  readBy: IReadReceipt[];
  reactions: IMessageReaction[];
  editedAt?: Date | null;
  isEdited: boolean;
  replyToMessageId?: mongoose.Types.ObjectId | null;
  deletedAt?: Date | null;
  deletedFor: mongoose.Types.ObjectId[];
  sentAt: Date;
}

export interface IMessageDocument extends IMessage, Document {
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageModel extends Model<IMessageDocument> {}

const mediaSchema = new mongoose.Schema<IMessageMedia>(
  {
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileName: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    durationSec: { type: Number, default: null },
    thumbnailUrl: { type: String, default: null },
    storagePath: { type: String, required: true },
  },
  { _id: false }
);

const contentSchema = new mongoose.Schema<IMessageContent>(
  {
    text: { type: String, default: null, maxlength: 5000 },
    media: { type: mediaSchema, default: null },
  },
  { _id: false }
);

const readReceiptSchema = new mongoose.Schema<IReadReceipt>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, required: true },
  },
  { _id: false }
);

const reactionSchema = new mongoose.Schema<IMessageReaction>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'love', 'haha', 'wow', 'sad', 'angry'], required: true },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema<IMessageDocument, IMessageModel>(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientMessageId: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'system'],
      required: true,
    },
    content: { type: contentSchema, required: true },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    readBy: { type: [readReceiptSchema], default: [] },
    reactions: { type: [reactionSchema], default: [] },
    editedAt: { type: Date, default: null },
    isEdited: { type: Boolean, default: false },
    replyToMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    deletedAt: { type: Date, default: null },
    deletedFor: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    sentAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

messageSchema.index({ conversationId: 1, sentAt: -1 });
messageSchema.index({ conversationId: 1, _id: -1 });
messageSchema.index({ senderId: 1, clientMessageId: 1 }, { unique: true });
messageSchema.index({ 'content.text': 'text' });

const Message = mongoose.model<IMessageDocument, IMessageModel>('Message', messageSchema);

export default Message;
