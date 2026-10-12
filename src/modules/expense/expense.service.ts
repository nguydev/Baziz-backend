/**
 * Property Expense Service
 */

import mongoose from 'mongoose';
import Expense from './expense.model';
import type { IExpenseDocument } from './expense.model';
import { getPropertyById } from '../property/property.service';
import ApiError from '../../utils/ApiError';
import logger from '../../config/logger';
import { buildPaginationMeta } from '../../utils/pagination';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesQuery,
  ExpenseReportQuery,
  ListExpensesResult,
  ExpenseReportResult,
  CategoryReportItem,
  MonthReportItem,
} from './expense.types';

const DEFAULT_CURRENCY = 'GBP';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const parseDateOnly = (value: string, fieldName: string): Date => {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`Invalid ${fieldName}`);
  }
  return date;
};

const buildDateRangeFilter = (
  startDate?: string,
  endDate?: string
): Record<string, Date> | undefined => {
  if (!startDate && !endDate) return undefined;

  const range: Record<string, Date> = {};

  if (startDate) {
    range.$gte = parseDateOnly(startDate, 'startDate');
  }

  if (endDate) {
    const end = parseDateOnly(endDate, 'endDate');
    end.setUTCHours(23, 59, 59, 999);
    range.$lte = end;
  }

  if (startDate && endDate && range.$gte! > range.$lte!) {
    throw ApiError.badRequest('startDate cannot be after endDate');
  }

  return range;
};

const verifyPropertyOwnership = async (
  propertyId: string,
  landlordId: string
) => {
  return getPropertyById(propertyId, landlordId);
};

const getExpenseForLandlord = async (
  expenseId: string,
  propertyId: string,
  landlordId: string
): Promise<IExpenseDocument> => {
  if (!mongoose.isValidObjectId(expenseId)) {
    throw ApiError.badRequest('Invalid expense ID');
  }

  const expense = await Expense.findOne({
    _id: expenseId,
    propertyId,
    landlordId,
    isActive: true,
  });

  if (!expense) {
    throw ApiError.notFound('Expense not found');
  }

  return expense;
};

const roundMoney = (value: number): number =>
  Math.round(value * 100) / 100;

const calcPercentage = (part: number, total: number): number =>
  total > 0 ? roundMoney((part / total) * 100) : 0;

const formatMonthLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split('-');
  const monthIndex = Number(month) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) return monthKey;
  return `${MONTH_LABELS[monthIndex]} ${year}`;
};

// ─── Create Expense ───────────────────────────────────────────────────────────

export const createExpense = async (
  propertyId: string,
  landlordId: string,
  input: CreateExpenseInput
): Promise<IExpenseDocument> => {
  await verifyPropertyOwnership(propertyId, landlordId);

  const expense = new Expense({
    propertyId,
    landlordId,
    date: parseDateOnly(input.date, 'date'),
    amount: input.amount,
    currency: DEFAULT_CURRENCY,
    category: input.category,
    description: input.description,
    isActive: true,
  });

  await expense.save();

  logger.info(
    `Expense created: ${input.category} — ${input.amount} for property ${propertyId}`
  );

  return expense;
};

// ─── List Expenses ────────────────────────────────────────────────────────────

export const listExpenses = async (
  propertyId: string,
  landlordId: string,
  query: ListExpensesQuery
): Promise<ListExpensesResult> => {
  await verifyPropertyOwnership(propertyId, landlordId);

  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    propertyId,
    landlordId,
    isActive: true,
  };

  if (query.category) filter.category = query.category;

  const dateRange = buildDateRangeFilter(query.startDate, query.endDate);
  if (dateRange) filter.date = dateRange;

  const [expenses, total, amountAgg] = await Promise.all([
    Expense.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
    Expense.countDocuments(filter),
    Expense.aggregate<{ _id: null; totalAmount: number }>([
      { $match: filter },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
    ]),
  ]);

  const meta = buildPaginationMeta(total, page, limit);
  const totalAmount = roundMoney(amountAgg[0]?.totalAmount ?? 0);

  return {
    expenses,
    total,
    page: meta.page,
    limit: meta.limit,
    totalPages: meta.totalPages,
    hasNextPage: meta.hasNextPage,
    hasPrevPage: meta.hasPrevPage,
    summary: {
      totalAmount,
      currency: DEFAULT_CURRENCY,
    },
  };
};

