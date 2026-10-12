/**
 * Property Contact Model
 * Service provider contacts scoped to a specific property
 */

import mongoose, { Document, Model } from 'mongoose';
import type { PropertyContactProfession, IPropertyContact } from './property-contact.types';

export interface IPropertyContactDocument extends IPropertyContact, Document {}

export interface IPropertyContactModel extends Model<IPropertyContactDocument> {}

const propertyContactSchema = new mongoose.Schema<
  IPropertyContactDocument,
  IPropertyContactModel
>(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property ID is required'],
      index: true,
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Landlord ID is required'],
      index: true,
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [150, 'Company name cannot exceed 150 characters'],
    },
    contactPerson: {
      type: String,
      required: [true, 'Contact person name is required'],
      trim: true,
      maxlength: [100, 'Contact person name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
      default: null,
    },
    profession: {
      type: String,
      enum: {
        values: [
          'electrician',
          'plumber',
          'landscaper',
          'carpenter',
          'painter',
          'hvac',
          'general_contractor',
          'locksmith',
          'pest_control',
          'cleaner',
          'other',
        ] as PropertyContactProfession[],
        message: 'Invalid profession type',
      },
      required: [true, 'Profession is required'],
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
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

propertyContactSchema.index({ propertyId: 1, profession: 1 });
propertyContactSchema.index({ propertyId: 1, isActive: 1, createdAt: -1 });
propertyContactSchema.index({ landlordId: 1, propertyId: 1 });

const PropertyContact = mongoose.model<IPropertyContactDocument, IPropertyContactModel>(
  'PropertyContact',
  propertyContactSchema
);

export default PropertyContact;
