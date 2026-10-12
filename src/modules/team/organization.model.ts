import mongoose, { Document, Model } from 'mongoose';
import type { IOrganization } from './team.types';

export interface IOrganizationDocument extends IOrganization, Document {}

const organizationSchema = new mongoose.Schema<IOrganizationDocument>(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    collection: 'organizations',
  }
);

const Organization = mongoose.model<IOrganizationDocument>('Organization', organizationSchema);

export default Organization;
