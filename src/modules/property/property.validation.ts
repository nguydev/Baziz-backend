/**
 * Property Validation Schemas
 * Joi-based validation for all property endpoints
 */

import Joi from 'joi';
import type { PropertyType, Tenure, EPCRating, OwnershipType } from './property.model';

// ─── Reusable field definitions ───────────────────────────────────────────────
const PROPERTY_TYPES: PropertyType[] = [
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
];

const TENURES: Tenure[] = ['freehold', 'leasehold', 'share_of_freehold'];
const EPC_RATINGS: EPCRating[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const OWNERSHIP_TYPES: OwnershipType[] = ['personal', 'sole', 'joint', 'company', 'trust'];

const optionalNonNegativeNumber = () => Joi.number().min(0).empty('').optional();
const optionalDate = () => Joi.date().iso().empty('').allow(null).optional();
const optionalObjectId = () =>
  Joi.string().trim().hex().length(24).empty('').allow(null).optional().messages({
    'string.hex': 'Ownership entity must be a valid ID',
    'string.length': 'Ownership entity must be a valid ID',
  });

// ─── Create Property Schema ───────────────────────────────────────────────────
export const createPropertySchema = Joi.object({
  // Basic Details
  propertyName: Joi.string().trim().required().max(150).messages({
    'string.empty': 'Property name is required',
    'string.max': 'Property name cannot exceed 150 characters',
  }),
  propertyType: Joi.string()
    .trim()
    .lowercase()
    .valid(...PROPERTY_TYPES)
    .required()
    .messages({
      'any.only': `Property type must be one of: ${PROPERTY_TYPES.join(', ')}`,
      'string.empty': 'Property type is required',
    }),
  tenure: Joi.string()
    .trim()
    .lowercase()
    .valid(...TENURES)
    .required()
    .messages({
      'any.only': 'Tenure must be: freehold, leasehold, or share_of_freehold',
      'string.empty': 'Tenure is required',
    }),

  // Specifications (optional)
  squareFeet: optionalNonNegativeNumber(),
  epcRating: Joi.string().trim().uppercase().empty('').valid(...EPC_RATINGS).optional().messages({
    'any.only': 'EPC Rating must be A, B, C, D, E, F, or G',
  }),
  bedrooms: Joi.number().integer().min(0).empty('').optional(),
  bathrooms: Joi.number().integer().min(0).empty('').optional(),

  // Address Details
  streetAddress: Joi.string().trim().required().max(200).messages({
    'string.empty': 'Street address is required',
  }),
  city: Joi.string().trim().required().max(100).messages({
    'string.empty': 'City/Town is required',
  }),
  county: Joi.string().trim().optional().max(100).allow(''),
  postcode: Joi.string().trim().required().max(10).uppercase().messages({
    'string.empty': 'Postcode is required',
  }),

  // Ownership Details (optional)
  ownershipEntity: optionalObjectId(),
  ownershipType: Joi.string().trim().lowercase().empty('').valid(...OWNERSHIP_TYPES).optional().messages({
    'any.only': 'Ownership type must be: personal, sole, joint, company, or trust',
  }),
  ownershipPercentage: Joi.number().min(0.01).max(100).empty('').optional(),

  // Purchase Information (optional)
  purchaseDate: optionalDate(),
  purchasePrice: optionalNonNegativeNumber(),
  monthlyMortgagePayment: optionalNonNegativeNumber(),

  // Additional Purchase Costs (optional)
  stampDutyLandTax: optionalNonNegativeNumber(),
  legalFees: optionalNonNegativeNumber(),
  agentFees: optionalNonNegativeNumber(),
  initialRefurbishment: optionalNonNegativeNumber(),

  // Management Details (optional)
  managementFeePercentage: Joi.number().min(0).max(100).empty('').optional(),
  agentName: Joi.string().trim().optional().max(100).allow(''),
  agentPhone: Joi.string().trim().optional().max(20).allow(''),
  agentEmail: Joi.string().email().lowercase().trim().optional().allow('').messages({
    'string.email': 'Please provide a valid agent email',
  }),
  companyAgencyName: Joi.string().trim().optional().max(150).allow(''),

  // Insurance Details (optional)
  insuranceProvider: Joi.string().trim().optional().max(100).allow(''),
  policyNumber: Joi.string().trim().optional().max(50).allow(''),
  annualPremium: optionalNonNegativeNumber(),
  coverageAmount: optionalNonNegativeNumber(),
  insuranceStartDate: optionalDate(),
  renewalDate: optionalDate(),

  // Compliance Expiry Dates
  gasSafetyExpiry: optionalDate(),
  electricalSafetyExpiry: optionalDate(),
  smokeAlarmExpiry: optionalDate(),
  hmoLicenceExpiry: optionalDate(),
  hmoLicenceNumber: Joi.string().trim().optional().max(60).allow(''),
  hmoLicenceIssuingAuthority: Joi.string().trim().optional().max(100).allow(''),
  hmoLicenceIssueDate: optionalDate(),
  hmoLicenceReminderLeadDays: Joi.number().integer().min(1).max(365).empty('').optional().default(60),
  leaseEnd: optionalDate(),

  // Additional
  propertyNotes: Joi.string().trim().optional().max(2000).allow(''),

  // Initial units (optional, can be added later)
  units: Joi.array()
    .items(
      Joi.object({
        unitNumber: Joi.string().trim().required().messages({
          'string.empty': 'Unit number is required',
        }),
        floor: Joi.string().trim().optional().allow(''),
        bedrooms: Joi.number().integer().min(0).optional(),
        bathrooms: Joi.number().integer().min(0).optional(),
        squareFeet: Joi.number().min(0).optional(),
        rentAmount: Joi.number().min(0).optional(),
        notes: Joi.string().trim().optional().max(500).allow(''),
      })
    )
    .optional(),
});

// ─── Update Property Schema (all optional) ────────────────────────────────────
export const updatePropertySchema = createPropertySchema.fork(
  Object.keys(createPropertySchema.describe().keys),
  (field) => field.optional()
);

// ─── Add Unit Schema ──────────────────────────────────────────────────────────
export const addUnitSchema = Joi.object({
  unitNumber: Joi.string().trim().required().messages({
    'string.empty': 'Unit number is required',
  }),
  floor: Joi.string().trim().optional().allow(''),
  bedrooms: Joi.number().integer().min(0).optional(),
  bathrooms: Joi.number().integer().min(0).optional(),
  squareFeet: Joi.number().min(0).optional(),
  rentAmount: Joi.number().min(0).optional(),
  notes: Joi.string().trim().optional().max(500).allow(''),
});

// ─── Get Properties Query Schema ──────────────────────────────────────────────
export const getPropertiesSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(10),
  propertyType: Joi.string().valid(...PROPERTY_TYPES).optional(),
  city: Joi.string().trim().optional(),
  isActive: Joi.boolean().optional().default(true),
});

