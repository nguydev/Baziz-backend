/**
 * Rent payment date/billing helpers
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const DEFAULT_CURRENCY = 'GBP';

export const getBillingMonth = (date: Date = new Date()): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

/** True when today is the 1st (UTC) — used by billing job */
export const isFirstOfMonthUtc = (date: Date = new Date()): boolean =>
  date.getUTCDate() === 1;

export const formatBillingTitle = (billingMonth: string): string => {
  const [year, month] = billingMonth.split('-');
  const idx = Number(month) - 1;
  if (idx < 0 || idx > 11) return `Rent ${billingMonth}`;
  return `${MONTH_NAMES[idx]} ${year} Rent`;
};

export const formatBillingLabel = (billingMonth: string): string => {
  const [year, month] = billingMonth.split('-');
  const idx = Number(month) - 1;
  if (idx < 0 || idx > 11) return billingMonth;
  return `${MONTH_SHORT[idx]} ${year}`;
};

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

export const buildDueDate = (billingMonth: string, dueDay: number): Date => {
  const [yearStr, monthStr] = billingMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Math.min(Math.max(dueDay, 1), daysInMonth(year, month));
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
};

export const parseDateOnly = (value: string): Date =>
  new Date(`${value}T12:00:00.000Z`);

export const getDaysUntilDue = (dueDate: Date, from: Date = new Date()): number => {
  const start = new Date(from);
  start.setUTCHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setUTCHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

export const getReminderSlot = (date: Date = new Date()): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hourSlot = Math.floor(date.getUTCHours() / 2) * 2;
  const h = String(hourSlot).padStart(2, '0');
  return `${y}-${m}-${d}T${h}`;
};

export const formatCurrency = (amount: number, currency: string): string =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
