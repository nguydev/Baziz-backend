/**
 * Landlord Billing Module — Unit Tests
 */

import {
  SUBSCRIPTION_PLANS,
  getPlan,
  isUnlimited,
  GRACE_PERIOD_DAYS,
} from '../../src/modules/billing/billing.constants';
import {
  checkoutSchema,
  downgradeSchema,
  portalSchema,
  updateBillingInfoSchema,
  listInvoicesSchema,
} from '../../src/modules/billing/billing.validation';
import { extractPaymentMethod, toSubscriptionSnapshot } from '../../src/modules/billing/billing-stripe.service';

describe('Billing Constants', () => {
  it('defines Free and Pro plans', () => {
    expect(Object.keys(SUBSCRIPTION_PLANS)).toEqual(['free', 'pro']);
    expect(SUBSCRIPTION_PLANS.free.limits.maxProperties).toBe(3);
    expect(SUBSCRIPTION_PLANS.pro.priceMonthly).toBe(19.99);
    expect(SUBSCRIPTION_PLANS.pro.limits.maxProperties).toBe(-1);
  });

  it('getPlan falls back to free for unknown id', () => {
    expect(getPlan('unknown').id).toBe('free');
  });

  it('isUnlimited detects -1', () => {
    expect(isUnlimited(-1)).toBe(true);
    expect(isUnlimited(3)).toBe(false);
  });

  it('grace period is 7 days', () => {
    expect(GRACE_PERIOD_DAYS).toBe(7);
  });
});

describe('Billing Validation', () => {
  it('validates checkout body', () => {
    const { error, value } = checkoutSchema.validate({
      planId: 'pro',
      successUrl: 'propertera://billing/success',
      cancelUrl: 'propertera://billing/cancel',
    });
    expect(error).toBeUndefined();
    expect(value.planId).toBe('pro');
  });

  it('rejects checkout without pro plan', () => {
    const { error } = checkoutSchema.validate({
      planId: 'free',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });
    expect(error).toBeDefined();
  });

  it('validates portal returnUrl', () => {
    const { error, value } = portalSchema.validate({ returnUrl: 'propertera://billing' });
    expect(error).toBeUndefined();
    expect(value.returnUrl).toBe('propertera://billing');
  });

  it('validates downgrade to free', () => {
    const { error, value } = downgradeSchema.validate({ planId: 'free' });
    expect(error).toBeUndefined();
    expect(value.planId).toBe('free');
  });

  it('accepts pro as cancel-pro intent (downgrades to free)', () => {
    const { error, value } = downgradeSchema.validate({ planId: 'pro' });
    expect(error).toBeUndefined();
    expect(value.planId).toBe('pro');
  });

  it('defaults downgrade planId to free when body empty', () => {
    const { error, value } = downgradeSchema.validate({});
    expect(error).toBeUndefined();
    expect(value.planId).toBe('free');
  });

  it('validates billing info patch', () => {
    const { error, value } = updateBillingInfoSchema.validate({
      billingEmail: 'billing@example.com',
      billingAddress: '123 Lane',
    });
    expect(error).toBeUndefined();
    expect(value.billingEmail).toBe('billing@example.com');
  });

  it('validates invoice list query defaults', () => {
    const { error, value } = listInvoicesSchema.validate({});
    expect(error).toBeUndefined();
    expect(value.page).toBe(1);
    expect(value.limit).toBe(10);
  });
});

describe('Billing Stripe helpers', () => {
  it('extractPaymentMethod returns card details', () => {
    const pm = extractPaymentMethod({
      card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2025 },
    });
    expect(pm).toEqual({
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: 2025,
    });
  });

  it('extractPaymentMethod returns null for string id', () => {
    expect(extractPaymentMethod('pm_123')).toBeNull();
  });

  it('toSubscriptionSnapshot unwraps nested data', () => {
    const snapshot = toSubscriptionSnapshot({
      data: {
        id: 'sub_1',
        status: 'active',
        current_period_start: 100,
        current_period_end: 200,
        cancel_at_period_end: false,
      },
    });
    expect(snapshot.id).toBe('sub_1');
    expect(snapshot.current_period_end).toBe(200);
  });
});
