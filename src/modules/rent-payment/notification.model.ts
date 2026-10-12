/**
 * In-app Notifications
 */

import mongoose, { Document, Model } from 'mongoose';

export type NotificationType =
  | 'rent_due'
  | 'rent_overdue'
  | 'rent_paid'
  | 'rent_received';

export interface INotification {
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  type: NotificationType;
  rentPaymentId?: mongoose.Types.ObjectId;
  read: boolean;
  createdAt: Date;
}

export interface INotificationDocument extends INotification, Document {}

const notificationSchema = new mongoose.Schema<INotificationDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['rent_due', 'rent_overdue', 'rent_paid', 'rent_received'],
      required: true,
    },
    rentPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RentPayment',
      default: null,
    },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model<INotificationDocument>(
  'Notification',
  notificationSchema
);

export default Notification;
