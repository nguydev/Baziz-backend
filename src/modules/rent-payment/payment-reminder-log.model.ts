/**
 * Payment Reminder Log — prevents duplicate notifications in the same 2-hour window
 */

import mongoose, { Document, Model } from 'mongoose';

export interface IPaymentReminderLog {
  rentPaymentId: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  recipientRole: 'tenant' | 'landlord';
  channel: 'email' | 'sms' | 'push';
  reminderSlot: string;
  sentAt: Date;
}

export interface IPaymentReminderLogDocument extends IPaymentReminderLog, Document {}

const paymentReminderLogSchema = new mongoose.Schema<IPaymentReminderLogDocument>(
  {
    rentPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RentPayment',
      required: true,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipientRole: {
      type: String,
      enum: ['tenant', 'landlord'],
      required: true,
    },
    channel: {
      type: String,
      enum: ['email', 'sms', 'push'],
      required: true,
    },
    reminderSlot: {
      type: String,
      required: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

paymentReminderLogSchema.index(
  { rentPaymentId: 1, recipientId: 1, reminderSlot: 1 },
  { unique: true }
);

const PaymentReminderLog = mongoose.model<IPaymentReminderLogDocument>(
  'PaymentReminderLog',
  paymentReminderLogSchema
);

export default PaymentReminderLog;
