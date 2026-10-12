/**
 * Tenant Controller
 * Handles HTTP requests for tenant management endpoints
 */

import type { Request, Response, NextFunction } from 'express';
import * as tenantService from './tenant.service';
import * as tenantValidation from './tenant.validation';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import Joi from 'joi';

/**
 * Helper to validate request body
 */
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

/**
 * POST /api/v1/tenants/invite
 * Landlord invites new tenant
 */
export const inviteTenant = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const landlordId = req.user?._id.toString();
  if (!landlordId) {
    throw ApiError.unauthorized('User not authenticated');
  }

  const input = validateBody<tenantValidation.InviteTenantInput>(
    tenantValidation.inviteTenantSchema,
    req.body
  );

  const result = await tenantService.inviteTenant(input, landlordId);

  res.status(201).json(
    ApiResponse.created('Tenant invitation sent successfully', {
      leaseId: result.leaseId,
      status: result.status,
      invitationSentAt: result.invitationSentAt,
      invitationExpiresAt: result.invitationExpiresAt,
    })
  );
});

/**
 * POST /api/v1/tenants/accept-invitation/{leaseId}
 * Tenant accepts lease and creates account
 */
export const acceptLeaseInvitation = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { leaseId } = req.params;

    const input = validateBody<tenantValidation.AcceptLeaseInput>(
      tenantValidation.acceptLeaseSchema,
      req.body
    );

    const result = await tenantService.acceptLeaseInvitation(leaseId, input);

    res.status(201).json(
      ApiResponse.created('Signup successful. Please verify your email.', {
        user: result.user,
        session: result.session,
        _dev_otp: result._dev_otp,
      })
    );
  }
);

/**
 * GET /api/v1/tenants/my-lease
 * Tenant gets their own lease details with full property info
 */
export const getMyLease = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const tenantId = req.user?._id.toString();
  if (!tenantId) {
    throw ApiError.unauthorized('User not authenticated');
  }

  const lease = await tenantService.getMyLease(tenantId);

  if (!lease) {
    res.status(200).json(ApiResponse.ok('No active lease found', null));
    return;
  }

  const property = lease.propertyId as any;
  const landlord = lease.landlordId as any;

  // Find the specific unit from the populated property's units array
  const unit = property?.units?.find(
    (u: any) => u._id?.toString() === lease.unitId?.toString()
  );

  res.status(200).json(
    ApiResponse.ok('Lease details retrieved successfully', {
      // ── Lease Info ──────────────────────────────────────────
      leaseId: lease._id,
      status: lease.status,
      rentAmount: lease.rentAmount,
      securityDeposit: lease.securityDeposit,
      paymentFrequency: lease.paymentFrequency,
      paymentDueDay: lease.paymentDueDay,
      leaseStartDate: lease.leaseStartDate,
      leaseEndDate: lease.leaseEndDate,
      lastRentReviewDate: lease.lastRentReviewDate,
      assignedParkingBays: lease.assignedParkingBays,
      parkingNotes: lease.parkingNotes,
      acceptedAt: lease.acceptedAt,

      // ── Property Details ─────────────────────────────────────
      property: {
        propertyId: property?._id,
        propertyName: property?.propertyName,
        propertyType: property?.propertyType,
        propertyImage: property?.propertyImage ?? null,
        tenure: property?.tenure,
        // Address
        streetAddress: property?.streetAddress,
        city: property?.city,
        county: property?.county ?? null,
        postcode: property?.postcode,
        // Specs
        bedrooms: property?.bedrooms ?? null,
        bathrooms: property?.bathrooms ?? null,
        squareFeet: property?.squareFeet ?? null,
        epcRating: property?.epcRating ?? null,
        propertyNotes: property?.propertyNotes ?? null,
        metadata: property?.metadata ?? null,
      },

      // ── Unit Details ──────────────────────────────────────────
      unit: unit
        ? {
            unitId: unit._id,
            unitNumber: unit.unitNumber,
            floor: unit.floor ?? null,
            bedrooms: unit.bedrooms ?? null,
            bathrooms: unit.bathrooms ?? null,
            squareFeet: unit.squareFeet ?? null,
            notes: unit.notes ?? null,
            parkingBays: unit.parkingBays ?? [],
          }
        : null,

      // ── Landlord Details ──────────────────────────────────────
      landlord: {
        landlordId: landlord?._id,
        name: `${landlord?.firstName ?? ''} ${landlord?.lastName ?? ''}`.trim(),
        email: landlord?.email,
        phone: landlord?.phone ?? null,
      },
    })
  );
});

/**
 * GET /api/v1/tenants/my-tenants
 * Landlord gets all their tenants
 */
