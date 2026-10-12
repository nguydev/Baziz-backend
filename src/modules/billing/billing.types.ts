import type { PlanId, PlanLimits, SubscriptionStatus } from './billing.constants';

export interface PaymentMethodSummary {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface SubscriptionResponse {
  planId: PlanId;
  planName: string;
  status: SubscriptionStatus;
  priceMonthly: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  billingEmail: string | null;
  billingAddress: string | null;
  paymentMethod: PaymentMethodSummary | null;
}

export interface UsageResponse {
  planId: PlanId;
  limits: Pick<PlanLimits, 'maxProperties' | 'maxTeamMembers'>;
  used: { properties: number; teamMembers: number };
  canAddProperty: boolean;
  canAddTeamMember: boolean;
}

export interface LoginSubscriptionPayload {
  planId: PlanId;
  status: SubscriptionStatus;
  limits: Pick<PlanLimits, 'maxProperties' | 'maxTeamMembers'>;
  used: { properties: number; teamMembers: number };
}

export interface CheckoutInput {
  planId: PlanId;
  successUrl: string;
  cancelUrl: string;
}

export interface PortalInput {
  returnUrl: string;
}

export interface DowngradeInput {
  /** Target plan after downgrade. `pro` is accepted as "cancel Pro subscription" (same as `free`). */
  planId?: PlanId;
}

export interface UpdateBillingInfoInput {
  billingEmail?: string;
  billingAddress?: string;
}

export interface InvoiceListItem {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  planName: string;
  pdfUrl: string | null;
}
