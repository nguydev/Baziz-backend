/**
 * Property Document Controller
 */

import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import * as documentService from './property-document.service';
import {
  uploadDocumentSchema,
  listDocumentsSchema,
} from './property-document.validation';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import type { AuthUser, UploadDocumentInput, ListDocumentsQuery } from './property-document.types';

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
  if (!req.user) throw ApiError.unauthorized('User not authenticated');
  return req.user as AuthUser;
};

// POST /properties/:propertyId/documents OR POST /documents
export const uploadDocument = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);

    if (!req.file) {
      throw ApiError.badRequest('Document file is required');
    }

    const input = validateBody<UploadDocumentInput>(uploadDocumentSchema, req.body);
    const propertyId = req.params.propertyId || input.propertyId;

    const document = await documentService.uploadDocument(
      propertyId,
      user,
      req.file,
      input,
      req
    );

    res.status(201).json(
      ApiResponse.created('Document uploaded successfully', { document })
    );
  }
);

// GET /documents
export const listAllLandlordDocuments = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const query = validateBody<ListDocumentsQuery>(listDocumentsSchema, req.query);

    const result = await documentService.listAllLandlordDocuments(user, query);

    res.status(200).json(
      ApiResponse.ok('Documents retrieved successfully', {
        documents: result.documents,
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

// GET /properties/:propertyId/documents
export const listDocuments = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);
    const query = validateBody<ListDocumentsQuery>(listDocumentsSchema, req.query);

    const result = await documentService.listDocuments(
      req.params.propertyId,
      user,
      query
    );

    res.status(200).json(
      ApiResponse.ok('Documents retrieved successfully', {
        documents: result.documents,
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

// GET /properties/:propertyId/documents/:documentId
export const getDocumentById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);

    const document = await documentService.getDocumentById(
      req.params.propertyId,
      req.params.documentId,
      user
    );

    res.status(200).json(
      ApiResponse.ok('Document retrieved successfully', { document })
    );
  }
);

// DELETE /properties/:propertyId/documents/:documentId OR DELETE /documents/:documentId
export const deleteDocument = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const user = getAuthUser(req);

    await documentService.deleteDocument(
      req.params.propertyId,
      req.params.documentId,
      user
    );

    res.status(200).json(ApiResponse.ok('Document deleted successfully'));
  }
);

// GET /tenants/my-property/documents
export const listMyPropertyDocuments = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const tenantId = req.user?._id?.toString();
    if (!tenantId) throw ApiError.unauthorized('User not authenticated');

    const query = validateBody<ListDocumentsQuery>(listDocumentsSchema, req.query);

    const result = await documentService.listMyPropertyDocuments(tenantId, query);

    res.status(200).json(
      ApiResponse.ok('Property documents retrieved successfully', {
        propertyId: result.propertyId,
        propertyName: result.propertyName,
        documents: result.documents,
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
