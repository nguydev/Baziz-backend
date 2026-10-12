/**
 * Auto-Pay Settings
 */

import mongoose, { Document, Model } from 'mongoose';

export interface IAutoPaySetting {
  tenantId: mongoose.Types.ObjectId;
  leaseId: mongoose.Types.ObjectId;
  enabled: boolean;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  lastChargedAt: Date | null;
}

export interface IAutoPaySettingDocument extends IAutoPaySetting, Document {}

const autoPaySchema = new mongoose.Schema<IAutoPaySettingDocument>(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    leaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaseAgreement',
      required: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    stripePaymentMethodId: {
      type: String,
      default: null,
    },
    lastChargedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const AutoPaySetting = mongoose.model<IAutoPaySettingDocument>(
  'AutoPaySetting',
  autoPaySchema
);

export default AutoPaySetting;
