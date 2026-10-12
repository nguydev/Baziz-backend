/**
 * Property Expense Types
 */

import mongoose from 'mongoose';
import type { IExpenseDocument } from './expense.model';

export type ExpenseCategory =
  | 'repairs'
  | 'utilities'
  | 'taxes'
  | 'insurance'
  | 'maintenance';

export type ExpenseReportGroupBy = 'category' | 'month';

export interface IExpense {
  propertyId: mongoose.Types.ObjectId;
  landlordId: mongoose.Types.ObjectId;
  date: Date;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  description: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExpenseInput {
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
}

export interface UpdateExpenseInput {
  date?: string;
  amount?: number;
  category?: ExpenseCategory;
  description?: string;
}

export interface ListExpensesQuery {
  category?: ExpenseCategory;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

export interface ExpenseReportQuery {
  groupBy: ExpenseReportGroupBy;
  startDate?: string;
  endDate?: string;
}

export interface CategoryReportItem {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
  count: number;
}

export interface MonthReportItem {
  month: string;
  label: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface ExpenseReportResult {
  propertyId: string;
  propertyName: string;
  groupBy: ExpenseReportGroupBy;
  totalAmount: number;
  currency: string;
  totalCount: number;
  breakdown: CategoryReportItem[] | MonthReportItem[];
}

export interface ListExpensesResult {
  expenses: IExpenseDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  summary: {
    totalAmount: number;
    currency: string;
  };
}
