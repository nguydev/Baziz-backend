import { Request, Response } from 'express';
import Joi from 'joi';
import asyncHandler from '../../utils/asyncHandler';
import ApiResponse from '../../utils/ApiResponse';
import ApiError from '../../utils/ApiError';
import * as sdService from './stamp-duty.service';
import { createRateSetSchema } from './stamp-duty.validation';

import type { CreateRateSetInput } from './stamp-duty.types';

const validateBody = <T>(schema: Joi.Schema, body: unknown): T => {
  const { error, value } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw ApiError.badRequest(`Validation error: ${error.message}`);
  }
  return value;
};

export const getActiveRates = asyncHandler(async (req: Request, res: Response) => {
  const rates = await sdService.getActiveRates();
  res.status(200).json(ApiResponse.ok('Active rates retrieved', { rates }));
});

export const createProposal = asyncHandler(async (req: Request, res: Response) => {
  // Edge functions or Admin only
  const input = validateBody<CreateRateSetInput>(createRateSetSchema, req.body);
  const rateSet = await sdService.createProposal(input);
  res.status(201).json(ApiResponse.created('Proposal created', { rateSet }));
});

export const approveProposal = asyncHandler(async (req: Request, res: Response) => {
  // Admin only
  const { id } = req.params;
  const rateSet = await sdService.approveProposal(id);
  res.status(200).json(ApiResponse.ok('Proposal approved and set to active', { rateSet }));
});

export const getAllRateSets = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const filter: any = {};
  if (status) {
    filter.status = status;
  }

  const { rates, totalItems } = await sdService.getAllRateSets(filter, page, limit);
  const totalPages = Math.ceil(totalItems / limit);

  res.status(200).json(ApiResponse.ok('Rate sets retrieved', {
    rates,
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      limit,
    }
  }));
});

export const revertActiveRate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const rateSet = await sdService.revertActiveRateSet(id);
  res.status(200).json(ApiResponse.ok('Rate reverted to previous version', { rateSet }));
});
