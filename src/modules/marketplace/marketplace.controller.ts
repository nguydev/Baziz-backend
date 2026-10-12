import type { Request, Response } from 'express';
import Joi from 'joi';
import * as marketplaceService from './marketplace.service';
import * as mediaService from './marketplace-media.service';
import {
  browseJvSchema,
  browseListingsSchema,
  createInquirySchema,
  createJointVentureSchema,
  createNewPropertyListingSchema,
  createPortfolioListingSchema,
  getPropertiesMineSchema,
  mediaUploadSchema,
  savedToggleSchema,
  updateJointVentureSchema,
  updateListingSchema,
  valuationEstimateSchema,
} from './marketplace.validation';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import type {
  AuthUser,
  CreatePortfolioListingInput,
  CreateNewPropertyListingInput,
  CreateJointVentureInput,
  MediaUploadInput,
  BrowseListingsQuery,
  BrowseJvQuery,
  UpdateListingInput,
  UpdateJointVentureInput,
  CreateInquiryInput,
  ValuationEstimateInput,
} from './marketplace.types';
import { attachImageToBody, parseMarketplaceFormBody } from './marketplace.helpers';

const validate = <T>(schema: Joi.ObjectSchema<T>, data: unknown): T => {
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw ApiError.badRequest('Validation failed', error.details.map((d) => d.message));
  }
  return value as T;
};

const getAuthUser = (req: Request): AuthUser => {
  if (!req.user) throw ApiError.unauthorized('User not authenticated');
  return req.user as AuthUser;
};

export const getPropertiesMine = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const query = validate<{ excludeListed?: boolean }>(getPropertiesMineSchema, req.query);
  const data = await marketplaceService.getPropertiesForMarketplace(
    user._id.toString(),
    query.excludeListed ?? false
  );
  res.status(200).json(ApiResponse.ok('Properties retrieved successfully', data));
});

export const createPortfolioListing = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  attachImageToBody(req);
  const body = parseMarketplaceFormBody(req.body as Record<string, unknown>);
  const input = validate<CreatePortfolioListingInput>(createPortfolioListingSchema, body);
  const listing = await marketplaceService.createPortfolioListing(user, input);
  res.status(201).json(ApiResponse.created('Portfolio listing published successfully', { listing }));
});

export const createNewPropertyListing = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  attachImageToBody(req);
  const body = parseMarketplaceFormBody(req.body as Record<string, unknown>);
  const input = validate<CreateNewPropertyListingInput>(createNewPropertyListingSchema, body);
  const listing = await marketplaceService.createNewPropertyListing(user, input);
  res.status(201).json(ApiResponse.created('New property listing published successfully', { listing }));
});

export const createJointVenture = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  attachImageToBody(req);
  const body = parseMarketplaceFormBody(req.body as Record<string, unknown>);
  const input = validate<CreateJointVentureInput>(createJointVentureSchema, body);
  const jointVenture = await marketplaceService.createJointVenture(user, input);
  res.status(201).json(ApiResponse.created('Joint venture published successfully', { jointVenture }));
});

export const estimateValuation = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const input = validate(valuationEstimateSchema, req.body);
  const valuation = await marketplaceService.estimateValuation(user, input.propertyId);
  res.status(200).json(ApiResponse.ok('Valuation estimate generated', { valuation }));
});

export const createMediaUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const input = validate(mediaUploadSchema, req.body);
  const upload = await mediaService.createMediaUploadUrl(user, input);
  res.status(200).json(ApiResponse.ok('Upload URL generated', upload));
});

export const browseListings = asyncHandler(async (req: Request, res: Response) => {
  const query = validate(browseListingsSchema, req.query);
  if (query.savedOnly && !req.user) {
    throw ApiError.unauthorized('Authentication required to view saved listings');
  }
  const userId = req.user?._id?.toString();
  const { listings, meta } = await marketplaceService.browseListings(query, userId);
  res.status(200).json(ApiResponse.ok('Listings retrieved successfully', { listings }, meta));
});

export const browseJointVentures = asyncHandler(async (req: Request, res: Response) => {
  const query = validate(browseJvSchema, req.query);
  if (query.savedOnly && !req.user) {
    throw ApiError.unauthorized('Authentication required to view saved items');
  }
  const userId = req.user?._id?.toString();
  const { jointVentures, meta } = await marketplaceService.browseJointVentures(query, userId);
  res
    .status(200)
    .json(ApiResponse.ok('Joint ventures retrieved successfully', { jointVentures }, meta));
});

export const getListingById = asyncHandler(async (req: Request, res: Response) => {
  const listing = await marketplaceService.getListingById(req.params.id);
  res.status(200).json(ApiResponse.ok('Listing retrieved successfully', { listing }));
});

export const updateListing = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  attachImageToBody(req);
  const body = parseMarketplaceFormBody(req.body as Record<string, unknown>);
  const input = validate<UpdateListingInput>(updateListingSchema, body);
  const listing = await marketplaceService.updateListing(user, req.params.id, input);
  res.status(200).json(ApiResponse.ok('Listing updated successfully', { listing }));
});

export const deleteListing = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const result = await marketplaceService.deleteListing(user, req.params.id);
  res.status(200).json(ApiResponse.ok('Listing removed successfully', result));
});

export const updateJointVenture = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  attachImageToBody(req);
  const body = parseMarketplaceFormBody(req.body as Record<string, unknown>);
  const input = validate<UpdateJointVentureInput>(updateJointVentureSchema, body);
  const jointVenture = await marketplaceService.updateJointVenture(user, req.params.id, input);
  res.status(200).json(ApiResponse.ok('Joint venture updated successfully', { jointVenture }));
});

export const deleteJointVenture = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const result = await marketplaceService.deleteJointVenture(user, req.params.id);
  res.status(200).json(ApiResponse.ok('Joint venture removed successfully', result));
});

export const createListingInquiry = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const input = validate(createInquirySchema, req.body);
  const inquiry = await marketplaceService.createListingInquiry(user, req.params.id, input);
  res.status(201).json(ApiResponse.created('Inquiry submitted successfully', { inquiry }));
});

export const toggleSavedItem = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const { type } = validate<{ type: 'listing' | 'joint_venture' }>(savedToggleSchema, req.query);
  const result = await marketplaceService.toggleSavedItem(user, req.params.id, type);
  res.status(200).json(ApiResponse.ok('Saved status updated', result));
});
