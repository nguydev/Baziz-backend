/**
 * Property Expense Controller
 */

import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import * as expenseService from './expense.service';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesSchema,
  expenseReportSchema,
} from './expense.validation';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesQuery,
  ExpenseReportQuery,
} from './expense.types';

const validateBody = <T>(schema: Joi.Schema, body: unknown): T => {
  const { error, value } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((d) => d.message);
    throw ApiError.badRequest('Validation failed', errors);
  }

  return value as T;
};

const getLandlordId = (req: Request): string => {
  const id = req.user?._id?.toString();
  if (!id) throw ApiError.unauthorized('User not authenticated');
  return id;
};

const getPropertyId = (req: Request): string => {
  const propertyId = req.params.propertyId;
  if (!propertyId) throw ApiError.badRequest('Property ID is required');
  return propertyId;
};

// POST /properties/:propertyId/expenses
export const createExpense = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const input = validateBody<CreateExpenseInput>(createExpenseSchema, req.body);
    const expense = await expenseService.createExpense(
      getPropertyId(req),
      getLandlordId(req),
      input
    );

    res.status(201).json(
      ApiResponse.created('Expense added successfully', { expense })
    );
  }
);

// GET /properties/:propertyId/expenses
export const listExpenses = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const query = validateBody<ListExpensesQuery>(listExpensesSchema, req.query);
    const result = await expenseService.listExpenses(
      getPropertyId(req),
      getLandlordId(req),
      query
    );

    res.status(200).json(
      ApiResponse.ok('Expenses retrieved successfully', {
        expenses: result.expenses,
        summary: result.summary,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNextPage: result.hasNextPage,
          hasPrevPage: result.hasPrevPage,
        },
      })
    );
  }
);

// GET /properties/:propertyId/expenses/report
export const getExpenseReport = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const query = validateBody<ExpenseReportQuery>(expenseReportSchema, req.query);
    const report = await expenseService.getExpenseReport(
      getPropertyId(req),
      getLandlordId(req),
      query
    );

    res.status(200).json(
      ApiResponse.ok('Expense report generated successfully', { report })
    );
  }
);

// GET /properties/:propertyId/expenses/:expenseId
export const getExpenseById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const expense = await expenseService.getExpenseById(
      getPropertyId(req),
      req.params.expenseId,
      getLandlordId(req)
    );

    res.status(200).json(
      ApiResponse.ok('Expense retrieved successfully', { expense })
    );
  }
);

// PATCH /properties/:propertyId/expenses/:expenseId
export const updateExpense = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const input = validateBody<UpdateExpenseInput>(updateExpenseSchema, req.body);
    const expense = await expenseService.updateExpense(
      getPropertyId(req),
      req.params.expenseId,
      getLandlordId(req),
      input
    );

    res.status(200).json(
      ApiResponse.ok('Expense updated successfully', { expense })
    );
  }
);

// DELETE /properties/:propertyId/expenses/:expenseId
export const deleteExpense = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    await expenseService.deleteExpense(
      getPropertyId(req),
      req.params.expenseId,
      getLandlordId(req)
    );

    res.status(200).json(ApiResponse.ok('Expense deleted successfully'));
  }
);
