import mongoose, { Document, Model } from 'mongoose';

export interface IMarketplaceInquiry {
  listingId: mongoose.Types.ObjectId;
  inquirerId: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  message: string;
  contactEmail?: string;
  contactPhone?: string;
  status: 'pending' | 'responded' | 'closed';
  createdAt: Date;
  updatedAt: Date;
}

export interface IMarketplaceInquiryDocument extends IMarketplaceInquiry, Document {}

const marketplaceInquirySchema = new mongoose.Schema<IMarketplaceInquiryDocument>(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketplaceListing',
      required: true,
      index: true,
    },
    inquirerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'responded', 'closed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
    collection: 'marketplace_inquiries',
  }
);

const MarketplaceInquiry = mongoose.model<IMarketplaceInquiryDocument>(
  'MarketplaceInquiry',
  marketplaceInquirySchema
);

export default MarketplaceInquiry;
