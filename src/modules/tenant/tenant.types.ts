/**
 * Tenant Management Types
 */

import type { ILeaseAgreementDocument } from './tenant.model';
import type { TokenPair } from '../../utils/tokenManager';
import type { IUserDocument } from '../user/user.model';

/**
 * Tenant Service Response Types
 */
export interface InviteTenantResponse {
  leaseId: string;
  status: string;
  invitationSentAt: Date;
  invitationExpiresAt: Date;
}

export interface AcceptLeaseResponse {
  user: Partial<IUserDocument>;
  session: TokenPair;
  _dev_otp?: string;
}

export interface GetMyLeaseResponse {
  leaseId: string;
  propertyName: string;
  unitNumber: string;
  landlordName: string;
  landlordEmail: string;
  rentAmount: number;
  securityDeposit: number;
  paymentFrequency: string;
  paymentDueDay: number;
  leaseStartDate: Date;
  leaseEndDate: Date;
  assignedParkingBays: string[];
  parkingNotes?: string;
  status: string;
  acceptedAt?: Date;
}

export interface GetTenantsResponse {
  leases: ILeaseAgreementDocument[];
  total: number;
  limit: number;
  skip: number;
}

export interface ResendInvitationResponse {
  invitationSentAt: Date;
  invitationExpiresAt: Date;
  tenantEmail: string;
}

export interface UpdateParkingBaysResponse {
  unitId: string;
  parkingBays: any[];
}

export interface GetUnitDetailsResponse {
  unitId: string;
  unitNumber: string;
  totalParkingSpots: number;
  parkingBays: any[];
  currentLease?: {
    tenantName: string;
    tenantEmail: string;
    rentAmount: number;
    leaseEndDate: Date;
  } | null;
}

/**
 * Query Filter Types
 */
export interface LeaseFilterOptions {
  status?: string;
  propertyId?: string;
  limit: number;
  skip: number;
}

/**
 * Email Template Data
 */
export interface TenantInvitationEmailData {
  leaseId: string;
  propertyName: string;
  unitNumber: string;
  rentAmount: number;
  leaseStartDate: Date;
  leaseEndDate: Date;
  invitationExpiresAt: Date;
}

/**
 * Parking Bay Operations
 */
export interface ParkingBayInput {
  bayNumber: string;
  notes?: string;
}

/**
 * Lease Validation Result
 */
export interface LeaseValidationResult {
  isValid: boolean;
  error?: string;
}
