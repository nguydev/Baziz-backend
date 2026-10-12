import mongoose, { Document, Model } from 'mongoose';

export interface IMarketplaceSaved {
  userId: mongoose.Types.ObjectId;
  itemType: 'listing' | 'joint_venture';
  itemId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMarketplaceSavedDocument extends IMarketplaceSaved, Document {}

const marketplaceSavedSchema = new mongoose.Schema<IMarketplaceSavedDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    itemType: {
      type: String,
      enum: ['listing', 'joint_venture'],
      required: true,
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'marketplace_saved',
  }
);

marketplaceSavedSchema.index({ userId: 1, itemType: 1, itemId: 1 }, { unique: true });

const MarketplaceSaved = mongoose.model<IMarketplaceSavedDocument>(
  'MarketplaceSaved',
  marketplaceSavedSchema
);

export default MarketplaceSaved;
