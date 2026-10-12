import Joi from 'joi';
import type {
  BrowseJvQuery,
  BrowseListingsQuery,
  CreateInquiryInput,
  CreateJointVentureInput,
  CreateNewPropertyListingInput,
  CreatePortfolioListingInput,
  MediaUploadInput,
  UpdateJointVentureInput,
  UpdateListingInput,
  ValuationEstimateInput,
} from './marketplace.types';
import { ALLOWED_RADIUS_MILES } from './marketplace.query';

const UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})$/i;

const queryBoolean = Joi.boolean().truthy('true').falsy('false');

const rangeValidator = (
  minKey: string,
  maxKey: string,
  label: string
): Joi.CustomValidator => {
  return (value, helpers) => {
    const obj = value as Record<string, number | undefined>;
    const min = obj[minKey];
    const max = obj[maxKey];
    if (min !== undefined && max !== undefined && min > max) {
      return helpers.error('any.custom', {
        message: `${label} min must be less than or equal to max`,
      });
    }
    return value;
  };
};

const imageSchema = Joi.object({
  storagePath: Joi.string().trim().required(),
  url: Joi.string().uri().required(),
});

export const createPortfolioListingSchema = Joi.object<CreatePortfolioListingInput>({
  propertyId: Joi.string().required().messages({ 'any.required': 'Property ID is required' }),
  price: Joi.number().positive().required(),
  description: Joi.string().trim().min(20).max(5000).required(),
  isNegotiable: Joi.boolean().optional(),
  valuationRequested: Joi.boolean().optional(),
  image: imageSchema.optional(),
}).options({ stripUnknown: true });

export const createNewPropertyListingSchema = Joi.object<CreateNewPropertyListingInput>({
  title: Joi.string().trim().min(1).max(200).required(),
  type: Joi.string().trim().min(1).max(100).required(),
  tenure: Joi.string().trim().valid('freehold', 'leasehold', 'share_of_freehold').optional(),
  address: Joi.object({
    line1: Joi.string().trim().min(1).max(200).required(),
    city: Joi.string().trim().min(1).max(100).required(),
    postCode: Joi.string().trim().uppercase().pattern(UK_POSTCODE).required().messages({
      'string.pattern.base': 'Post code must be a valid UK format',
    }),
    country: Joi.string().trim().max(100).optional(),
  }).required(),
  specs: Joi.object({
    sqft: Joi.number().min(0).optional(),
    bedrooms: Joi.number().integer().min(0).optional(),
    bathrooms: Joi.number().min(0).optional(),
    epcRating: Joi.string().trim().valid('A', 'B', 'C', 'D', 'E', 'F', 'G').optional(),
  }).optional(),
  price: Joi.number().positive().required(),
  yield: Joi.number().min(0).max(100).optional(),
  description: Joi.string().trim().min(20).max(5000).required(),
  isNegotiable: Joi.boolean().optional(),
  image: imageSchema.optional(),
}).options({ stripUnknown: true });

export const createJointVentureSchema = Joi.object<CreateJointVentureInput>({
  title: Joi.string().trim().min(1).max(200).required(),
  projectType: Joi.string().trim().min(1).max(100).required(),
  investmentModel: Joi.string().trim().min(1).max(100).required(),
  risk: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').required(),
  location: Joi.string().trim().min(1).max(300).required(),
  description: Joi.string().trim().min(20).max(5000).required(),
  exitStrategy: Joi.string().trim().min(10).max(2000).required(),
  financials: Joi.object({
    totalProjectCost: Joi.number().positive().required(),
    investmentNeeded: Joi.number().positive().required(),
    expectedReturn: Joi.number().min(0).max(200).required(),
    timeline: Joi.string().trim().min(1).max(100).required(),
  })
    .required()
    .custom((value, helpers) => {
      if (value.investmentNeeded > value.totalProjectCost) {
        return helpers.error('any.custom', {
          message: 'Investment needed cannot exceed total project cost',
        });
      }
      return value;
    }),
  image: imageSchema.optional(),
}).options({ stripUnknown: true });

