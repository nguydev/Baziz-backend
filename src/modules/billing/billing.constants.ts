export const PLAN_IDS = ['free', 'pro'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

export const GRACE_PERIOD_DAYS = 7;
export const DEFAULT_CURRENCY = 'gbp';

export interface PlanLimits {
  maxProperties: number;
  maxTeamMembers: number;
  aiInsights: boolean;
  taxReports: boolean;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceMonthly: number;
  currency: string;
  features: string[];
  limits: PlanLimits;
}

export const SUBSCRIPTION_PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    priceMonthly: 0,
    currency: DEFAULT_CURRENCY,
    features: ['Up to 3 properties', 'Basic reports'],
    limits: {
      maxProperties: 3,
      maxTeamMembers: 1,
      aiInsights: false,
      taxReports: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 19.99,
    currency: DEFAULT_CURRENCY,
    features: ['Unlimited properties', 'Advanced AI insights', 'Tax reports'],
    limits: {
      maxProperties: -1,
      maxTeamMembers: 10,
      aiInsights: true,
      taxReports: true,
    },
  },
};

export const getPlan = (planId: string): PlanDefinition => {
  const plan = SUBSCRIPTION_PLANS[planId as PlanId];
  if (!plan) return SUBSCRIPTION_PLANS.free;
  return plan;
};

export const isUnlimited = (value: number): boolean => value === -1;
