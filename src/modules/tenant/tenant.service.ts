/**
 * Tenant Service
 * Handles all tenant management business logic with transactions
 * Implements: invite tenant, accept lease, list tenants, resend invitation
 */

import mongoose from "mongoose";
import User, { IUserDocument } from "../user/user.model";
import tenantModels from "./tenant.model";
import Property from "../property/property.model";
import type { ILeaseAgreementDocument } from "./tenant.model";
import RentPayment from "../rent-payment/rent-payment.model";
import ApiError from "../../utils/ApiError";
import logger from "../../config/logger";
import type {
  InviteTenantInput,
  AcceptLeaseInput,
  UpdateParkingBaysInput,
  GetTenantsQuery,
} from "./tenant.validation";
import { sendTenantInvitationEmail } from "../../utils/sendEmail";
import { generateTokenPair, TokenPair } from "../../utils/tokenManager";
import {
  LeaseStatus,
  INVITATION_EXPIRY_DAYS,
  LEASE_STATUS_PENDING,
} from "./tenant.constants";
import type {
  InviteTenantResponse,
  AcceptLeaseResponse,
  GetTenantsResponse,
  ResendInvitationResponse,
  UpdateParkingBaysResponse,
  GetUnitDetailsResponse,
  LeaseFilterOptions,
  TenantInvitationEmailData,
} from "./tenant.types";

const { LeaseAgreement } = tenantModels;

/**
 * Calculate invitation expiry date
 */
const calculateInvitationExpiry = (): Date => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + INVITATION_EXPIRY_DAYS);
  return expiry;
};

/**
 * Check if invitation is expired
 */
const isInvitationExpired = (expiresAt: Date): boolean => {
  return expiresAt < new Date();
};

/**
 * Validate lease dates
 */
const validateLeaseDates = (startDate: Date, endDate: Date): void => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  if (start < now) {
    throw ApiError.badRequest(
      "Lease start date cannot be in the past. Today or future date is required.",
    );
  }

  if (new Date(endDate) <= new Date(startDate)) {
    throw ApiError.badRequest("Lease end date must be after start date");
  }
};

/**
 * Invite new tenant (Landlord action)
 */