export const updateListingSchema = Joi.object<UpdateListingInput>({
  price: Joi.number().positive().optional(),
  description: Joi.string().trim().min(20).max(5000).optional(),
  isNegotiable: Joi.boolean().optional(),
  yield: Joi.number().min(0).max(100).optional(),
  image: imageSchema.optional(),
  status: Joi.string().valid('draft', 'pending_review', 'published', 'sold', 'removed').optional(),
})
  .min(1)
  .options({ stripUnknown: true });

export const updateJointVentureSchema = Joi.object<UpdateJointVentureInput>({
  title: Joi.string().trim().min(1).max(200).optional(),
  projectType: Joi.string().trim().min(1).max(100).optional(),
  investmentModel: Joi.string().trim().min(1).max(100).optional(),
  risk: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').optional(),
  location: Joi.string().trim().min(1).max(300).optional(),
  description: Joi.string().trim().min(20).max(5000).optional(),
  exitStrategy: Joi.string().trim().min(10).max(2000).optional(),
  financials: Joi.object({
    totalProjectCost: Joi.number().positive().optional(),
    investmentNeeded: Joi.number().positive().optional(),
    expectedReturn: Joi.number().min(0).max(200).optional(),
    timeline: Joi.string().trim().min(1).max(100).optional(),
  }).optional(),
  image: imageSchema.optional(),
  status: Joi.string().valid('draft', 'published', 'closed', 'removed').optional(),
})
  .min(1)
  .options({ stripUnknown: true });

export const browseListingsSchema = Joi.object<BrowseListingsQuery>({
  search: Joi.string().trim().max(200).optional(),
  type: Joi.string().trim().max(100).optional(),
  location: Joi.string().trim().max(300).optional(),
  radiusMiles: Joi.number()
    .valid(...ALLOWED_RADIUS_MILES)
    .optional(),
  priceMin: Joi.number().min(0).optional(),
  priceMax: Joi.number().min(0).optional(),
  yieldMin: Joi.number().min(0).max(100).optional(),
  yieldMax: Joi.number().min(0).max(100).optional(),
  savedOnly: queryBoolean.optional(),
  sort: Joi.string()
    .valid('newest', 'oldest', 'price_asc', 'price_desc', 'yield_desc', 'yield_asc')
    .optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
})
  .custom(rangeValidator('priceMin', 'priceMax', 'Price'))
  .custom(rangeValidator('yieldMin', 'yieldMax', 'Yield'))
  .options({ stripUnknown: true });

export const browseJvSchema = Joi.object<BrowseJvQuery>({
  search: Joi.string().trim().max(200).optional(),
  risk: Joi.string().valid('LOW', 'MEDIUM', 'HIGH').optional(),
  projectType: Joi.string().trim().max(100).optional(),
  location: Joi.string().trim().max(300).optional(),
  investmentMin: Joi.number().min(0).optional(),
  investmentMax: Joi.number().min(0).optional(),
  savedOnly: queryBoolean.optional(),
  sort: Joi.string()
    .valid(
      'newest',
      'oldest',
      'investment_asc',
      'investment_desc',
      'return_desc',
      'return_asc'
    )
    .optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(50).optional(),
})
  .custom(rangeValidator('investmentMin', 'investmentMax', 'Investment'))
  .options({ stripUnknown: true });

export const valuationEstimateSchema = Joi.object<ValuationEstimateInput>({
  propertyId: Joi.string().required(),
}).options({ stripUnknown: true });

export const mediaUploadSchema = Joi.object<MediaUploadInput>({
  fileName: Joi.string().trim().min(1).max(255).required(),
  mimeType: Joi.string()
    .valid('image/jpeg', 'image/png', 'image/webp')
    .required(),
  sizeBytes: Joi.number().integer().min(1).max(10 * 1024 * 1024).required(),
  context: Joi.string().valid('listing', 'jv').required(),
}).options({ stripUnknown: true });

export const createInquirySchema = Joi.object<CreateInquiryInput>({
  message: Joi.string().trim().min(10).max(2000).required(),
  contactEmail: Joi.string().trim().email().optional(),
  contactPhone: Joi.string().trim().max(20).optional(),
}).options({ stripUnknown: true });

export const savedToggleSchema = Joi.object({
  type: Joi.string().valid('listing', 'joint_venture').required(),
}).options({ stripUnknown: true });

export const getPropertiesMineSchema = Joi.object({
  excludeListed: Joi.boolean().optional(),
}).options({ stripUnknown: true });
