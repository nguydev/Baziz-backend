/**
 * Maintenance Request Controller
 * Handles HTTP requests for all maintenance request endpoints
 */

import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import * as maintenanceService from './maintenance-request.service';
import {
  createMaintenanceRequestSchema,
  updateStatusSchema,
  addCommentSchema,
  listRequestsSchema,
} from './maintenance-request.validation';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import type {
  AuthUser,
  CreateMaintenanceRequestInput,
  UpdateStatusInput,
  AddCommentInput,
  ListRequestsQuery,
} from './maintenance-request.types';

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

// ─── POST / — Submit Maintenance Request (Tenant) ────────────────────────────

export const submitRequest = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);

    const input = validateBody<CreateMaintenanceRequestInput>(
      createMaintenanceRequestSchema,
      req.body
    );

    const files = Array.isArray(req.files)
      ? (req.files as Express.Multer.File[])
      : undefined;

    const maintenanceRequest = await maintenanceService.submitRequest(
      input,
      user,
      files,
      req
    );

    res.status(201).json(
      ApiResponse.created('Maintenance request submitted successfully', {
        maintenanceRequest,
      })
    );
  }
);

// ─── GET / — List Requests ────────────────────────────────────────────────────

export const listRequests = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);

    const query = validateBody<ListRequestsQuery>(
      listRequestsSchema,
      req.query
    );

    const result = await maintenanceService.listRequests(query, user);

    res.status(200).json(
      ApiResponse.ok(
        'Maintenance requests retrieved successfully',
        {
          requests: result.requests,
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

// ─── GET /:requestId — Get Single Request ─────────────────────────────────────

export const getRequestById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { requestId } = req.params;

    const maintenanceRequest = await maintenanceService.getRequestById(
      requestId,
      user
    );

    res.status(200).json(
      ApiResponse.ok('Maintenance request retrieved successfully', {
        maintenanceRequest,
      })
    );
  }
);

// ─── PATCH /:requestId/status — Update Status (Landlord) ─────────────────────

export const updateStatus = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { requestId } = req.params;

    const input = validateBody<UpdateStatusInput>(
      updateStatusSchema,
      req.body
    );

    const maintenanceRequest = await maintenanceService.updateStatus(
      requestId,
      input,
      user
    );

    res.status(200).json(
      ApiResponse.ok('Status updated successfully', {
        maintenanceRequest,
      })
    );
  }
);

// ─── POST /:requestId/comments — Add Comment ─────────────────────────────────

export const addComment = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { requestId } = req.params;

    const input = validateBody<AddCommentInput>(
      addCommentSchema,
      req.body
    );

    const maintenanceRequest = await maintenanceService.addComment(
      requestId,
      input,
      user
    );

    res.status(200).json(
      ApiResponse.ok('Comment added successfully', {
        comments: maintenanceRequest.comments,
      })
    );
  }
);

// ─── DELETE /:requestId — Soft Delete (Tenant) ───────────────────────────────

export const softDeleteRequest = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { requestId } = req.params;

    await maintenanceService.softDeleteRequest(requestId, user);

    res.status(200).json(
      ApiResponse.ok('Maintenance request deleted successfully')
    );
  }
);
