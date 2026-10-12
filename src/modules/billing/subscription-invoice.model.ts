import mongoose, { Document, Model } from 'mongoose';

export interface ISubscriptionInvoice {
  landlordId: mongoose.Types.ObjectId;
  stripeInvoiceId: string;
  amount: number;
  currency: string;
  status: string;
  planName: string;
  pdfUrl: string | null;
  invoiceDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscriptionInvoiceDocument extends ISubscriptionInvoice, Document {}

const subscriptionInvoiceSchema = new mongoose.Schema<ISubscriptionInvoiceDocument>(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    stripeInvoiceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, lowercase: true, default: 'gbp' },
    status: { type: String, required: true, index: true },
    planName: { type: String, required: true, trim: true },
    pdfUrl: { type: String, default: null },
    invoiceDate: { type: Date, required: true, index: true },
  },
  {
    timestamps: true,
    collection: 'subscription_invoices',
  }
);

subscriptionInvoiceSchema.index({ landlordId: 1, invoiceDate: -1 });

const SubscriptionInvoice = mongoose.model<ISubscriptionInvoiceDocument>(
  'SubscriptionInvoice',
  subscriptionInvoiceSchema
);

export default SubscriptionInvoice;
