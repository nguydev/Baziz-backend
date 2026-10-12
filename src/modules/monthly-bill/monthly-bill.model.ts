/**
 * Monthly Bill Model
 * Mongoose schema for Landlord utility bill tracking per property unit
 * Covers: bill details, supplier info, payment status, soft delete
 */

import mongoose, { Document, Model } from 'mongoose';
import type { BillType, PaymentStatus, IMonthlyBill } from './monthly-bill.types';

// ─── Document Interface ────────────────────────────────────────────────────────
export interface IMonthlyBillDocument extends IMonthlyBill, Document {}

export interface IMonthlyBillModel extends Model<IMonthlyBillDocument> {}

// ─── Monthly Bill Schema ───────────────────────────────────────────────────────
const monthlyBillSchema = new mongoose.Schema<IMonthlyBillDocument, IMonthlyBillModel>(
  {
    // ── Bill Details ──────────────────────────────────────────────────────
    billType: {
      type: String,
      enum: {
        values: ['water', 'electricity', 'gas', 'council_tax', 'broadband', 'other'] as BillType[],
        message: 'Invalid bill type',
      },
      required: [true, 'Bill type is required'],
    },
    billingCycle: {
      type: String,
      enum: {
        values: ['weekly', 'monthly', 'yearly', 'one_time'],
        message: 'Invalid billing cycle',
      },
      required: [true, 'Billing cycle is required'],
    },
    supplier: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      maxlength: [100, 'Supplier name cannot exceed 100 characters'],
    },
    accountReference: {
      type: String,
      required: [true, 'Account reference is required'],
      trim: true,
      maxlength: [100, 'Account reference cannot exceed 100 characters'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    dueDay: {
      type: Number,
      required: [true, 'Due day is required'],
      min: [1, 'Due day must be between 1 and 365'],
      max: [365, 'Due day must be between 1 and 365'],
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['paid', 'pending', 'overdue'] as PaymentStatus[],
        message: 'Payment status must be paid, pending, or overdue',
      },
      default: 'pending',
    },
    supplierPhone: {
      type: String,
      trim: true,
      maxlength: [20, 'Supplier phone cannot exceed 20 characters'],
      default: null,
    },
    supplierWebsite: {
      type: String,
      trim: true,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: null,
    },

    // ── Relationships ─────────────────────────────────────────────────────
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property ID is required'],
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Unit ID is required'],
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Landlord ID is required'],
      index: true,
    },

    // ── Soft Delete ───────────────────────────────────────────────────────
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

// ─── Compound Indexes ─────────────────────────────────────────────────────────
monthlyBillSchema.index({ tenantId: 1, paymentStatus: 1 });
monthlyBillSchema.index({ landlordId: 1, paymentStatus: 1 });
monthlyBillSchema.index({ propertyId: 1, unitId: 1 });
monthlyBillSchema.index({ tenantId: 1, billType: 1 });

// ─── Export ───────────────────────────────────────────────────────────────────
const MonthlyBill = mongoose.model<IMonthlyBillDocument, IMonthlyBillModel>(
  'MonthlyBill',
  monthlyBillSchema
);

export default MonthlyBill;
