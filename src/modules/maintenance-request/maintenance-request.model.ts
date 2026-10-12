/**
 * Maintenance Request Model
 * Mongoose schema for tenant maintenance/repair reports
 * Covers: request details, status workflow, photo attachments, comments
 */

import mongoose, { Document, Model } from 'mongoose';
import type {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  IMaintenanceComment,
  IMaintenanceRequest,
} from './maintenance-request.types';

// ─── Document Interface ────────────────────────────────────────────────────────
export interface IMaintenanceRequestDocument extends IMaintenanceRequest, Document {}

export interface IMaintenanceRequestModel extends Model<IMaintenanceRequestDocument> {}

// ─── Comment Sub-schema ───────────────────────────────────────────────────────
const commentSchema = new mongoose.Schema<IMaintenanceComment>(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author ID is required'],
    },
    authorRole: {
      type: String,
      enum: {
        values: ['tenant', 'landlord'],
        message: 'Author role must be tenant or landlord',
      },
      required: [true, 'Author role is required'],
    },
    body: {
      type: String,
      required: [true, 'Comment body is required'],
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// ─── Maintenance Request Schema ────────────────────────────────────────────────
const maintenanceRequestSchema = new mongoose.Schema<
  IMaintenanceRequestDocument,
  IMaintenanceRequestModel
>(
  {
    // ── Core linkage ──────────────────────────────────────────────────────
    leaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaseAgreement',
      required: false,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property ID is required'],
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Landlord ID is required'],
      index: true,
    },

    // ── Request details ───────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    category: {
      type: String,
      enum: {
        values: [
          'plumbing',
          'electrical',
          'heating_cooling',
          'appliances',
          'structural',
          'pest_control',
          'security',
          'cleaning',
          'other',
        ] as MaintenanceCategory[],
        message: 'Invalid maintenance category',
      },
      required: [true, 'Category is required'],
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'emergency'] as MaintenancePriority[],
        message: 'Priority must be low, medium, high, or emergency',
      },
      required: [true, 'Priority is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    cost: {
      type: Number,
      default: 0,
    },
    photos: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 5,
        message: 'Cannot attach more than 5 photos',
      },
    },

    // ── Workflow ──────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ['open', 'in_progress', 'resolved', 'closed'] as MaintenanceStatus[],
        message: 'Invalid status',
      },
      default: 'open',
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },

    // ── Collaboration ─────────────────────────────────────────────────────
    comments: {
      type: [commentSchema],
      default: [],
    },

    // ── Soft delete ───────────────────────────────────────────────────────
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
maintenanceRequestSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
maintenanceRequestSchema.index({ landlordId: 1, status: 1, createdAt: -1 });
maintenanceRequestSchema.index({ propertyId: 1, status: 1 });
maintenanceRequestSchema.index({ status: 1, priority: 1 });

// ─── Export ───────────────────────────────────────────────────────────────────
const MaintenanceRequest = mongoose.model<
  IMaintenanceRequestDocument,
  IMaintenanceRequestModel
>('MaintenanceRequest', maintenanceRequestSchema);

export default MaintenanceRequest;
