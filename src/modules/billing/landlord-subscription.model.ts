import mongoose, { Document, Model } from 'mongoose';
import type { PlanId, SubscriptionStatus } from './billing.constants';

export interface IPaymentMethodSummary {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface ILandlordSubscription {
  landlordId: mongoose.Types.ObjectId;
  planId: PlanId;
  status: SubscriptionStatus;
  priceMonthly: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  billingEmail: string | null;
  billingAddress: string | null;
  paymentMethod: IPaymentMethodSummary | null;
  gracePeriodEndsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILandlordSubscriptionDocument extends ILandlordSubscription, Document {}

const paymentMethodSchema = new mongoose.Schema<IPaymentMethodSummary>(
  {
    brand: { type: String, required: true },
    last4: { type: String, required: true },
    expMonth: { type: Number, required: true },
    expYear: { type: Number, required: true },
  },
  { _id: false }
);

const landlordSubscriptionSchema = new mongoose.Schema<ILandlordSubscriptionDocument>(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    planId: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'trialing', 'past_due', 'canceled'],
      default: 'active',
      index: true,
    },
    priceMonthly: { type: Number, default: 0, min: 0 },
    stripeCustomerId: { type: String, default: null, index: true, sparse: true },
    stripeSubscriptionId: { type: String, default: null, index: true, sparse: true },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    billingEmail: { type: String, default: null, trim: true, lowercase: true },
    billingAddress: { type: String, default: null, trim: true, maxlength: 500 },
    paymentMethod: { type: paymentMethodSchema, default: null },
    gracePeriodEndsAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'landlord_subscriptions',
  }
);

const LandlordSubscription = mongoose.model<ILandlordSubscriptionDocument>(
  'LandlordSubscription',
  landlordSubscriptionSchema
);

export default LandlordSubscription;
