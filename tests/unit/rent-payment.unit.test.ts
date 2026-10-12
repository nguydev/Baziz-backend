/**
 * Rent Payment Module — Unit Tests
 */

import {
  getBillingMonth,
  formatBillingTitle,
  formatBillingLabel,
  buildDueDate,
  getDaysUntilDue,
  getReminderSlot,
  formatCurrency,
  isFirstOfMonthUtc,
  parseDateOnly,
} from '../../src/modules/rent-payment/rent-payment.utils';
import {
  listRentPaymentsSchema,
  createManualPaymentSchema,
  updateManualPaymentSchema,
  monthlyReportSchema,
  updateAutoPaySchema,
  confirmAutoPaySchema,
} from '../../src/modules/rent-payment/rent-payment.validation';

describe('Rent Payment Utils', () => {
  describe('getBillingMonth', () => {
    it('returns YYYY-MM for a given date', () => {
      expect(getBillingMonth(new Date('2026-06-15T12:00:00.000Z'))).toBe('2026-06');
    });

    it('pads single-digit months', () => {
      expect(getBillingMonth(new Date('2026-01-05T12:00:00.000Z'))).toBe('2026-01');
    });
  });

  describe('isFirstOfMonthUtc', () => {
    it('returns true on 1st UTC', () => {
      expect(isFirstOfMonthUtc(new Date('2026-06-01T10:00:00.000Z'))).toBe(true);
    });

    it('returns false on other days', () => {
      expect(isFirstOfMonthUtc(new Date('2026-06-02T00:00:00.000Z'))).toBe(false);
    });
  });

  describe('formatBillingTitle', () => {
    it('formats valid billing month', () => {
      expect(formatBillingTitle('2026-06')).toBe('June 2026 Rent');
    });

    it('handles invalid month gracefully', () => {
      expect(formatBillingTitle('2026-13')).toBe('Rent 2026-13');
    });
  });

  describe('formatBillingLabel', () => {
    it('returns short month label', () => {
      expect(formatBillingLabel('2026-03')).toBe('Mar 2026');
    });
  });

  describe('buildDueDate', () => {
    it('builds due date from billing month and due day', () => {
      const due = buildDueDate('2026-06', 5);
      expect(due.getUTCDate()).toBe(5);
      expect(due.getUTCMonth()).toBe(5);
    });

    it('caps due day to last day of month', () => {
      const due = buildDueDate('2026-02', 31);
      expect(due.getUTCDate()).toBe(28);
    });
  });

  describe('getDaysUntilDue', () => {
    it('returns positive days when due is in future', () => {
      const from = new Date('2026-06-01T12:00:00.000Z');
      const due = new Date('2026-06-06T12:00:00.000Z');
      expect(getDaysUntilDue(due, from)).toBe(5);
    });

    it('returns 0 when due is today', () => {
      const d = new Date('2026-06-01T12:00:00.000Z');
      expect(getDaysUntilDue(d, d)).toBe(0);
    });
  });

  describe('getReminderSlot', () => {
    it('returns 2-hour slot string', () => {
      expect(getReminderSlot(new Date('2026-06-01T14:30:00.000Z'))).toBe('2026-06-01T14');
    });

    it('rounds down to even hour', () => {
      expect(getReminderSlot(new Date('2026-06-01T15:59:00.000Z'))).toBe('2026-06-01T14');
    });
  });

  describe('formatCurrency', () => {
    it('formats GBP amount', () => {
      const formatted = formatCurrency(1200, 'GBP');
      expect(formatted).toContain('1,200');
    });
  });

  describe('parseDateOnly', () => {
    it('parses YYYY-MM-DD as UTC noon', () => {
      const d = parseDateOnly('2026-06-01');
      expect(d.toISOString()).toBe('2026-06-01T12:00:00.000Z');
    });
  });
});

describe('Rent Payment Validation', () => {
  describe('listRentPaymentsSchema', () => {
    it('accepts valid query with defaults', () => {
      const { error, value } = listRentPaymentsSchema.validate({});
      expect(error).toBeUndefined();
      expect(value.page).toBe(1);
      expect(value.limit).toBe(20);
    });

    it('rejects invalid billingMonth', () => {
      const { error } = listRentPaymentsSchema.validate({ billingMonth: '06-2026' });
      expect(error).toBeDefined();
    });
  });

  describe('createManualPaymentSchema', () => {
    it('accepts valid manual payment', () => {
      const { error } = createManualPaymentSchema.validate({
        propertyId: '507f1f77bcf86cd799439011',
        tenantId: '507f1f77bcf86cd799439012',
        amount: 1200,
        paymentDate: '2026-06-01',
        status: 'paid',
      });
      expect(error).toBeUndefined();
    });

    it('rejects negative amount', () => {
      const { error } = createManualPaymentSchema.validate({
        propertyId: '507f1f77bcf86cd799439011',
        tenantId: '507f1f77bcf86cd799439012',
        amount: -100,
        paymentDate: '2026-06-01',
        status: 'paid',
      });
      expect(error).toBeDefined();
    });
  });

  describe('updateManualPaymentSchema', () => {
    it('requires at least one field', () => {
      const { error } = updateManualPaymentSchema.validate({});
      expect(error).toBeDefined();
    });
  });

  describe('monthlyReportSchema', () => {
    it('requires billingMonth YYYY-MM', () => {
      const { error, value } = monthlyReportSchema.validate({ billingMonth: '2026-06' });
      expect(error).toBeUndefined();
      expect(value.billingMonth).toBe('2026-06');
    });
  });

  describe('updateAutoPaySchema', () => {
    it('requires enabled boolean', () => {
      const { error } = updateAutoPaySchema.validate({ enabled: true });
      expect(error).toBeUndefined();
    });
  });

  describe('confirmAutoPaySchema', () => {
    it('requires setupIntentId', () => {
      const { error } = confirmAutoPaySchema.validate({ setupIntentId: 'seti_123' });
      expect(error).toBeUndefined();
    });
  });
});

describe('Scheduler fallback helpers', () => {
  const { isUtcHourOncePerDay, isEvenUtcHour } = require('../../src/utils/scheduler.fallback');

  it('isUtcHourOncePerDay matches hour within first 15 min', () => {
    expect(isUtcHourOncePerDay(0, new Date('2026-06-01T00:10:00.000Z'))).toBe(true);
    expect(isUtcHourOncePerDay(0, new Date('2026-06-01T01:00:00.000Z'))).toBe(false);
  });

  it('isEvenUtcHour matches even hours', () => {
    expect(isEvenUtcHour(new Date('2026-06-01T04:05:00.000Z'))).toBe(true);
    expect(isEvenUtcHour(new Date('2026-06-01T05:05:00.000Z'))).toBe(false);
  });
});
