/**
 * Monthly Bill Types
 * Shared TypeScript interfaces and types for the Monthly Bill module
 */

import mongoose from 'mongoose';
import type { IMonthlyBillDocument } from './monthly-bill.model';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type BillType = 'water' | 'electricity' | 'gas' | 'council_tax' | 'broadband' | 'other';
export type BillingCycle = 'weekly' | 'monthly' | 'yearly' | 'one_time';
export type PaymentStatus = 'paid' | 'pending' | 'overdue';

// ─── Main Interface ───────────────────────────────────────────────────────────

export interface IMonthlyBill {
  // Bill details
  billType: BillType;
  billingCycle: BillingCycle;
  supplier: string;
  accountReference: string;
  amount: number;
  dueDay: number;
  paymentStatus: PaymentStatus;
  supplierPhone?: string | null;
  supplierWebsite?: string | null;
  notes?: string | null;

  // Relationships — auto-populated from lease, never sent by client
  propertyId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;   // who submitted the bill
  landlordId: mongoose.Types.ObjectId; // owner of the property

  // System
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Service Input Types ──────────────────────────────────────────────────────

/**
 * Input for adding a bill — Tenant sends ONLY bill details.
 * propertyId, unitId, landlordId are resolved from their active lease.
 */
export interface AddBillInput {
  billType: BillType;
  billingCycle: BillingCycle;
  supplier: string;
  accountReference: string;
  amount: number;
  dueDay: number;
  tenantId?: string; // Add optional tenantId so landlords can assign bills
  paymentStatus?: PaymentStatus;
  supplierPhone?: string;
  supplierWebsite?: string;
  notes?: string;
}

export interface UpdateBillInput {
  billType?: BillType;
  billingCycle?: BillingCycle;
  supplier?: string;
  accountReference?: string;
  amount?: number;
  dueDay?: number;
  paymentStatus?: PaymentStatus;
  supplierPhone?: string;
  supplierWebsite?: string;
  notes?: string;
}

export interface UpdateStatusInput {
  paymentStatus: PaymentStatus;
}

export interface ListBillsQuery {
  billType?: BillType;
  paymentStatus?: PaymentStatus;
  page: number;
  limit: number;
}

// ─── Service Response Types ───────────────────────────────────────────────────

export interface BillSummary {
  estimatedMonthlyTotal: number;
  totalBills: number;
  paid: number;
  pending: number;
  overdue: number;
}

export interface ListBillsResult {
  bills: IMonthlyBillDocument[];
  summary: BillSummary;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AuthUser {
  _id: mongoose.Types.ObjectId;
  role: string;
}
