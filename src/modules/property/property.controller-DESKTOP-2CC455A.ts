/**
 * Property Controller
 * HTTP request handlers for all property management endpoints
 * Handles multipart/form-data (image upload) and JSON requests
 */

import type { Request, Response } from 'express';
import Joi from 'joi';
import * as propertyService from './property.service';
import * as propertyValidation from './property.validation';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import { getFileUrl } from '../../middlewares/upload.middleware';

// ─── Validation Helper ────────────────────────────────────────────────────────
const validateBody = <T>(schema: Joi.Schema, body: unknown): T => {
  const { error, value } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((d) => d.message);
    throw ApiError.badRequest('Validation failed', errors);
  }

  return value as T;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getLandlordId = (req: Request): string => {
  const id = req.user?._id?.toString();
  if (!id) throw ApiError.unauthorized('User not authenticated');
  return id;
};

// ─── POST /api/v1/properties ──────────────────────────────────────────────────
/**
 * Create a new property.
 * Accepts multipart/form-data — all fields sent as form fields, image as file.
 */
export const createProperty = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);

  // Parse numeric/boolean/array fields from form-data strings
  const bodyParsed = parseFormDataBody(req.body);

  const input = validateBody<propertyValidation.CreatePropertyInput>(
    propertyValidation.createPropertySchema,
    bodyParsed
  );

  // Get image URL if uploaded
  const imageUrl = req.file ? getFileUrl(req, req.file) : undefined;

  const property = await propertyService.createProperty(input, landlordId, imageUrl);

  res.status(201).json(
    ApiResponse.created('Property created successfully', {
      property: formatProperty(property),
    })
  );
});

// ─── GET /api/v1/properties ───────────────────────────────────────────────────
export const getMyProperties = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);

  const query = validateBody<propertyValidation.GetPropertiesQuery>(
    propertyValidation.getPropertiesSchema,
    req.query
  );

  const { properties, meta } = await propertyService.getMyProperties(landlordId, query);

  res.status(200).json(
    ApiResponse.ok(
      'Properties retrieved successfully',
      properties.map(formatProperty),
      meta
    )
  );
});

// ─── GET /api/v1/properties/summary ──────────────────────────────────────────
/**
 * Returns minimal property+unit list for tenant invite dropdown
 */
export const getPropertySummary = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  const summary = await propertyService.getPropertySummaryList(landlordId);
  res.status(200).json(ApiResponse.ok('Property summary retrieved', summary));
});

// ─── GET /api/v1/properties/:id/current-tenants ───────────────────────────────
/**
 * Returns all current (accepted/active) tenants for a property
 */
export const getCurrentTenants = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  const result = await propertyService.getCurrentTenants(req.params.id, landlordId);

  res.status(200).json(
    ApiResponse.ok('Current tenants retrieved successfully', result)
  );
});

// ─── GET /api/v1/properties/:id ───────────────────────────────────────────────
export const getPropertyById = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  const property = await propertyService.getPropertyById(req.params.id, landlordId);
  res.status(200).json(ApiResponse.ok('Property retrieved successfully', formatProperty(property)));
});

// ─── PATCH /api/v1/properties/:id ────────────────────────────────────────────
export const updateProperty = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);

  const bodyParsed = parseFormDataBody(req.body);

  const input = validateBody<propertyValidation.UpdatePropertyInput>(
    propertyValidation.updatePropertySchema,
    bodyParsed
  );

  const imageUrl = req.file ? getFileUrl(req, req.file) : undefined;

  const property = await propertyService.updateProperty(
    req.params.id,
    landlordId,
    input,
    imageUrl
  );

  res.status(200).json(
    ApiResponse.ok('Property updated successfully', {
      property: formatProperty(property),
    })
  );
});

// ─── DELETE /api/v1/properties/:id ───────────────────────────────────────────
export const deleteProperty = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  await propertyService.deleteProperty(req.params.id, landlordId);
  res.status(200).json(ApiResponse.ok('Property deleted successfully'));
});