export const inviteTenant = async (
  input: InviteTenantInput,
  landlordId: string,
): Promise<InviteTenantResponse> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate landlord exists
    const landlord = await User.findById(landlordId).session(session);
    if (!landlord) {
      throw ApiError.unauthorized("Landlord not found");
    }

    if (landlord.role !== "landlord") {
      throw ApiError.forbidden("Only landlord can invite tenants");
    }

    // Validate landlord email != tenant email
    if (landlord.email.toLowerCase() === input.tenantEmail.toLowerCase()) {
      throw ApiError.badRequest(
        "Tenant email cannot be same as landlord email",
      );
    }

    // Validate property exists and belongs to landlord
    const property = await Property.findById(input.propertyId).session(session);
    if (!property) {
      throw ApiError.notFound("Property not found");
    }

    if (property.landlordId.toString() !== landlordId) {
      throw ApiError.forbidden("You do not own this property");
    }

    // Validate unit exists in property
    const unit = property.units.find(
      (u: any) => u._id?.toString() === input.unitId,
    );
    if (!unit) {
      throw ApiError.notFound("Unit not found in this property");
    }

    // Validate lease dates
    validateLeaseDates(input.leaseStartDate, input.leaseEndDate);

    // Check if there is already an accepted or active lease for this unit
    const existingConfirmedLease = await LeaseAgreement.findOne({
      propertyId: input.propertyId,
      unitId: input.unitId,
      status: { $in: [LeaseStatus.ACCEPTED, LeaseStatus.ACTIVE] },
    }).session(session);

    if (existingConfirmedLease) {
      // Self-healing: Check if the associated tenant user still exists in DB
      let tenantExists = false;
      if (existingConfirmedLease.tenantId) {
        const tenantUser = await User.findById(
          existingConfirmedLease.tenantId,
        ).session(session);
        if (tenantUser) {
          tenantExists = true;
        }
      }

      if (tenantExists) {
        throw ApiError.conflict(
          "An active lease agreement already exists for this unit.",
        );
      } else {
        // If tenant user is deleted, the lease is orphaned. Auto clean up!
        await LeaseAgreement.deleteMany({
          propertyId: input.propertyId,
          unitId: input.unitId,
        }).session(session);
      }
    }

    // Clean up any older pending invitations on this unit before creating a new one
    await LeaseAgreement.deleteMany({
      propertyId: input.propertyId,
      unitId: input.unitId,
      status: LeaseStatus.PENDING_ACCEPTANCE,
    }).session(session);

    // Create LeaseAgreement
    const invitationExpiresAt = calculateInvitationExpiry();

    const leaseAgreement = new LeaseAgreement({
      propertyId: input.propertyId,
      unitId: input.unitId,
      landlordId,
      tenantEmail: input.tenantEmail,
      tenantFullName: input.tenantFullName,
      tenantPhone: input.tenantPhone,
      rentAmount: input.rentAmount,
      securityDeposit: input.securityDeposit,
      paymentFrequency: input.paymentFrequency,
      paymentDueDay: input.paymentDueDay,
      leaseStartDate: input.leaseStartDate,
      leaseEndDate: input.leaseEndDate,
      lastRentReviewDate: input.lastRentReviewDate || null,
      assignedParkingBays: input.parkingBayNumbers || [],
      parkingNotes: input.parkingNotes || null,
      status: LeaseStatus.PENDING_ACCEPTANCE,
      invitationSentAt: new Date(),
      invitationExpiresAt,
    });

    await leaseAgreement.save({ session });
    await property.save({ session });
    await session.commitTransaction();

    // Send invitation email (outside transaction)
    try {
      const emailData: TenantInvitationEmailData = {
        leaseId: leaseAgreement._id.toString(),
        propertyName: property.propertyName,
        unitNumber: unit.unitNumber,
        rentAmount: input.rentAmount,
        leaseStartDate: input.leaseStartDate,
        leaseEndDate: input.leaseEndDate,
        invitationExpiresAt,
      };

      await sendTenantInvitationEmail(
        input.tenantEmail,
        input.tenantFullName,
        emailData,
      );
    } catch (err) {
      logger.error(
        `Failed to send invitation email: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      // Don't throw error - email failure shouldn't block lease creation
    }

    logger.info(
      `Tenant invited: ${input.tenantEmail} for property ${property.propertyName}`,
    );

    return {
      leaseId: leaseAgreement._id.toString(),
      status: LeaseStatus.PENDING_ACCEPTANCE,
      invitationSentAt: leaseAgreement.invitationSentAt,
      invitationExpiresAt,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
};

/**
 * Accept lease invitation and create tenant account
 */
export const acceptLeaseInvitation = async (
  leaseId: string,
  input: AcceptLeaseInput,
): Promise<AcceptLeaseResponse> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find lease agreement
    const lease = await LeaseAgreement.findById(leaseId).session(session);
    if (!lease) {
      throw ApiError.notFound("Lease invitation not found");
    }

    // Check if invitation is expired
    if (isInvitationExpired(lease.invitationExpiresAt)) {
      throw ApiError.badRequest(
        `Invitation expired on ${lease.invitationExpiresAt.toLocaleDateString()}. Please ask landlord to resend.`,
      );
    }

    // Check email matches
    if (input.email.toLowerCase() !== lease.tenantEmail.toLowerCase()) {
      throw ApiError.badRequest("Email does not match lease invitation");
    }

    // Check lease status
    if (!LEASE_STATUS_PENDING.includes(lease.status as any)) {
      throw ApiError.badRequest(
        "This lease invitation has already been accepted or is invalid",
      );
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email: input.email }).session(
      session,
    );
    if (existingUser) {
      throw ApiError.conflict("User with this email already exists");
    }

    // Clean up any conflicting lease agreements on this unit before accepting
    // to resolve database 409 unique key constraints gracefully.
    await LeaseAgreement.deleteMany({
      _id: { $ne: lease._id },
      propertyId: lease.propertyId,
      unitId: lease.unitId,
      status: {
        $in: [
          LeaseStatus.PENDING_ACCEPTANCE,
          LeaseStatus.ACCEPTED,
          LeaseStatus.ACTIVE,
        ],
      },
    }).session(session);

    const user = new User({
      firstName: input.firstName,
      email: input.email,
      password: input.password,
      role: "tenant",
      authProvider: "email",
      isVerified: false,
      isProfileCompleted: false,
    });

    await user.save({ session });

    // Update lease agreement
    lease.tenantId = user._id as any;
    lease.status = LeaseStatus.ACCEPTED;
    await lease.save({ session });

    await session.commitTransaction();

    // Generate tokens
    const tokens = generateTokenPair(user._id.toString(), user.role, false);

    logger.info(`Tenant accepted lease: ${input.email}`);

    return {
      user: {
        id: user._id,
        firstName: user.firstName,
        email: user.email,
        role: user.role,
      },
      session: tokens,
      _dev_otp: process.env.NODE_ENV === "development" ? "123456" : undefined,
    };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
};

/**
 * Get tenant's own lease details with full property info
 */
export const getMyLease = async (
  tenantId: string,
): Promise<ILeaseAgreementDocument | null> => {
  const lease = await LeaseAgreement.findOne({
    tenantId,
    status: { $ne: LeaseStatus.ENDED },
  })
    .populate("landlordId", "firstName lastName email phone")
    .populate(
      "propertyId",
      "propertyName propertyType propertyImage streetAddress city county postcode tenure squareFeet epcRating bedrooms bathrooms units propertyNotes",
    );

  if (!lease) {
    return null;
  }

  return lease;
};

/**
 * Get public lease preview (for tenant signup page — no auth required)
 * Returns only non-sensitive lease details needed to show the invitation details
 */
export const getLeasePreview = async (
  leaseId: string,
): Promise<{
  propertyName: string;
  unitNumber: string;
  rentAmount: number;
  securityDeposit: number;
  paymentFrequency: string;
  leaseStartDate: Date;
  leaseEndDate: Date;
  invitationExpiresAt: Date;
  isExpired: boolean;
  tenantEmail: string;
  tenantFullName: string;
  status: string;
}> => {
  const lease = await LeaseAgreement.findById(leaseId)
    .populate("propertyId", "propertyName propertyImage city postcode")
    .lean();

  if (!lease) {
    throw ApiError.notFound("Lease invitation not found");
  }

  const property = lease.propertyId as any;
  const unit = property?.units?.find(
    (u: any) => u._id?.toString() === lease.unitId?.toString(),
  );

  return {
    propertyName: property?.propertyName || "Property",
    unitNumber: unit?.unitNumber || "—",
    rentAmount: lease.rentAmount,
    securityDeposit: lease.securityDeposit,
    paymentFrequency: lease.paymentFrequency,
    leaseStartDate: lease.leaseStartDate,
    leaseEndDate: lease.leaseEndDate,
    invitationExpiresAt: lease.invitationExpiresAt,
    isExpired: lease.invitationExpiresAt < new Date(),
    tenantEmail: lease.tenantEmail,
    tenantFullName: lease.tenantFullName,
    status: lease.status,
  };
};

/**
 * Get all tenants for landlord
 */
export const getMyTenants = async (
  landlordId: string,
  query: GetTenantsQuery,
): Promise<GetTenantsResponse> => {
  // Build filter with proper typing
  const filter: LeaseFilterOptions & Record<string, any> = {
    landlordId,
    limit: query.limit,
    skip: query.skip,
  };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.propertyId) {
    filter.propertyId = query.propertyId;
  }

  // Get total count
  const countQuery: any = { landlordId };
  if (query.status) countQuery.status = query.status;
  if (query.propertyId) countQuery.propertyId = query.propertyId;

  const total = await LeaseAgreement.countDocuments(countQuery);

  // Get leases
  const findQuery: any = { landlordId };
  if (query.status) findQuery.status = query.status;
  if (query.propertyId) findQuery.propertyId = query.propertyId;

  const leases = await LeaseAgreement.find(findQuery)
    .populate("landlordId", "firstName lastName email")
    .sort({ createdAt: -1 })
    .limit(query.limit)
    .skip(query.skip);

  return {
    leases,
    total,
    limit: query.limit,
    skip: query.skip,
  };
};

/**
 * Resend invitation email to tenant
 */
export const resendInvitation = async (
  leaseId: string,
  landlordId: string,
): Promise<ResendInvitationResponse> => {
  // Find lease
  const lease = await LeaseAgreement.findById(leaseId);
  if (!lease) {
    throw ApiError.notFound("Lease not found");
  }

  // Verify landlord owns this lease
  if (lease.landlordId.toString() !== landlordId) {
    throw ApiError.forbidden(
      "You do not have permission to resend this invitation",
    );
  }

  // Check status is pending
  if (!LEASE_STATUS_PENDING.includes(lease.status as any)) {
    throw ApiError.badRequest("Can only resend invitations for pending leases");
  }

  // Get property for details
  const property = await Property.findById(lease.propertyId);
  if (!property) {
    throw ApiError.notFound("Property not found");
  }

  // Get unit for details
  const unit = property.units.find(
    (u: any) => u._id?.toString() === lease.unitId.toString(),
  );
  if (!unit) {
    throw ApiError.notFound("Unit not found");
  }

  // Update expiry
  const newExpiryDate = calculateInvitationExpiry();
  lease.invitationSentAt = new Date();
  lease.invitationExpiresAt = newExpiryDate;
  await lease.save();

  // Send email
  try {
    const emailData: TenantInvitationEmailData = {
      leaseId: lease._id.toString(),
      propertyName: property.propertyName,
      unitNumber: unit.unitNumber,
      rentAmount: lease.rentAmount,
      leaseStartDate: lease.leaseStartDate,
      leaseEndDate: lease.leaseEndDate,
      invitationExpiresAt: newExpiryDate,
    };

    await sendTenantInvitationEmail(
      lease.tenantEmail,
      lease.tenantFullName,
      emailData,
    );
  } catch (err) {
    logger.error(
      `Failed to resend invitation email: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
    throw ApiError.internal("Failed to send invitation email");
  }

  logger.info(`Invitation resent to: ${lease.tenantEmail}`);

  return {
    invitationSentAt: lease.invitationSentAt,
    invitationExpiresAt: newExpiryDate,
    tenantEmail: lease.tenantEmail,
  };
};

