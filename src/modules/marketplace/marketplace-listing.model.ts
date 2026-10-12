import mongoose, { Document, Model } from 'mongoose';
import type { IMarketplaceListing, ListingSourceType, ListingStatus } from './marketplace.types';

export interface IMarketplaceListingDocument extends IMarketplaceListing, Document {}

export interface IMarketplaceListingModel extends Model<IMarketplaceListingDocument> {}

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    storagePath: { type: String, required: true },
  },
  { _id: false }
);

const marketplaceListingSchema = new mongoose.Schema<IMarketplaceListingDocument>(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['property'],
      default: 'property',
    },
    sourceType: {
      type: String,
      enum: ['portfolio', 'external'] satisfies ListingSourceType[],
      required: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    location: { type: String, required: true, trim: true, maxlength: 300 },
    address: {
      line1: { type: String, trim: true },
      city: { type: String, trim: true },
      postCode: { type: String, trim: true, uppercase: true },
      country: { type: String, trim: true, default: 'UK' },
    },
    geo: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
    },
    price: { type: Number, required: true, min: 0 },
    yield: { type: Number, min: 0, max: 100, default: null },
    type: { type: String, required: true, trim: true },
    size: { type: String, trim: true, default: null },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    imageUrl: { type: String, default: null },
    images: { type: [imageSchema], default: [] },
    specs: {
      sqft: { type: Number, min: 0, default: null },
      bedrooms: { type: Number, min: 0, default: null },
      bathrooms: { type: Number, min: 0, default: null },
      epcRating: { type: String, trim: true, default: null },
      tenure: { type: String, trim: true, default: null },
      occupancy: { type: String, enum: ['vacant', 'tenanted', null], default: null },
    },
    flags: {
      isNegotiable: { type: Boolean, default: false },
      valuationRequested: { type: Boolean, default: false },
      isActive: { type: Boolean, default: true },
    },
    valuation: {
      estimatedValue: { type: Number, default: null },
      confidence: { type: Number, min: 0, max: 100, default: null },
      completedAt: { type: Date, default: null },
    },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'published', 'sold', 'removed'] satisfies ListingStatus[],
      default: 'published',
      index: true,
    },
    views: { type: Number, default: 0, min: 0 },
    inquiries: { type: Number, default: 0, min: 0 },
    publishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'marketplace_listings',
    toJSON: {
      transform(_doc, ret) {
        const sanitized = ret as Record<string, unknown>;
        delete sanitized.__v;
        return sanitized;
      },
    },
  }
);

marketplaceListingSchema.index({ sellerId: 1, status: 1 });
marketplaceListingSchema.index(
  { propertyId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      propertyId: { $type: 'objectId' },
      status: { $in: ['draft', 'pending_review', 'published'] },
    },
  }
);
marketplaceListingSchema.index({ geo: '2dsphere' }, { sparse: true });
marketplaceListingSchema.index({ status: 1, publishedAt: -1 });
marketplaceListingSchema.index({ type: 1, price: 1 });
marketplaceListingSchema.index(
  { title: 'text', location: 'text', description: 'text' },
  { weights: { title: 10, location: 5, description: 1 }, name: 'marketplace_listing_text' }
);

const MarketplaceListing = mongoose.model<IMarketplaceListingDocument, IMarketplaceListingModel>(
  'MarketplaceListing',
  marketplaceListingSchema
);

export default MarketplaceListing;
