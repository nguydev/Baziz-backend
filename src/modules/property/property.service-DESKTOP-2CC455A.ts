/**
 * Property Service
 * Business logic for all property management operations
 * Implements: create, read, update, delete, unit management
 */

import mongoose from 'mongoose';
import Property, { IPropertyDocument, IPropertyUnit } from './property.model';
import User from '../user/user.model';
import tenantModels from '../tenant/tenant.model';
import type { ILeaseAgreementDocument } from '../tenant/tenant.model';
import type { IUserDocument } from '../user/user.model';
import ApiError from '../../utils/ApiError';
import logger from '../../config/logger';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
  AddUnitInput,
  GetPropertiesQuery,
} from './property.validation';
import type { PaginationMeta } from '../../types/api.types';
import type {
  CurrentTenantSummary,
  GetCurrentTenantsResult,
} from './property.types';

const { LeaseAgreement } = tenantModels;

const DEFAULT_CURRENCY = 'GBP';

const RENT_FREQUENCY_LABEL: Record<string, string> = {
  monthly: '/mo',
  quarterly: '/qtr',
  yearly: '/yr',
};

// ─── Create Property ──────────────────────────────────────────────────────────
export const createProperty = async (
  input: CreatePropertyInput,
  landlordId: string,
  imageUrl?: string
): Promise<IPropertyDocument> => {
  // Verify landlord exists and has landlord role
  const landlord = await User.findById(landlordId);
  if (!landlord) {
    throw ApiError.unauthorized('Landlord not found');
  }
  if (landlord.role !== 'landlord') {
    throw ApiError.forbidden('Only landlords can create properties');
  }

  const property = new Property({
    ...input,
    landlordId,
    propertyImage: imageUrl ?? null,
    units: input.units ?? [],
  });

  await property.save();

  logger.info(
    `Property created: "${property.propertyName}" by landlord ${landlordId}`
  );

  return property;
};

// ─── Get All Properties (Landlord's) ─────────────────────────────────────────
export const getMyProperties = async (
  landlordId: string,
  query: GetPropertiesQuery
): Promise<{ properties: IPropertyDocument[]; meta: PaginationMeta }> => {
  const { page, limit, skip } = getPagination(query);

  const filter: Record<string, unknown> = {
    landlordId,
    isActive: query.isActive ?? true,
  };

  if (query.propertyType) filter.propertyType = query.propertyType;
  if (query.city) filter.city = new RegExp(query.city, 'i');

  const [properties, total] = await Promise.all([
    Property.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Property.countDocuments(filter),
  ]);

  const meta = buildPaginationMeta(total, page, limit);

  return { properties, meta };
};

// ─── Get Single Property ──────────────────────────────────────────────────────
export const getPropertyById = async (
  propertyId: string,
  landlordId: string
): Promise<IPropertyDocument> => {
  if (!mongoose.isValidObjectId(propertyId)) {
    throw ApiError.badRequest('Invalid property ID');
  }

  const property = await Property.findById(propertyId);
  if (!property || !property.isActive) {
    throw ApiError.notFound('Property not found');
  }

  if (property.landlordId.toString() !== landlordId) {
    throw ApiError.forbidden('You do not own this property');
  }

  return property;
};

// ─── Update Property ──────────────────────────────────────────────────────────
export const updateProperty = async (
  propertyId: string,
  landlordId: string,
  input: UpdatePropertyInput,
  imageUrl?: string
): Promise<IPropertyDocument> => {
  const property = await getPropertyById(propertyId, landlordId);

  // Apply updates
  const updateData: Record<string, unknown> = { ...input };

  // Only update image if a new one was uploaded
  if (imageUrl) {
    updateData.propertyImage = imageUrl;
  }

  Object.assign(property, updateData);
  await property.save();

  logger.info(`Property updated: "${property.propertyName}" (${propertyId})`);

  return property;
};

// ─── Soft Delete Property ─────────────────────────────────────────────────────
export const deleteProperty = async (
  propertyId: string,
  landlordId: string
): Promise<void> => {
  const property = await getPropertyById(propertyId, landlordId);

  property.isActive = false;
  await property.save();

  logger.info(`Property soft-deleted: "${property.propertyName}" (${propertyId})`);
};

// ─── Add Unit to Property ─────────────────────────────────────────────────────
export const addUnit = async (
  propertyId: string,
  landlordId: string,
  input: AddUnitInput
): Promise<IPropertyDocument> => {
  const property = await getPropertyById(propertyId, landlordId);

  // Check for duplicate unit number within this property
  const duplicateUnit = property.units.find(
    (u) => u.unitNumber.toLowerCase() === input.unitNumber.toLowerCase()
  );
  if (duplicateUnit) {
    throw ApiError.conflict(
      `Unit number "${input.unitNumber}" already exists in this property`
    );
  }

  property.units.push({
    unitNumber: input.unitNumber,
    floor: input.floor,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    squareFeet: input.squareFeet,
    rentAmount: input.rentAmount,
    isOccupied: false,
    notes: input.notes,
    totalParkingSpots: 0,
    parkingBays: [],
  });

  await property.save();

  logger.info(
    `Unit "${input.unitNumber}" added to property "${property.propertyName}"`
  );

  return property;
};

