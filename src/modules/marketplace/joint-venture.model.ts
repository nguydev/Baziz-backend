import mongoose, { Document, Model } from 'mongoose';
import type { IJointVenture, JvRisk, JvStatus } from './marketplace.types';

export interface IJointVentureDocument extends IJointVenture, Document {}

export interface IJointVentureModel extends Model<IJointVentureDocument> {}

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    storagePath: { type: String, required: true },
  },
  { _id: false }
);

const jointVentureSchema = new mongoose.Schema<IJointVentureDocument>(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['joint_venture'],
      default: 'joint_venture',
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    projectType: { type: String, required: true, trim: true, maxlength: 100 },
    investmentModel: { type: String, required: true, trim: true, maxlength: 100 },
    risk: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'] satisfies JvRisk[],
      required: true,
    },
    location: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    exitStrategy: { type: String, required: true, trim: true, maxlength: 2000 },
    financials: {
      totalProjectCost: { type: Number, required: true, min: 0 },
      investmentNeeded: { type: Number, required: true, min: 0 },
      expectedReturn: { type: Number, required: true, min: 0, max: 200 },
      timeline: { type: String, required: true, trim: true, maxlength: 100 },
    },
    imageUrl: { type: String, default: null },
    images: { type: [imageSchema], default: [] },
    status: {
      type: String,
      enum: ['draft', 'published', 'closed', 'removed'] satisfies JvStatus[],
      default: 'published',
      index: true,
    },
    views: { type: Number, default: 0, min: 0 },
    inquiries: { type: Number, default: 0, min: 0 },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'joint_ventures',
    toJSON: {
      transform(_doc, ret) {
        const sanitized = ret as Record<string, unknown>;
        delete sanitized.__v;
        return sanitized;
      },
    },
  }
);

jointVentureSchema.index({ creatorId: 1, status: 1 });
jointVentureSchema.index({ status: 1, publishedAt: -1 });
jointVentureSchema.index({ projectType: 1, 'financials.investmentNeeded': 1 });
jointVentureSchema.index(
  { title: 'text', location: 'text', description: 'text' },
  { weights: { title: 10, location: 5, description: 1 }, name: 'joint_venture_text' }
);

const JointVenture = mongoose.model<IJointVentureDocument, IJointVentureModel>(
  'JointVenture',
  jointVentureSchema
);

export default JointVenture;
