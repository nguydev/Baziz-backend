/**
 * Complaint Controller
 * HTTP handlers for tenant complaint endpoints
 */

import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import * as complaintService from './complaint.service';
import {
  createComplaintSchema,
  updateComplaintStatusSchema,
  listComplaintsSchema,
} from './complaint.validation';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import type {
  AuthUser,
  CreateComplaintInput,
  UpdateComplaintStatusInput,
  ListComplaintsQuery,
} from './complaint.types';

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

// ─── POST / — Submit Complaint (Tenant) ───────────────────────────────────────

export const submitComplaint = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);

    const input = validateBody<CreateComplaintInput>(
      createComplaintSchema,
      req.body
    );

    const complaint = await complaintService.submitComplaint(input, user);

    res.status(201).json(
      ApiResponse.created('Complaint submitted successfully', { complaint })
    );
  }
);

// ─── GET / — List Complaints ──────────────────────────────────────────────────

export const listComplaints = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);

    const query = validateBody<ListComplaintsQuery>(
      listComplaintsSchema,
      req.query
    );

    const result = await complaintService.listComplaints(query, user);

    res.status(200).json(
      ApiResponse.ok('Complaints retrieved successfully', {
        complaints: result.complaints,
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

// ─── GET /:complaintId — Get Single Complaint ─────────────────────────────────

export const getComplaintById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { complaintId } = req.params;

    const complaint = await complaintService.getComplaintById(complaintId, user);

    res.status(200).json(
      ApiResponse.ok('Complaint retrieved successfully', { complaint })
    );
  }
);

// ─── PATCH /:complaintId/status — Update Status (Landlord) ────────────────────

export const updateStatus = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { complaintId } = req.params;

    const input = validateBody<UpdateComplaintStatusInput>(
      updateComplaintStatusSchema,
      req.body
    );

    const complaint = await complaintService.updateStatus(
      complaintId,
      input,
      user
    );

    res.status(200).json(
      ApiResponse.ok('Complaint status updated successfully', { complaint })
    );
  }
);

// ─── DELETE /:complaintId — Soft Delete (Tenant) ──────────────────────────────

export const softDeleteComplaint = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const { complaintId } = req.params;

    await complaintService.softDeleteComplaint(complaintId, user);

    res.status(200).json(ApiResponse.ok('Complaint deleted successfully'));
  }
);
