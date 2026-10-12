/**
 * Property Model
 * Full Mongoose schema for a Landlord's property
 * Covers: Basic Details, Specifications, Address, Ownership,
 *         Purchase Info, Additional Costs, Management, Insurance
 */

import mongoose, { Document, Model } from 'mongoose';

// ─── Enums ────────────────────────────────────────────────────────────────────
export type PropertyType =
  | 'detached_house'
  | 'semi_detached_house'
  | 'terraced_house'
  | 'flat_apartment'
  | 'bungalow'
  | 'maisonette'
  | 'studio'
  | 'hmo'
  | 'commercial'
  | 'other';

export type Tenure = 'freehold' | 'leasehold' | 'share_of_freehold';
export type EPCRating = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type OwnershipType = 'personal' | 'sole' | 'joint' | 'company' | 'trust';

// ─── Unit Sub-document Interface ─────────────────────────────────────────────
export interface IPropertyUnit {
  _id?: mongoose.Types.ObjectId;
  unitNumber: string;
  floor?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  rentAmount?: number;
  isOccupied: boolean;
  notes?: string;
  totalParkingSpots: number;
  parkingBays: any[];
  createdAt?: Date;
}

// ─── Main Property Interface ──────────────────────────────────────────────────
export interface IProperty {
  landlordId: mongoose.Types.ObjectId;

  // Basic Details
  propertyImage?: string;
  propertyName: string;
  propertyType: PropertyType;
  tenure: Tenure;

  // Specifications
  squareFeet?: number;
  epcRating?: EPCRating;
  bedrooms?: number;
  bathrooms?: number;

  // Address Details
  streetAddress: string;
  city: string;
  county?: string;
  postcode: string;

  // Ownership Details
  ownershipEntity?: mongoose.Types.ObjectId | null;
  ownershipType?: OwnershipType;
  ownershipPercentage?: number;

  // Purchase Information
  purchaseDate?: Date;
  purchasePrice?: number;
  monthlyMortgagePayment?: number;

  // Additional Purchase Costs
  stampDutyLandTax?: number;
  legalFees?: number;
  agentFees?: number;
  initialRefurbishment?: number;

  // Management Details
  managementFeePercentage?: number;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  companyAgencyName?: string;

  // Insurance Details
  // Insurance Details
  insuranceProvider?: string;
  policyNumber?: string;
  annualPremium?: number;
  coverageAmount?: number;
  insuranceStartDate?: Date;
  renewalDate?: Date;

  // Additional
  propertyNotes?: string;
  metadata?: {
    gateCode?: string;
  };

  // Compliance Expiry Dates
  gasSafetyExpiry?: Date | null;
  electricalSafetyExpiry?: Date | null;
  smokeAlarmExpiry?: Date | null;
  hmoLicenceExpiry?: Date | null;
  hmoLicenceNumber?: string | null;
  hmoLicenceIssuingAuthority?: string | null;
  hmoLicenceIssueDate?: Date | null;
  hmoLicenceReminderLeadDays?: number;
  leaseEnd?: Date | null;

  // System
  units: IPropertyUnit[];
  isActive: boolean;
  marketplaceListingId?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPropertyDocument extends IProperty, Document {}

export interface IPropertyModel extends Model<IPropertyDocument> {
  findByLandlord(
    landlordId: string,
    filters?: { propertyType?: string; city?: string; isActive?: boolean }
  ): Promise<IPropertyDocument[]>;
}

// ─── Unit Sub-schema ──────────────────────────────────────────────────────────
const unitSchema = new mongoose.Schema<IPropertyUnit>(
  {
    unitNumber: {
      type: String,
      required: [true, 'Unit number is required'],
      trim: true,
    },
    floor: { type: String, trim: true },
    bedrooms: { type: Number, min: [0, 'Bedrooms cannot be negative'] },
    bathrooms: { type: Number, min: [0, 'Bathrooms cannot be negative'] },
    squareFeet: { type: Number, min: [0, 'Square feet cannot be negative'] },
    rentAmount: { type: Number, min: [0, 'Rent cannot be negative'] },
    isOccupied: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: [500, 'Notes cannot exceed 500 characters'] },
    totalParkingSpots: { type: Number, default: 0 },
    parkingBays: { type: [], default: [] },
  },
  { timestamps: true }
);