/**
 * Update parking bays for a unit
 */
export const updateParkingBays = async (
  propertyId: string,
  unitId: string,
  landlordId: string,
  input: UpdateParkingBaysInput,
): Promise<UpdateParkingBaysResponse> => {
  // Find property
  const property = await Property.findById(propertyId);
  if (!property) {
    throw ApiError.notFound("Property not found");
  }

  // Verify landlord owns property
  if (property.landlordId.toString() !== landlordId) {
    throw ApiError.forbidden("You do not own this property");
  }

  // Find unit
  const unit = property.units.find((u: any) => u._id?.toString() === unitId);
  if (!unit) {
    throw ApiError.notFound("Unit not found");
  }

  // Handle different actions
  if (input.action === "add") {
    for (const bay of input.parkingBays) {
      const exists = unit.parkingBays.find(
        (b: any) => b.bayNumber === bay.bayNumber,
      );
      if (exists) {
        throw ApiError.badRequest(`Bay number ${bay.bayNumber} already exists`);
      }

      unit.parkingBays.push({
        bayNumber: bay.bayNumber,
        assignedToTenant: false,
        notes: bay.notes || undefined,
        addedAt: new Date(),
      });
    }
  } else if (input.action === "update") {
    for (const bay of input.parkingBays) {
      const existing = unit.parkingBays.find(
        (b: any) => b.bayNumber === bay.bayNumber,
      );
      if (!existing) {
        throw ApiError.notFound(`Bay number ${bay.bayNumber} not found`);
      }
      existing.notes = bay.notes || undefined;
    }
  } else if (input.action === "remove") {
    for (const bay of input.parkingBays) {
      const index = unit.parkingBays.findIndex(
        (b: any) => b.bayNumber === bay.bayNumber,
      );
      if (index === -1) {
        throw ApiError.notFound(`Bay number ${bay.bayNumber} not found`);
      }

      if (unit.parkingBays[index].assignedToTenant) {
        throw ApiError.badRequest(
          `Cannot remove bay ${bay.bayNumber} - it is assigned to a tenant`,
        );
      }

      unit.parkingBays.splice(index, 1);
    }
  }

  await property.save();

  logger.info(`Parking bays updated for unit ${unit.unitNumber}`);

  return {
    unitId,
    parkingBays: unit.parkingBays,
  };
};