// ─── Delete Unit from Property ────────────────────────────────────────────────
export const deleteUnit = async (
  propertyId: string,
  unitId: string,
  landlordId: string
): Promise<IPropertyDocument> => {
  const property = await getPropertyById(propertyId, landlordId);

  const unitIndex = property.units.findIndex(
    (u) => u._id?.toString() === unitId
  );

  if (unitIndex === -1) {
    throw ApiError.notFound('Unit not found in this property');
  }

  const unit = property.units[unitIndex];

  // Block deletion if unit is occupied
  if (unit.isOccupied) {
    throw ApiError.badRequest(
      `Cannot delete unit "${unit.unitNumber}" — it is currently occupied by a tenant`
    );
  }

  property.units.splice(unitIndex, 1);
  await property.save();

  logger.info(
    `Unit "${unit.unitNumber}" deleted from property "${property.propertyName}"`
  );

  return property;
};

// ─── Get Property Summary (for tenant invite dropdown) ───────────────────────
export const getPropertySummaryList = async (
  landlordId: string
): Promise<Array<{ _id: string; propertyName: string; address: string; units: Array<{ _id: string; unitNumber: string; isOccupied: boolean }> }>> => {
  const properties = await Property.find(
    { landlordId, isActive: true },
    { propertyName: 1, streetAddress: 1, city: 1, units: 1 }
  ).sort({ propertyName: 1 });

  // Return minimal data needed for invite form and filter unoccupied units in memory
  return properties.map((p) => ({
    _id: p._id.toString(),
    propertyName: p.propertyName,
    address: `${p.streetAddress}, ${p.city}`,
    units: p.units
      .filter((u) => !u.isOccupied)
      .map((u) => ({
        _id: u._id!.toString(),
        unitNumber: u.unitNumber,
        isOccupied: u.isOccupied,
      })),
  }));
};

// ─── Get Current Tenants for a Property ───────────────────────────────────────

const formatRentLabel = (amount: number, frequency: string): string => {
  const suffix = RENT_FREQUENCY_LABEL[frequency] ?? '';
  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
    minimumFractionDigits: 2,
  }).format(amount);
  return `${formatted}${suffix}`;
};

const buildTenantReference = (index: number): string =>
  `TENANT${String(index + 1).padStart(3, '0')}`;

const mapLeaseToCurrentTenant = (
  lease: ILeaseAgreementDocument,
  unit: IPropertyUnit | undefined,
  index: number
): CurrentTenantSummary => {
  const populatedUser = lease.tenantId as unknown as IUserDocument | null;
  const hasUserProfile =
    populatedUser &&
    typeof populatedUser === 'object' &&
    'firstName' in populatedUser;

  return {
    leaseId: lease._id.toString(),
    tenantId: hasUserProfile ? populatedUser._id.toString() : null,
    tenantReference: buildTenantReference(index),
    name: hasUserProfile
      ? populatedUser.firstName
      : lease.tenantFullName,
    email: hasUserProfile ? populatedUser.email : lease.tenantEmail,
    phone: hasUserProfile
      ? populatedUser.phone ?? lease.tenantPhone
      : lease.tenantPhone,
    unit: {
      unitId: lease.unitId.toString(),
      unitNumber: unit?.unitNumber ?? 'Unknown',
    },
    rent: {
      amount: lease.rentAmount,
      currency: DEFAULT_CURRENCY,
      frequency: lease.paymentFrequency,
      dueDay: lease.paymentDueDay,
      label: formatRentLabel(lease.rentAmount, lease.paymentFrequency),
    },
    leaseStatus: lease.status,
    leaseStartDate: lease.leaseStartDate,
    leaseEndDate: lease.leaseEndDate,
    acceptedAt: lease.acceptedAt ?? null,
  };
};

export const getCurrentTenants = async (
  propertyId: string,
  landlordId: string
): Promise<GetCurrentTenantsResult> => {
  const property = await getPropertyById(propertyId, landlordId);

  const leases = await LeaseAgreement.find({
    propertyId: property._id,
    landlordId,
    status: { $in: ['accepted', 'active'] },
  })
    .populate('tenantId', 'firstName email phone')
    .sort({ createdAt: 1 });

  const unitMap = new Map(
    property.units
      .filter((u) => u._id)
      .map((u) => [u._id!.toString(), u])
  );

  const tenants = leases.map((lease, index) =>
    mapLeaseToCurrentTenant(lease, unitMap.get(lease.unitId.toString()), index)
  );

  const totalUnits = property.units.length;
  const totalTenants = tenants.length;

  logger.info(
    `Current tenants fetched for property "${property.propertyName}": ${totalTenants} tenant(s)`
  );

  return {
    propertyId: property._id.toString(),
    propertyName: property.propertyName,
    address: {
      streetAddress: property.streetAddress,
      city: property.city,
      postcode: property.postcode,
    },
    totalUnits,
    totalTenants,
    vacantUnits: Math.max(totalUnits - totalTenants, 0),
    tenants,
  };
};
