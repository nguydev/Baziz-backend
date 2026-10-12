/**
 * Property Contact Controller
 */

import type { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import * as propertyContactService from './property-contact.service';
import {
  createPropertyContactSchema,
  updatePropertyContactSchema,
  listPropertyContactsSchema,
} from './property-contact.validation';
import type { IPropertyContactDocument } from './property-contact.model';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import type {
  CreatePropertyContactInput,
  UpdatePropertyContactInput,
  ListPropertyContactsQuery,
} from './property-contact.types';

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

const formatContact = (contact: IPropertyContactDocument) => ({
  id: contact._id,
  propertyId: contact.propertyId,
  company: contact.company,
  contactPerson: contact.contactPerson,
  phone: contact.phone,
  email: contact.email ?? null,
  profession: contact.profession,
  notes: contact.notes ?? null,
  createdAt: contact.createdAt,
  updatedAt: contact.updatedAt,
});

export const createPropertyContact = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const input = validateBody<CreatePropertyContactInput>(
      createPropertyContactSchema,
      req.body
    );

    const contact = await propertyContactService.createPropertyContact(
      req.params.propertyId,
      getLandlordId(req),
      input
    );

    res.status(201).json(
      ApiResponse.created('Property contact added successfully', {
        contact: formatContact(contact),
      })
    );
  }
);

export const listPropertyContacts = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const query = validateBody<ListPropertyContactsQuery>(
      listPropertyContactsSchema,
      req.query
    );

    const result = await propertyContactService.listPropertyContacts(
      req.params.propertyId,
      getLandlordId(req),
      query
    );

    res.status(200).json(
      ApiResponse.ok('Property contacts retrieved successfully', {
        contacts: result.contacts.map(formatContact),
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

export const getPropertyContactById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const contact = await propertyContactService.getPropertyContactById(
      req.params.propertyId,
      req.params.contactId,
      getLandlordId(req)
    );

    res.status(200).json(
      ApiResponse.ok('Property contact retrieved successfully', {
        contact: formatContact(contact),
      })
    );
  }
);

export const updatePropertyContact = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const input = validateBody<UpdatePropertyContactInput>(
      updatePropertyContactSchema,
      req.body
    );

    const contact = await propertyContactService.updatePropertyContact(
      req.params.propertyId,
      req.params.contactId,
      getLandlordId(req),
      input
    );

    res.status(200).json(
      ApiResponse.ok('Property contact updated successfully', {
        contact: formatContact(contact),
      })
    );
  }
);

export const deletePropertyContact = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    await propertyContactService.deletePropertyContact(
      req.params.propertyId,
      req.params.contactId,
      getLandlordId(req)
    );

    res.status(200).json(ApiResponse.ok('Property contact deleted successfully'));
  }
);