/**
 * Get unit with parking details
 */
export const getUnitDetails = async (
  propertyId: string,
  unitId: string,
  landlordId: string,
): Promise<GetUnitDetailsResponse> => {
  // Find property
  const property = await Property.findById(propertyId);
  if (!property) {
    throw ApiError.notFound("Property not found");
  }

  // Verify landlord owns property
  if (property.landlordId.toString() !== landlordId) {
    throw ApiError.forbidden("You do not own this property");
  }

  // Find unit
  const unit = property.units.find((u: any) => u._id?.toString() === unitId);
  if (!unit) {
    throw ApiError.notFound("Unit not found");
  }

  // Get current lease
  const currentLease = await LeaseAgreement.findOne({
    propertyId,
    unitId,
    status: { $in: [LeaseStatus.ACCEPTED, LeaseStatus.ACTIVE] },
  });

  return {
    unitId: unit._id as any,
    unitNumber: unit.unitNumber,
    totalParkingSpots: unit.totalParkingSpots,
    parkingBays: unit.parkingBays,
    currentLease: currentLease
      ? {
          tenantName: currentLease.tenantFullName,
          tenantEmail: currentLease.tenantEmail,
          rentAmount: currentLease.rentAmount,
          leaseEndDate: currentLease.leaseEndDate,
        }
      : null,
  };
};

