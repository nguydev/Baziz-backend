/**
 * Expense Validation Schemas
 */

import Joi from 'joi';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesQuery,
  ExpenseReportQuery,
  ExpenseCategory,
  ExpenseReportGroupBy,
} from './expense.types';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'repairs',
  'utilities',
  'taxes',
  'insurance',
  'maintenance',
];

const REPORT_GROUP_BY: ExpenseReportGroupBy[] = ['category', 'month'];

const isoDateSchema = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .messages({
    'string.pattern.base': 'Date must be in YYYY-MM-DD format',
  });

export const createExpenseSchema = Joi.object<CreateExpenseInput>({
  date: isoDateSchema.required().messages({
    'any.required': 'Date is required',
  }),
  amount: Joi.number().positive().precision(2).required().messages({
    'number.positive': 'Amount must be greater than zero',
    'any.required': 'Amount is required',
  }),
  category: Joi.string()
    .valid(...EXPENSE_CATEGORIES)
    .required()
    .messages({
      'any.only': `Category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`,
      'any.required': 'Category is required',
    }),
  description: Joi.string().trim().min(1).max(500).required().messages({
    'string.empty': 'Description is required',
    'string.max': 'Description cannot exceed 500 characters',
    'any.required': 'Description is required',
  }),
}).options({ stripUnknown: true });

export const updateExpenseSchema = Joi.object<UpdateExpenseInput>({
  date: isoDateSchema.optional(),
  amount: Joi.number().positive().precision(2).optional(),
  category: Joi.string().valid(...EXPENSE_CATEGORIES).optional(),
  description: Joi.string().trim().min(1).max(500).optional(),
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided to update',
  })
  .options({ stripUnknown: true });

export const listExpensesSchema = Joi.object<ListExpensesQuery>({
  category: Joi.string().valid(...EXPENSE_CATEGORIES).optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).options({ stripUnknown: true });

export const expenseReportSchema = Joi.object<ExpenseReportQuery>({
  groupBy: Joi.string()
    .valid(...REPORT_GROUP_BY)
    .default('category'),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
}).options({ stripUnknown: true });
