import mongoose, { Document, Model } from 'mongoose';
import type { IStampDutyRateSet, Region, Regime, RateStatus } from './stamp-duty.types';

export interface IStampDutyRateSetDocument extends IStampDutyRateSet, Document {}
export interface IStampDutyRateSetModel extends Model<IStampDutyRateSetDocument> {}

const stampDutyRateSetSchema = new mongoose.Schema<IStampDutyRateSetDocument, IStampDutyRateSetModel>(
  {
    region: {
      type: String,
      enum: ['england-ni', 'wales', 'scotland'] as Region[],
      required: true,
      index: true,
    },
    regime: {
      type: String,
      enum: ['residential', 'residential-ftb', 'commercial'] as Regime[],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'proposal', 'archived'] as RateStatus[],
      required: true,
      default: 'proposal',
      index: true,
    },
    bands: [
      {
        upTo: { type: Number, required: true }, // -1 means Infinity
        rate: { type: Number, required: true }, // e.g., 0.05 for 5%
      },
    ],
    surchargeRate: {
      type: Number,
      required: true,
      default: 0,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    effectiveFrom: {
      type: Date,
      required: true,
      default: Date.now,
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

const StampDutyRateSet = mongoose.model<IStampDutyRateSetDocument, IStampDutyRateSetModel>(
  'StampDutyRateSet',
  stampDutyRateSetSchema
);

export default StampDutyRateSet;
