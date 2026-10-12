/**
 * Complaint Model
 * Mongoose schema for tenant property complaints
 */

import mongoose, { Document, Model } from 'mongoose';
import type {
  ComplaintCategory,
  ComplaintUrgency,
  ComplaintStatus,
  IComplaint,
} from './complaint.types';

export interface IComplaintDocument extends IComplaint, Document {}

export interface IComplaintModel extends Model<IComplaintDocument> {}

const complaintSchema = new mongoose.Schema<IComplaintDocument, IComplaintModel>(
  {
    leaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaseAgreement',
      required: [true, 'Lease ID is required'],
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

    category: {
      type: String,
      enum: {
        values: [
          'property_condition',
          'noise',
          'neighbour_dispute',
          'billing',
          'communication',
          'other',
        ] as ComplaintCategory[],
        message: 'Invalid complaint category',
      },
      required: [true, 'Category is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    urgency: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high'] as ComplaintUrgency[],
        message: 'Urgency must be low, medium, or high',
      },
      required: [true, 'Urgency is required'],
    },

    status: {
      type: String,
      enum: {
        values: ['in_review', 'in_progress', 'resolved', 'closed'] as ComplaintStatus[],
        message: 'Invalid complaint status',
      },
      default: 'in_review',
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

complaintSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
complaintSchema.index({ landlordId: 1, status: 1, createdAt: -1 });
complaintSchema.index({ propertyId: 1, status: 1 });
complaintSchema.index({ status: 1, urgency: 1 });

const Complaint = mongoose.model<IComplaintDocument, IComplaintModel>(
  'Complaint',
  complaintSchema
);

export default Complaint;