/**
 * Allocate Parking Bay to Lease
 */
export const allocateParkingBay = async (
  propertyId: string,
  unitId: string,
  bayNumber: string,
  leaseId: string,
  landlordId: string,
): Promise<any> => {
  const property = await Property.findById(propertyId);
  if (!property) throw ApiError.notFound("Property not found");
  if (property.landlordId.toString() !== landlordId) {
    throw ApiError.forbidden("You do not own this property");
  }

  const unit = property.units.find((u: any) => u._id?.toString() === unitId);
  if (!unit) throw ApiError.notFound("Unit not found");

  const bay = unit.parkingBays.find((b: any) => b.bayNumber === bayNumber);
  if (!bay) throw ApiError.notFound("Parking bay not found");

  const lease = await LeaseAgreement.findById(leaseId);
  if (!lease) throw ApiError.notFound("Lease agreement not found");

  // Mark bay as assigned in Property Unit
  bay.assignedToTenant = true;
  await property.save();

  // Push to Lease assigned list if not already present
  if (!lease.assignedParkingBays.includes(bayNumber)) {
    lease.assignedParkingBays.push(bayNumber);
    await lease.save();
  }

  return { success: true, message: "Parking bay allocated successfully" };
};

/**
 * Release Parking Bay from Lease
 */
export const releaseParkingBay = async (
  propertyId: string,
  unitId: string,
  bayNumber: string,
  landlordId: string,
): Promise<any> => {
  const property = await Property.findById(propertyId);
  if (!property) throw ApiError.notFound("Property not found");
  if (property.landlordId.toString() !== landlordId) {
    throw ApiError.forbidden("You do not own this property");
  }

  const unit = property.units.find((u: any) => u._id?.toString() === unitId);
  if (!unit) throw ApiError.notFound("Unit not found");

  const bay = unit.parkingBays.find((b: any) => b.bayNumber === bayNumber);
  if (!bay) throw ApiError.notFound("Parking bay not found");

  // Mark bay as unassigned
  bay.assignedToTenant = false;
  await property.save();

  // Pull from any active lease that has this bay number
  const lease = await LeaseAgreement.findOne({
    propertyId,
    unitId,
    status: { $in: [LeaseStatus.ACCEPTED, LeaseStatus.ACTIVE] },
  });

  if (lease) {
    lease.assignedParkingBays = lease.assignedParkingBays.filter(
      (b) => b !== bayNumber,
    );
    await lease.save();
  }

  return { success: true, message: "Parking bay released successfully" };
};