export const getMyTenants = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const landlordId = req.user?._id.toString();
  if (!landlordId) {
    throw ApiError.unauthorized('User not authenticated');
  }

  const query = validateBody<tenantValidation.GetTenantsQuery>(
    tenantValidation.getTenantsSchema,
    req.query
  );

  const result = await tenantService.getMyTenants(landlordId, query);

  res.status(200).json(
    ApiResponse.ok('Tenants retrieved successfully', {
      leases: result.leases,
      pagination: {
        total: result.total,
        limit: result.limit,
        skip: result.skip,
      },
    })
  );
});

/**
 * POST /api/v1/tenants/{leaseId}/resend-invitation
 * Landlord resends invitation email
 */
export const resendInvitation = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const landlordId = req.user?._id.toString();
    if (!landlordId) {
      throw ApiError.unauthorized('User not authenticated');
    }

    const { leaseId } = req.params;

    const result = await tenantService.resendInvitation(leaseId, landlordId);

    res.status(200).json(
      ApiResponse.ok(`Invitation email sent again to ${result.tenantEmail}`, {
        leaseId,
        invitationSentAt: result.invitationSentAt,
        invitationExpiresAt: result.invitationExpiresAt,
      })
    );
  }
);

/**
 * PUT /api/v1/properties/{propertyId}/units/{unitId}/parking
 * Update parking bays
 */
export const updateParkingBays = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const landlordId = req.user?._id.toString();
    if (!landlordId) {
      throw ApiError.unauthorized('User not authenticated');
    }

    const { propertyId, unitId } = req.params;

    const input = validateBody<tenantValidation.UpdateParkingBaysInput>(
      tenantValidation.updateParkingBaysSchema,
      req.body
    );

    const result = await tenantService.updateParkingBays(propertyId, unitId, landlordId, input);

    res.status(200).json(ApiResponse.ok('Parking bays updated successfully', result));
  }
);

/**
 * GET /api/v1/properties/{propertyId}/units/{unitId}
 * Get unit details with parking
 */
export const getUnitDetails = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const landlordId = req.user?._id.toString();
    if (!landlordId) {
      throw ApiError.unauthorized('User not authenticated');
    }

    const { propertyId, unitId } = req.params;

    const result = await tenantService.getUnitDetails(propertyId, unitId, landlordId);

    res.status(200).json(ApiResponse.ok('Unit details retrieved successfully', result));
  }
);

/**
 * GET /api/v1/tenants/lease-preview/:leaseId
 * Public — returns sanitized lease details for the tenant signup page
 */
export const getLeasePreview = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { leaseId } = req.params;

    if (!leaseId || leaseId.length < 20) {
      throw ApiError.badRequest('Invalid lease ID');
    }

    const result = await tenantService.getLeasePreview(leaseId);

    res.status(200).json(ApiResponse.ok('Lease preview retrieved', result));
  }
);

/**
 * POST /api/v1/properties/{propertyId}/units/{unitId}/parking/allocate
 * Landlord allocates parking bay to tenant
 */
export const allocateParkingBay = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const landlordId = req.user?._id.toString();
    if (!landlordId) {
      throw ApiError.unauthorized('User not authenticated');
    }

    const { propertyId, unitId } = req.params;
    const { bayNumber, leaseId } = req.body;

    if (!bayNumber || !leaseId) {
      throw ApiError.badRequest('bayNumber and leaseId are required');
    }

    const result = await tenantService.allocateParkingBay(propertyId, unitId, bayNumber, leaseId, landlordId);

    res.status(200).json(ApiResponse.ok('Parking bay allocated successfully', result));
  }
);

/**
 * POST /api/v1/properties/{propertyId}/units/{unitId}/parking/release
 * Landlord releases parking bay
 */
export const releaseParkingBay = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const landlordId = req.user?._id.toString();
    if (!landlordId) {
      throw ApiError.unauthorized('User not authenticated');
    }

    const { propertyId, unitId } = req.params;
    const { bayNumber } = req.body;

    if (!bayNumber) {
      throw ApiError.badRequest('bayNumber is required');
    }

    const result = await tenantService.releaseParkingBay(propertyId, unitId, bayNumber, landlordId);

    res.status(200).json(ApiResponse.ok('Parking bay released successfully', result));
  }
);

/**
 * PUT /api/v1/tenants/:leaseId
 * Landlord updates lease/tenant details
 */
export const updateTenantLease = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const landlordId = req.user?._id.toString();
    if (!landlordId) {
      throw ApiError.unauthorized('User not authenticated');
    }

    const { leaseId } = req.params;
    const result = await tenantService.updateTenantLease(leaseId, landlordId, req.body);

    res.status(200).json(ApiResponse.ok('Tenant lease updated successfully', result));
  }
);

/**
 * DELETE /api/v1/tenants/:leaseId
 * Landlord deletes lease/tenant
 */
export const deleteTenantLease = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const landlordId = req.user?._id.toString();
    if (!landlordId) {
      throw ApiError.unauthorized('User not authenticated');
    }

    const { leaseId } = req.params;
    const result = await tenantService.deleteTenantLease(leaseId, landlordId);

    res.status(200).json(ApiResponse.ok('Tenant deleted successfully', result));
  }
);
