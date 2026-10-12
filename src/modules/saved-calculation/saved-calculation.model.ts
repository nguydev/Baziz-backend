import mongoose, { Document, Model } from 'mongoose';
import type { ISavedCalculation, CalculatorType } from './saved-calculation.types';

export interface ISavedCalculationDocument extends ISavedCalculation, Document {}
export interface ISavedCalculationModel extends Model<ISavedCalculationDocument> {}

const savedCalculationSchema = new mongoose.Schema<ISavedCalculationDocument, ISavedCalculationModel>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    calculatorType: {
      type: String,
      enum: ['roi', 'stamp-duty', 'property-flip', 'development'] as CalculatorType[],
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    inputs: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    results: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    shareToken: {
      type: String,
      default: null,
      index: true,
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    sharedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: null,
      maxlength: 1000,
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

const SavedCalculation = mongoose.model<ISavedCalculationDocument, ISavedCalculationModel>(
  'SavedCalculation',
  savedCalculationSchema
);

export default SavedCalculation;