/**
 * Update Tenant/Lease Details (Landlord action)
 */
export const updateTenantLease = async (
  leaseId: string,
  landlordId: string,
  data: any,
): Promise<any> => {
  const lease = await LeaseAgreement.findById(leaseId);
  if (!lease) throw ApiError.notFound("Lease agreement not found");
  if (lease.landlordId.toString() !== landlordId) {
    throw ApiError.forbidden("You do not own this property");
  }

  // Update lease agreement details
  if (data.tenantFullName !== undefined)
    lease.tenantFullName = data.tenantFullName;
  if (data.tenantPhone !== undefined) lease.tenantPhone = data.tenantPhone;
  if (data.rentAmount !== undefined) lease.rentAmount = Number(data.rentAmount);
  if (data.securityDeposit !== undefined)
    lease.securityDeposit = Number(data.securityDeposit);
  if (data.paymentFrequency !== undefined)
    lease.paymentFrequency = data.paymentFrequency;
  if (data.paymentDueDay !== undefined)
    lease.paymentDueDay = Number(data.paymentDueDay);
  if (data.leaseStartDate !== undefined)
    lease.leaseStartDate = new Date(data.leaseStartDate);
  if (data.leaseEndDate !== undefined)
    lease.leaseEndDate = new Date(data.leaseEndDate);

  await lease.save();

  // Sync rent amount change with any active unpaid payments (invoices)
  if (data.rentAmount !== undefined) {
    await RentPayment.updateMany(
      { leaseId: lease._id, status: { $in: ["pending", "overdue"] } },
      { amount: Number(data.rentAmount) }
    );
  }

  // If the tenant user account exists, sync their name/phone if appropriate
  if (lease.tenantId) {
    const tenantUser: any = await User.findById(lease.tenantId);
    if (tenantUser) {
      if (data.tenantFullName) {
        const parts = data.tenantFullName.trim().split(" ");
        tenantUser.firstName = parts[0] || "";
        tenantUser.lastName = parts.slice(1).join(" ") || "";
      }
      await tenantUser.save();
    }
  }

  return lease;
};

/**
 * Delete Tenant/Lease (Landlord action)
 */
export const deleteTenantLease = async (
  leaseId: string,
  landlordId: string,
): Promise<any> => {
  const lease = await LeaseAgreement.findById(leaseId);
  if (!lease) throw ApiError.notFound("Lease agreement not found");
  if (lease.landlordId.toString() !== landlordId) {
    throw ApiError.forbidden("You do not own this property");
  }

  // 1. Delete associated unpaid rent payments
  await RentPayment.deleteMany({ leaseId, status: { $ne: "paid" } });

  // 2. Clear tenant association on the Property Unit
  const property = await Property.findById(lease.propertyId);
  if (property) {
    const unit: any = property.units.find(
      (u: any) => u._id?.toString() === lease.unitId?.toString(),
    );
    if (unit) {
      unit.currentTenantId = undefined;
      // Mark all parking bays of this unit as unassigned
      unit.parkingBays.forEach((bay: any) => {
        bay.assignedToTenant = false;
      });
      await property.save();
    }
  }

  // 3. Delete tenant user if exists
  if (lease.tenantId) {
    await User.findByIdAndDelete(lease.tenantId);
  }

  // 4. Delete the LeaseAgreement itself
  await LeaseAgreement.findByIdAndDelete(leaseId);

  return {
    success: true,
    message: "Lease and associated tenant deleted successfully",
  };
};