// ─── Type Exports ─────────────────────────────────────────────────────────────
export type CreatePropertyInput = {
  propertyName: string;
  propertyType: PropertyType;
  tenure: Tenure;
  squareFeet?: number;
  epcRating?: EPCRating;
  bedrooms?: number;
  bathrooms?: number;
  streetAddress: string;
  city: string;
  county?: string;
  postcode: string;
  ownershipEntity?: string | null;
  ownershipType?: OwnershipType;
  ownershipPercentage?: number;
  purchaseDate?: Date;
  purchasePrice?: number;
  monthlyMortgagePayment?: number;
  stampDutyLandTax?: number;
  legalFees?: number;
  agentFees?: number;
  initialRefurbishment?: number;
  managementFeePercentage?: number;
  agentName?: string;
  agentPhone?: string;
  agentEmail?: string;
  companyAgencyName?: string;
  insuranceProvider?: string;
  policyNumber?: string;
  annualPremium?: number;
  coverageAmount?: number;
  insuranceStartDate?: Date;
  renewalDate?: Date;
  gasSafetyExpiry?: Date | null;
  electricalSafetyExpiry?: Date | null;
  smokeAlarmExpiry?: Date | null;
  hmoLicenceExpiry?: Date | null;
  hmoLicenceNumber?: string | null;
  hmoLicenceIssuingAuthority?: string | null;
  hmoLicenceIssueDate?: Date | null;
  hmoLicenceReminderLeadDays?: number;
  leaseEnd?: Date | null;
  propertyNotes?: string;
  units?: Array<{
    unitNumber: string;
    floor?: string;
    bedrooms?: number;
    bathrooms?: number;
    squareFeet?: number;
    rentAmount?: number;
    notes?: string;
  }>;
};

export type UpdatePropertyInput = Partial<CreatePropertyInput>;

export type AddUnitInput = {
  unitNumber: string;
  floor?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  rentAmount?: number;
  notes?: string;
};

export type GetPropertiesQuery = {
  page: number;
  limit: number;
  propertyType?: PropertyType;
  city?: string;
  isActive?: boolean;
};
