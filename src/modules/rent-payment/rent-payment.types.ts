/**
 * Rent Payment Types
 */

import mongoose from 'mongoose';
import type { IRentPaymentDocument } from './rent-payment.model';

export type RentPaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type RentPaymentMethod = 'card' | 'apple_pay' | 'manual' | 'auto_pay' | null;
export type RentPaymentCreatedBy = 'system' | 'landlord' | 'tenant';

export interface IRentPayment {
  leaseId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  landlordId: mongoose.Types.ObjectId;
  billingMonth: string;
  title: string;
  amount: number;
  currency: string;
  dueDate: Date;
  paidAt: Date | null;
  status: RentPaymentStatus;
  paymentMethod: RentPaymentMethod;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  transactionRef: string | null;
  reminderCount: number;
  lastReminderAt: Date | null;
  createdBy: RentPaymentCreatedBy;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateManualPaymentInput {
  propertyId: string;
  tenantId: string;
  amount: number;
  paymentDate: string;
  status: RentPaymentStatus;
  billingMonth?: string;
}

export interface UpdateManualPaymentInput {
  amount?: number;
  paymentDate?: string;
  status?: RentPaymentStatus;
}

export interface ListRentPaymentsQuery {
  status?: RentPaymentStatus;
  billingMonth?: string;
  propertyId?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface TenantDashboardResult {
  currentRent: {
    amount: number;
    currency: string;
    dueDay: number;
    dueLabel: string;
  };
  upcoming: {
    rentPaymentId: string;
    title: string;
    amount: number;
    currency: string;
    dueDate: Date;
    daysUntilDue: number;
    status: RentPaymentStatus;
  } | null;
  autoPay: { enabled: boolean; hasPaymentMethod: boolean };
  recentPayments: IRentPaymentDocument[];
}

export interface LandlordSummaryResult {
  collected: { amount: number; currency: string; count: number };
  pending: { amount: number; currency: string; count: number };
  overdue: { amount: number; currency: string; count: number };
}

export interface MonthlyReportResult {
  billingMonth: string;
  label: string;
  summary: { paid: number; pending: number; overdue: number; total: number };
  payments: Array<{
    tenantName: string;
    propertyName: string;
    amount: number;
    currency: string;
    status: RentPaymentStatus;
    paidAt: Date | null;
    dueDate: Date;
  }>;
}

export interface CreatePaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  paymentMethod: 'card' | 'apple_pay';
}

export interface ApplePayConfigResult {
  publishableKey: string;
  merchantDisplayName: string;
  countryCode: string;
  currencyCode: string;
  supportedNetworks: string[];
  /** Stripe PaymentIntent clientSecret — present after pay/apple-pay */
  clientSecret?: string;
  /** Cart line item for iOS / React Native Stripe SDK */
  cartLabel?: string;
  cartAmount?: number;
}
