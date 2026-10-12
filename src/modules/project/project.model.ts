import mongoose, { Schema } from 'mongoose';
import type { IProject } from './project.types';

const projectSchema = new Schema<IProject>(
  {
    ownershipEntity: {
      type: Schema.Types.ObjectId,
      ref: 'OwnershipEntity',
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        'renovation',
        'maintenance',
        'construction',
        'refurbishment',
        'other',
      ],
      required: true,
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },

    status: {
      type: String,
      enum: [
        'planning',
        'in-progress',
        'on-hold',
        'completed',
        'cancelled',
      ],
      default: 'planning',
    },

    budget: {
      type: Number,
      min: 0,
    },

    contingency: {
      type: Number,
      min: 0,
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    actualStartDate: {
      type: Date,
    },

    actualEndDate: {
      type: Date,
    },

    spentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    notes: {
      type: String,
    },

    attachments: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for faster queries
projectSchema.index({ ownershipEntity: 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ priority: 1 });

export const Project = mongoose.model<IProject>(
  'Project',
  projectSchema
);