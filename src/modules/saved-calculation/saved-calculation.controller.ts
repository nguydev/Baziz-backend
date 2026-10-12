import { Request, Response } from "express";
import Joi from "joi";

import ApiResponse from "../../utils/ApiResponse";
import ApiError from "../../utils/ApiError";
import * as calcService from "./saved-calculation.service";
import {
  saveCalculationSchema,
  updateCalculationSchema,
} from "./saved-calculation.validation";
import type { CalculatorType, SaveCalculationInput, UpdateCalculationInput } from "./saved-calculation.types";
import asyncHandler from "../../utils/asyncHandler";

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

export const saveCalculation = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id?.toString();
    if (!userId) throw ApiError.unauthorized();

    const input = validateBody<SaveCalculationInput>(saveCalculationSchema, req.body);
    const calc = await calcService.saveCalculation(userId, input);

    res
      .status(201)
      .json(ApiResponse.created("Calculation saved successfully", { calc }));
  },
);

export const getSavedCalculations = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id?.toString();
    if (!userId) throw ApiError.unauthorized();

    const type = req.query.type as CalculatorType | undefined;
    const calcs = await calcService.getSavedCalculations(userId, type);

    res
      .status(200)
      .json(ApiResponse.ok("Calculations retrieved successfully", { calcs }));
  },
);

export const updateCalculation = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id?.toString();
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const input = validateBody<UpdateCalculationInput>(updateCalculationSchema, req.body);
    const calc = await calcService.updateCalculation(userId, id, input);

    res
      .status(200)
      .json(ApiResponse.ok("Calculation updated successfully", { calc }));
  },
);

export const deleteCalculation = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id?.toString();
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    await calcService.deleteCalculation(userId, id);

    res.status(200).json(ApiResponse.ok("Calculation deleted successfully"));
  },
);

export const enableSharing = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id?.toString();
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const calc = await calcService.enableSharing(userId, id);

    res
      .status(200)
      .json(ApiResponse.ok("Sharing enabled successfully", { calc }));
  },
);

export const disableSharing = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id?.toString();
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const calc = await calcService.disableSharing(userId, id);

    res
      .status(200)
      .json(ApiResponse.ok("Sharing disabled successfully", { calc }));
  },
);

export const getSharedCalculation = asyncHandler(
  async (req: Request, res: Response) => {
    const { token } = req.params;
    const calc = await calcService.getSharedCalculation(token);

    res
      .status(200)
      .json(
        ApiResponse.ok("Shared calculation retrieved successfully", { calc }),
      );
  },
);
