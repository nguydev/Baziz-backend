import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";
import * as ownershipEntityService from "./ownership-entity.service";

export const createOwnershipEntity = asyncHandler(async (req: Request, res: Response) => {
  const entity = await ownershipEntityService.createOwnershipEntity(req.user!.id, req.body);
  res.status(201).json(new ApiResponse(201, "Ownership Entity created successfully", entity));
});

export const getOwnershipEntities = asyncHandler(async (req: Request, res: Response) => {
  const entities = await ownershipEntityService.getOwnershipEntities(req.user!.id);
  res.status(200).json(new ApiResponse(200, "Ownership Entities fetched successfully", entities));
});

export const getOwnershipEntityById = asyncHandler(async (req: Request, res: Response) => {
  const entity = await ownershipEntityService.getOwnershipEntityById(req.user!.id, req.params.id);
  res.status(200).json(new ApiResponse(200, "Ownership Entity fetched successfully", entity));
});

export const updateOwnershipEntity = asyncHandler(async (req: Request, res: Response) => {
  const entity = await ownershipEntityService.updateOwnershipEntity(req.user!.id, req.params.id, req.body);
  res.status(200).json(new ApiResponse(200, "Ownership Entity updated successfully", entity));
});

export const deleteOwnershipEntity = asyncHandler(async (req: Request, res: Response) => {
  await ownershipEntityService.deleteOwnershipEntity(req.user!.id, req.params.id);
  res.status(200).json(new ApiResponse(200, "Ownership Entity deleted successfully", null));
});
