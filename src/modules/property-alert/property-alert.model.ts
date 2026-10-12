import mongoose, { Document, Model } from 'mongoose';

// --- Alert Config Model ---

export interface IAlertConfig {
  userId: mongoose.Types.ObjectId;
  title: string;
  propertyType: string;
  location: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAlertConfigDocument extends IAlertConfig, Document {}

const alertConfigSchema = new mongoose.Schema<IAlertConfigDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Alert title is required'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    propertyType: {
      type: String,
      required: [true, 'Property type is required'],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const sanitized = ret as Record<string, unknown>;
        delete sanitized.__v;
        return sanitized;
      },
    },
  }
);

export const AlertConfig = mongoose.model<IAlertConfigDocument>('AlertConfig', alertConfigSchema);

// --- Alert Notification Model ---

export type AlertTone = 'success' | 'info' | 'warning';

export interface IAlertNotification {
  userId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  iconName: string; // e.g. "TrendingDown", "Sparkles", "Gavel"
  tone: AlertTone;
  isRead: boolean;
  propertyId?: mongoose.Types.ObjectId;
  senderId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAlertNotificationDocument extends IAlertNotification, Document {}

const alertNotificationSchema = new mongoose.Schema<IAlertNotificationDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    iconName: {
      type: String,
      default: 'Bell',
    },
    tone: {
      type: String,
      enum: ['success', 'info', 'warning'],
      default: 'info',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const sanitized = ret as Record<string, unknown>;
        delete sanitized.__v;
        return sanitized;
      },
    },
  }
);

alertNotificationSchema.index({ userId: 1, createdAt: -1 });

export const AlertNotification = mongoose.model<IAlertNotificationDocument>('AlertNotification', alertNotificationSchema);
