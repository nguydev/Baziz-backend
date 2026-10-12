/**
 * Property API Types
 */

import type { PaymentFrequency } from '../tenant/tenant.model';

export interface CurrentTenantRent {
  amount: number;
  currency: string;
  frequency: PaymentFrequency;
  dueDay: number;
  label: string;
}

export interface CurrentTenantUnit {
  unitId: string;
  unitNumber: string;
}

export interface CurrentTenantSummary {
  leaseId: string;
  tenantId: string | null;
  tenantReference: string;
  name: string;
  email: string;
  phone: string;
  unit: CurrentTenantUnit;
  rent: CurrentTenantRent;
  leaseStatus: string;
  leaseStartDate: Date;
  leaseEndDate: Date;
  acceptedAt: Date | null;
}

export interface GetCurrentTenantsResult {
  propertyId: string;
  propertyName: string;
  address: {
    streetAddress: string;
    city: string;
    postcode: string;
  };
  totalUnits: number;
  totalTenants: number;
  vacantUnits: number;
  tenants: CurrentTenantSummary[];
}
