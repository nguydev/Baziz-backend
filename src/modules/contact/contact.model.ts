/**
 * Contact Model
 * Landlord's maintenance service provider contact management
 */

import mongoose, { Document, Model } from 'mongoose';

export type ContactProfession =
  | 'electrician'
  | 'plumber'
  | 'landscaper'
  | 'carpenter'
  | 'painter'
  | 'hvac'
  | 'general_contractor'
  | 'locksmith'
  | 'pest_control'
  | 'cleaner'
  | 'other';

export interface IContact {
  landlordId: mongoose.Types.ObjectId;
  company: string;
  contactPerson: string;
  phone: string;
  email?: string;
  profession: ContactProfession;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IContactDocument extends IContact, Document {}

export interface IContactModel extends Model<IContactDocument> {}

const contactSchema = new mongoose.Schema<IContactDocument, IContactModel>(
  {
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
        ],
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

contactSchema.index({ landlordId: 1, profession: 1 });
contactSchema.index({ landlordId: 1, isActive: 1, createdAt: -1 });
contactSchema.index({ landlordId: 1, company: 1 });

const Contact = mongoose.model<IContactDocument, IContactModel>('Contact', contactSchema);

export default Contact;
