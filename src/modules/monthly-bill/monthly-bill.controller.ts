/**
 * Monthly Bill Controller
 * Handles HTTP requests for all monthly bill endpoints
 */

import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import * as billService from './monthly-bill.service';
import {
  addBillSchema,
  updateBillSchema,
  updateStatusSchema,
  listBillsSchema,
} from './monthly-bill.validation';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import type {
  AuthUser,
  AddBillInput,
  UpdateBillInput,
  UpdateStatusInput,
  ListBillsQuery,
} from './monthly-bill.types';

// ─── Validation Helper ────────────────────────────────────────────────────────

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

const getAuthUser = (req: Request): AuthUser => {
  if (!req.user) {
    throw ApiError.unauthorized('User not authenticated');
  }
  return req.user as AuthUser;
};

// ─── POST / — Add a new bill ──────────────────────────────────────────────────

export const addBill = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);

    const input = validateBody<AddBillInput>(addBillSchema, req.body);

    const bill = await billService.addBill(input, user);

    res.status(201).json(
      ApiResponse.created('Monthly bill created successfully', { bill })
    );
  }
);

// ─── GET / — List bills with summary ─────────────────────────────────────────

export const listBills = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);

    const query = validateBody<ListBillsQuery>(listBillsSchema, req.query);

    const result = await billService.listBills(query, user);

    res.status(200).json(
      ApiResponse.ok(
        'Monthly bills retrieved successfully',
        {
          summary: result.summary,
          bills: result.bills,
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
          },
        }
      )
    );
  }
);

// ─── GET /:billId — Get single bill ──────────────────────────────────────────

export const getBillById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { billId } = req.params;

    const bill = await billService.getBillById(billId, user);

    res.status(200).json(
      ApiResponse.ok('Monthly bill retrieved successfully', { bill })
    );
  }
);

// ─── PATCH /:billId — Update bill fields ──────────────────────────────────────

export const updateBill = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { billId } = req.params;

    const input = validateBody<UpdateBillInput>(updateBillSchema, req.body);

    const bill = await billService.updateBill(billId, input, user);

    res.status(200).json(
      ApiResponse.ok('Monthly bill updated successfully', { bill })
    );
  }
);

// ─── PATCH /:billId/status — Update payment status only ──────────────────────

export const updateStatus = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { billId } = req.params;

    const input = validateBody<UpdateStatusInput>(updateStatusSchema, req.body);

    const bill = await billService.updateStatus(billId, input, user);

    res.status(200).json(
      ApiResponse.ok('Payment status updated successfully', { bill })
    );
  }
);

// ─── DELETE /:billId — Soft delete ───────────────────────────────────────────

export const deleteBill = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { billId } = req.params;

    await billService.softDeleteBill(billId, user);

    res.status(200).json(
      ApiResponse.ok('Monthly bill deleted successfully')
    );
  }
);