// ─── Property Schema ──────────────────────────────────────────────────────────
const propertySchema = new mongoose.Schema<IPropertyDocument, IPropertyModel>(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Landlord ID is required'],
      index: true,
    },

    // ── Basic Details ──────────────────────────────────────────────────────
    propertyImage: {
      type: String,
      default: null,
    },
    propertyName: {
      type: String,
      required: [true, 'Property name is required'],
      trim: true,
      maxlength: [150, 'Property name cannot exceed 150 characters'],
    },
    propertyType: {
      type: String,
      enum: {
        values: [
          'detached_house',
          'semi_detached_house',
          'terraced_house',
          'flat_apartment',
          'bungalow',
          'maisonette',
          'studio',
          'hmo',
          'commercial',
          'other',
        ],
        message: 'Invalid property type',
      },
      required: [true, 'Property type is required'],
    },
    tenure: {
      type: String,
      enum: {
        values: ['freehold', 'leasehold', 'share_of_freehold'],
        message: 'Tenure must be freehold, leasehold, or share_of_freehold',
      },
      required: [true, 'Tenure is required'],
    },

    // ── Specifications ─────────────────────────────────────────────────────
    squareFeet: { type: Number, min: [0, 'Square feet cannot be negative'] },
    epcRating: {
      type: String,
      enum: { values: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], message: 'Invalid EPC rating' },
    },
    bedrooms: { type: Number, min: [0, 'Bedrooms cannot be negative'] },
    bathrooms: { type: Number, min: [0, 'Bathrooms cannot be negative'] },

    // ── Address Details ────────────────────────────────────────────────────
    streetAddress: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true,
      maxlength: [200, 'Street address cannot exceed 200 characters'],
    },
    city: {
      type: String,
      required: [true, 'City/Town is required'],
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters'],
    },
    county: { type: String, trim: true, maxlength: [100, 'County cannot exceed 100 characters'] },
    postcode: {
      type: String,
      required: [true, 'Postcode is required'],
      trim: true,
      uppercase: true,
      maxlength: [10, 'Postcode cannot exceed 10 characters'],
    },

    // ── Ownership Details ──────────────────────────────────────────────────
    ownershipEntity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OwnershipEntity',
      default: null,
    },
    ownershipType: {
      type: String,
      enum: {
        values: ['personal', 'sole', 'joint', 'company', 'trust'],
        message: 'Invalid ownership type',
      },
    },
    ownershipPercentage: {
      type: Number,
      min: [0.01, 'Ownership percentage must be > 0'],
      max: [100, 'Ownership percentage cannot exceed 100'],
    },

    // ── Purchase Information ───────────────────────────────────────────────
    purchaseDate: { type: Date },
    purchasePrice: { type: Number, min: [0, 'Purchase price cannot be negative'] },
    monthlyMortgagePayment: { type: Number, min: [0, 'Mortgage payment cannot be negative'] },

    // ── Additional Purchase Costs ──────────────────────────────────────────
    stampDutyLandTax: { type: Number, min: [0, 'SDLT cannot be negative'] },
    legalFees: { type: Number, min: [0, 'Legal fees cannot be negative'] },
    agentFees: { type: Number, min: [0, 'Agent fees cannot be negative'] },
    initialRefurbishment: { type: Number, min: [0, 'Refurbishment cost cannot be negative'] },

    // ── Management Details ─────────────────────────────────────────────────
    managementFeePercentage: {
      type: Number,
      min: [0, 'Management fee cannot be negative'],
      max: [100, 'Management fee cannot exceed 100%'],
    },
    agentName: { type: String, trim: true, maxlength: [100, 'Agent name cannot exceed 100 characters'] },
    agentPhone: { type: String, trim: true, maxlength: [20, 'Agent phone cannot exceed 20 characters'] },
    agentEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid agent email'],
    },
    companyAgencyName: { type: String, trim: true, maxlength: [150, 'Company name cannot exceed 150 characters'] },

    // ── Insurance Details ──────────────────────────────────────────────────
    insuranceProvider: { type: String, trim: true, maxlength: [100, 'Insurance provider cannot exceed 100 characters'] },
    policyNumber: { type: String, trim: true, maxlength: [50, 'Policy number cannot exceed 50 characters'] },
    annualPremium: { type: Number, min: [0, 'Annual premium cannot be negative'] },
    coverageAmount: { type: Number, min: [0, 'Coverage amount cannot be negative'] },
    insuranceStartDate: { type: Date },
    renewalDate: { type: Date },

    // ── Additional ─────────────────────────────────────────────────────────
    propertyNotes: { type: String, trim: true, maxlength: [2000, 'Notes cannot exceed 2000 characters'] },
    metadata: {
      gateCode: { type: String, trim: true, maxlength: [20, 'Gate code cannot exceed 20 characters'] },
    },

    // Compliance Expiry Dates
    gasSafetyExpiry: { type: Date, default: null },
    electricalSafetyExpiry: { type: Date, default: null },
    smokeAlarmExpiry: { type: Date, default: null },
    hmoLicenceExpiry: { type: Date, default: null },
    hmoLicenceNumber: { type: String, default: null },
    hmoLicenceIssuingAuthority: { type: String, default: null },
    hmoLicenceIssueDate: { type: Date, default: null },
    hmoLicenceReminderLeadDays: { type: Number, default: 60 },
    leaseEnd: { type: Date, default: null },

    // ── System ────────────────────────────────────────────────────────────
    units: { type: [unitSchema], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    marketplaceListingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MarketplaceListing',
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

// ─── Indexes ──────────────────────────────────────────────────────────────────
propertySchema.index({ landlordId: 1, isActive: 1, createdAt: -1 });
propertySchema.index({ city: 1, propertyType: 1 });
propertySchema.index({ postcode: 1 });

// ─── Static Methods ───────────────────────────────────────────────────────────
propertySchema.statics.findByLandlord = async function (
  landlordId: string,
  filters: { propertyType?: string; city?: string; isActive?: boolean } = {}
) {
  const query: Record<string, unknown> = { landlordId, isActive: filters.isActive ?? true };
  if (filters.propertyType) query.propertyType = filters.propertyType;
  if (filters.city) query.city = new RegExp(filters.city, 'i');
  return this.find(query).sort({ createdAt: -1 });
};

// ─── Export ───────────────────────────────────────────────────────────────────
const Property = mongoose.model<IPropertyDocument, IPropertyModel>('Property', propertySchema);

export default Property;
