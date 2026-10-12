import mongoose, { Document, Model } from 'mongoose';

export type PaymentFrequency = 'monthly' | 'quarterly' | 'yearly';
export type LeaseStatus = 'pending_acceptance' | 'accepted' | 'active' | 'ended';

/**
 * Parking Bay Interface
 */
export interface IParkingBay {
  bayNumber: string;
  assignedToTenant?: boolean;
  notes?: string;
  addedAt: Date;
}

/**
 * Unit Interface
 */
export interface IUnit {
  _id: mongoose.Types.ObjectId;
  unitNumber: string;
  totalParkingSpots: number;
  parkingBays: IParkingBay[];
  currentTenantId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Property Interface
 */
export interface IProperty {
  landlordId: mongoose.Types.ObjectId;
  propertyName: string;
  address: string;
  units: IUnit[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPropertyDocument extends IProperty, Document {}

/**
 * Lease Agreement Interface
 */
export interface ILeaseAgreement {
  propertyId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  landlordId: mongoose.Types.ObjectId;
  tenantEmail: string;
  tenantId?: mongoose.Types.ObjectId;
  tenantFullName: string;
  tenantPhone: string;
  rentAmount: number;
  securityDeposit: number;
  paymentFrequency: PaymentFrequency;
  paymentDueDay: number;
  leaseStartDate: Date;
  leaseEndDate: Date;
  lastRentReviewDate?: Date;
  assignedParkingBays: string[];
  parkingNotes?: string;
  status: LeaseStatus;
  invitationSentAt: Date;
  invitationExpiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILeaseAgreementDocument extends ILeaseAgreement, Document {}

export interface ILeaseAgreementModel extends Model<ILeaseAgreementDocument> {
  findByLeaseId(leaseId: string): Promise<ILeaseAgreementDocument | null>;
  findByLandlord(landlordId: string, filters?: any): Promise<ILeaseAgreementDocument[]>;
  findByTenant(tenantId: string): Promise<ILeaseAgreementDocument | null>;
  findPendingInvitations(): Promise<ILeaseAgreementDocument[]>;
}

/**
 * Parking Bay Schema
 */
const parkingBaySchema = new mongoose.Schema<IParkingBay>(
  {
    bayNumber: {
      type: String,
      required: [true, 'Bay number is required'],
      trim: true,
    },
    assignedToTenant: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: null,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/**
 * Unit Schema
 */
const unitSchema = new mongoose.Schema<IUnit>(
  {
    unitNumber: {
      type: String,
      required: [true, 'Unit number is required'],
      trim: true,
    },
    totalParkingSpots: {
      type: Number,
      required: [true, 'Total parking spots is required'],
      min: [0, 'Parking spots cannot be negative'],
    },
    parkingBays: {
      type: [parkingBaySchema],
      default: [],
    },
    currentTenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * Property Schema
 */
const propertySchema = new mongoose.Schema<IPropertyDocument>(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Landlord ID is required'],
      index: true,
    },
    propertyName: {
      type: String,
      required: [true, 'Property name is required'],
      trim: true,
      maxlength: [100, 'Property name cannot exceed 100 characters'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    units: {
      type: [unitSchema],
      default: [],
    },
  },
  { timestamps: true }
);

/**
 * Lease Agreement Schema
 */
const leaseAgreementSchema = new mongoose.Schema<ILeaseAgreementDocument, ILeaseAgreementModel>(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property ID is required'],
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Unit ID is required'],
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Landlord ID is required'],
      index: true,
    },
    tenantEmail: {
      type: String,
      required: [true, 'Tenant email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    tenantFullName: {
      type: String,
      required: [true, 'Tenant full name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    tenantPhone: {
      type: String,
      required: [true, 'Tenant phone is required'],
      trim: true,
      maxlength: [20, 'Phone cannot exceed 20 characters'],
    },
    rentAmount: {
      type: Number,
      required: [true, 'Rent amount is required'],
      min: [0, 'Rent amount cannot be negative'],
    },
    securityDeposit: {
      type: Number,
      required: [true, 'Security deposit is required'],
      min: [0, 'Security deposit cannot be negative'],
    },
    paymentFrequency: {
      type: String,
      enum: {
        values: ['monthly', 'quarterly', 'yearly'],
        message: 'Payment frequency must be monthly, quarterly, or yearly',
      },
      required: [true, 'Payment frequency is required'],
    },
    paymentDueDay: {
      type: Number,
      required: [true, 'Payment due day is required'],
      min: [1, 'Payment due day must be between 1 and 31'],
      max: [31, 'Payment due day must be between 1 and 31'],
    },
    leaseStartDate: {
      type: Date,
      required: [true, 'Lease start date is required'],
    },
    leaseEndDate: {
      type: Date,
      required: [true, 'Lease end date is required'],
    },
    lastRentReviewDate: {
      type: Date,
      default: null,
    },
    assignedParkingBays: {
      type: [String],
      default: [],
    },
    parkingNotes: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: ['pending_acceptance', 'accepted', 'active', 'ended'],
        message: 'Invalid lease status',
      },
      default: 'pending_acceptance',
      index: true,
    },
    invitationSentAt: {
      type: Date,
      required: [true, 'Invitation sent date is required'],
    },
    invitationExpiresAt: {
      type: Date,
      required: [true, 'Invitation expiry date is required'],
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
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

/**
 * Indexes for performance
 */
propertySchema.index({ landlordId: 1, createdAt: -1 });
leaseAgreementSchema.index({ landlordId: 1, status: 1 });
leaseAgreementSchema.index({ tenantEmail: 1, status: 1 });
leaseAgreementSchema.index({ propertyId: 1, unitId: 1 });

/**
 * Unique constraint for active leases
 */
leaseAgreementSchema.index(
  { propertyId: 1, unitId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending_acceptance', 'accepted', 'active'] },
    },
  }
);

/**
 * Static Methods
 */
leaseAgreementSchema.statics.findByLeaseId = async function (leaseId: string) {
  return this.findById(leaseId);
};

leaseAgreementSchema.statics.findByLandlord = async function (
  landlordId: string,
  filters: any = {}
) {
  const query: any = { landlordId };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.propertyId) {
    query.propertyId = filters.propertyId;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit || 10)
    .skip(filters.skip || 0);
};

leaseAgreementSchema.statics.findByTenant = async function (tenantId: string) {
  return this.findOne({ tenantId, status: { $ne: 'ended' } });
};

leaseAgreementSchema.statics.findPendingInvitations = async function () {
  return this.find({
    status: 'pending_acceptance',
    invitationExpiresAt: { $lt: new Date() },
  });
};

/**
 * Export Models
 */
const LeaseAgreement = mongoose.model<ILeaseAgreementDocument, ILeaseAgreementModel>(
  'LeaseAgreement',
  leaseAgreementSchema
);

export default { LeaseAgreement };
