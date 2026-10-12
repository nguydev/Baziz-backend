/**
 * Property Document Model
 */

import mongoose, { Document, Model } from 'mongoose';
import type { IPropertyDocument } from './property-document.types';

export interface IPropertyDocumentRecord extends IPropertyDocument, Document {}

export interface IPropertyDocumentModel extends Model<IPropertyDocumentRecord> {}

const propertyDocumentSchema = new mongoose.Schema<
  IPropertyDocumentRecord,
  IPropertyDocumentModel
>(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      index: true,
      default: null,
    },
    documentType: {
      type: String,
      default: 'Other',
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Landlord ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
      min: [1, 'File size must be greater than zero'],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader ID is required'],
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

propertyDocumentSchema.index({ propertyId: 1, createdAt: -1 });
propertyDocumentSchema.index({ propertyId: 1, isActive: 1 });

const PropertyDocument = mongoose.model<
  IPropertyDocumentRecord,
  IPropertyDocumentModel
>('PropertyDocument', propertyDocumentSchema);

export default PropertyDocument;
