/**
 * Rent Payment Model
 */

import mongoose, { Document, Model } from 'mongoose';
import type {
  RentPaymentStatus,
  RentPaymentMethod,
  RentPaymentCreatedBy,
  IRentPayment,
} from './rent-payment.types';

export interface IRentPaymentDocument extends IRentPayment, Document {}

export interface IRentPaymentModel extends Model<IRentPaymentDocument> {}

const rentPaymentSchema = new mongoose.Schema<IRentPaymentDocument, IRentPaymentModel>(
  {
    leaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaseAgreement',
      required: true,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    billingMonth: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}$/, 'billingMonth must be YYYY-MM'],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Amount must be greater than zero'],
    },
    currency: {
      type: String,
      default: 'GBP',
      uppercase: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'apple_pay', 'manual', 'auto_pay', null],
      default: null,
    },
    stripePaymentIntentId: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    stripeChargeId: {
      type: String,
      default: null,
    },
    transactionRef: {
      type: String,
      default: null,
    },
    reminderCount: {
      type: Number,
      default: 0,
    },
    lastReminderAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: String,
      enum: ['system', 'landlord', 'tenant'],
      default: 'system',
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

rentPaymentSchema.index({ leaseId: 1, billingMonth: 1 }, { unique: true });
rentPaymentSchema.index({ landlordId: 1, status: 1, dueDate: -1 });
rentPaymentSchema.index({ tenantId: 1, status: 1, dueDate: -1 });

const RentPayment = mongoose.model<IRentPaymentDocument, IRentPaymentModel>(
  'RentPayment',
  rentPaymentSchema
);

export default RentPayment;