// ─── POST /api/v1/properties/:id/units ───────────────────────────────────────
export const addUnit = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);

  const input = validateBody<propertyValidation.AddUnitInput>(
    propertyValidation.addUnitSchema,
    req.body
  );

  const property = await propertyService.addUnit(req.params.id, landlordId, input);

  // Return the newly added unit
  const newUnit = property.units[property.units.length - 1];

  res.status(201).json(
    ApiResponse.created('Unit added successfully', {
      propertyId: property._id,
      unit: newUnit,
    })
  );
});

// ─── DELETE /api/v1/properties/:propertyId/units/:unitId ─────────────────────
export const deleteUnit = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  const { propertyId, unitId } = req.params;

  const property = await propertyService.deleteUnit(propertyId, unitId, landlordId);

  res.status(200).json(
    ApiResponse.ok('Unit deleted successfully', {
      propertyId: property._id,
      remainingUnits: property.units.length,
    })
  );
});

// ─── Private Helpers ──────────────────────────────────────────────────────────

/**
 * Safely formats a property document for API response
 */
const formatProperty = (property: any) => ({
  id: property._id,
  propertyImage: property.propertyImage,
  propertyName: property.propertyName,
  propertyType: property.propertyType,
  tenure: property.tenure,
  squareFeet: property.squareFeet,
  epcRating: property.epcRating,
  bedrooms: property.bedrooms,
  bathrooms: property.bathrooms,
  address: {
    streetAddress: property.streetAddress,
    city: property.city,
    county: property.county,
    postcode: property.postcode,
  },
  ownership: {
    ownershipEntity: property.ownershipEntity,
    ownershipType: property.ownershipType,
    ownershipPercentage: property.ownershipPercentage,
  },
  purchase: {
    purchaseDate: property.purchaseDate,
    purchasePrice: property.purchasePrice,
    monthlyMortgagePayment: property.monthlyMortgagePayment,
  },
  additionalCosts: {
    stampDutyLandTax: property.stampDutyLandTax,
    legalFees: property.legalFees,
    agentFees: property.agentFees,
    initialRefurbishment: property.initialRefurbishment,
    totalAdditionalCost:
      (property.stampDutyLandTax ?? 0) +
      (property.legalFees ?? 0) +
      (property.agentFees ?? 0) +
      (property.initialRefurbishment ?? 0),
  },
  management: {
    managementFeePercentage: property.managementFeePercentage,
    agentName: property.agentName,
    agentPhone: property.agentPhone,
    agentEmail: property.agentEmail,
    companyAgencyName: property.companyAgencyName,
  },
  insurance: {
    insuranceProvider: property.insuranceProvider,
    policyNumber: property.policyNumber,
    annualPremium: property.annualPremium,
    coverageAmount: property.coverageAmount,
    insuranceStartDate: property.insuranceStartDate,
    renewalDate: property.renewalDate,
  },
  propertyNotes: property.propertyNotes,
  units: property.units,
  totalUnits: property.units?.length ?? 0,
  occupiedUnits: property.units?.filter((u: any) => u.isOccupied).length ?? 0,
  isActive: property.isActive,
  createdAt: property.createdAt,
  updatedAt: property.updatedAt,
});

/**
 * Parse form-data string fields into proper types (number, boolean, array, object)
 * Multer sends everything as strings — we need to convert before Joi validation
 */
const parseFormDataBody = (body: Record<string, unknown>): Record<string, unknown> => {
  const numericFields = [
    'squareFeet', 'bedrooms', 'bathrooms', 'ownershipPercentage',
    'purchasePrice', 'monthlyMortgagePayment', 'stampDutyLandTax',
    'legalFees', 'agentFees', 'initialRefurbishment',
    'managementFeePercentage', 'annualPremium', 'coverageAmount',
  ];

  const parsed: Record<string, unknown> = { ...body };

  for (const field of numericFields) {
    if (parsed[field] !== undefined && parsed[field] !== '') {
      const num = Number(parsed[field]);
      parsed[field] = isNaN(num) ? parsed[field] : num;
    }
    if (parsed[field] === '') {
      delete parsed[field];
    }
  }

  // Parse units JSON string if sent as stringified JSON
  if (typeof parsed['units'] === 'string') {
    try {
      parsed['units'] = JSON.parse(parsed['units'] as string);
    } catch {
      // Leave as is, Joi will handle validation error
    }
  }

  return parsed;
};