// ─── Get Single Expense ───────────────────────────────────────────────────────

export const getExpenseById = async (
  propertyId: string,
  expenseId: string,
  landlordId: string
): Promise<IExpenseDocument> => {
  await verifyPropertyOwnership(propertyId, landlordId);
  return getExpenseForLandlord(expenseId, propertyId, landlordId);
};

// ─── Update Expense ───────────────────────────────────────────────────────────

export const updateExpense = async (
  propertyId: string,
  expenseId: string,
  landlordId: string,
  input: UpdateExpenseInput
): Promise<IExpenseDocument> => {
  await verifyPropertyOwnership(propertyId, landlordId);
  const expense = await getExpenseForLandlord(expenseId, propertyId, landlordId);

  if (input.date !== undefined) {
    expense.date = parseDateOnly(input.date, 'date');
  }
  if (input.amount !== undefined) expense.amount = input.amount;
  if (input.category !== undefined) expense.category = input.category;
  if (input.description !== undefined) expense.description = input.description;

  await expense.save();

  logger.info(`Expense updated: ${expenseId} for property ${propertyId}`);

  return expense;
};

// ─── Soft Delete Expense ──────────────────────────────────────────────────────

export const deleteExpense = async (
  propertyId: string,
  expenseId: string,
  landlordId: string
): Promise<void> => {
  await verifyPropertyOwnership(propertyId, landlordId);
  const expense = await getExpenseForLandlord(expenseId, propertyId, landlordId);

  expense.isActive = false;
  await expense.save();

  logger.info(`Expense soft-deleted: ${expenseId} for property ${propertyId}`);
};

// ─── Expense Report ───────────────────────────────────────────────────────────

export const getExpenseReport = async (
  propertyId: string,
  landlordId: string,
  query: ExpenseReportQuery
): Promise<ExpenseReportResult> => {
  const property = await verifyPropertyOwnership(propertyId, landlordId);

  const filter: Record<string, unknown> = {
    propertyId: new mongoose.Types.ObjectId(propertyId),
    landlordId: new mongoose.Types.ObjectId(landlordId),
    isActive: true,
  };

  const dateRange = buildDateRangeFilter(query.startDate, query.endDate);
  if (dateRange) filter.date = dateRange;

  const [totals, grouped] = await Promise.all([
    Expense.aggregate<{ totalAmount: number; totalCount: number }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalCount: { $sum: 1 },
        },
      },
    ]),
    query.groupBy === 'category'
      ? Expense.aggregate<{ _id: string; amount: number; count: number }>([
          { $match: filter },
          {
            $group: {
              _id: '$category',
              amount: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { amount: -1 } },
        ])
      : Expense.aggregate<{ _id: { year: number; month: number }; amount: number; count: number }>([
          { $match: filter },
          {
            $group: {
              _id: {
                year: { $year: '$date' },
                month: { $month: '$date' },
              },
              amount: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': -1, '_id.month': -1 } },
        ]),
  ]);

  const totalAmount = roundMoney(totals[0]?.totalAmount ?? 0);
  const totalCount = totals[0]?.totalCount ?? 0;

  if (query.groupBy === 'category') {
    const breakdown: CategoryReportItem[] = (
      grouped as Array<{ _id: string; amount: number; count: number }>
    ).map((item) => ({
      category: item._id as CategoryReportItem['category'],
      amount: roundMoney(item.amount),
      percentage: calcPercentage(item.amount, totalAmount),
      count: item.count,
    }));

    return {
      propertyId,
      propertyName: property.propertyName,
      groupBy: 'category',
      totalAmount,
      currency: DEFAULT_CURRENCY,
      totalCount,
      breakdown,
    };
  }

  const breakdown: MonthReportItem[] = (
    grouped as Array<{ _id: { year: number; month: number }; amount: number; count: number }>
  ).map((item) => {
    const monthKey = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
    return {
      month: monthKey,
      label: formatMonthLabel(monthKey),
      amount: roundMoney(item.amount),
      percentage: calcPercentage(item.amount, totalAmount),
      count: item.count,
    };
  });

  return {
    propertyId,
    propertyName: property.propertyName,
    groupBy: 'month',
    totalAmount,
    currency: DEFAULT_CURRENCY,
    totalCount,
    breakdown,
  };
};
