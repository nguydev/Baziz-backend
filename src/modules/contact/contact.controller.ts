/**
 * Contact Controller
 * HTTP request handlers for landlord contact management
 */

import type { Request, Response } from 'express';
import Joi from 'joi';
import * as contactService from './contact.service';
import * as contactValidation from './contact.validation';
import type { IContactDocument } from './contact.model';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';

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

const formatContact = (contact: IContactDocument) => {
  return {
    id: contact._id,
    company: contact.company,
    contactPerson: contact.contactPerson,
    phone: contact.phone,
    email: contact.email ?? null,
    profession: contact.profession,
    notes: contact.notes ?? null,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
};

export const createContact = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);

  const input = validateBody<contactValidation.CreateContactInput>(
    contactValidation.createContactSchema,
    req.body
  );

  const contact = await contactService.createContact(input, landlordId);

  res.status(201).json(
    ApiResponse.created('Contact created successfully', { contact: formatContact(contact) })
  );
});

export const getContacts = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);

  const query = validateBody<contactValidation.GetContactsQuery>(
    contactValidation.getContactsSchema,
    req.query
  );

  const { contacts, meta } = await contactService.getContacts(landlordId, query);

  res.status(200).json(
    ApiResponse.ok(
      'Contacts retrieved successfully',
      contacts.map((c) => formatContact(c)),
      meta
    )
  );
});

export const getContactStats = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  const stats = await contactService.getContactStats(landlordId);

  res.status(200).json(ApiResponse.ok('Contact stats retrieved', { stats }));
});

export const getContactById = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  const contact = await contactService.getContactById(req.params.id, landlordId);

  res.status(200).json(
    ApiResponse.ok('Contact retrieved successfully', { contact: formatContact(contact) })
  );
});

export const updateContact = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);

  const input = validateBody<contactValidation.UpdateContactInput>(
    contactValidation.updateContactSchema,
    req.body
  );

  const contact = await contactService.updateContact(req.params.id, landlordId, input);

  res.status(200).json(
    ApiResponse.ok('Contact updated successfully', { contact: formatContact(contact) })
  );
});

export const deleteContact = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  await contactService.deleteContact(req.params.id, landlordId);

  res.status(200).json(ApiResponse.ok('Contact deleted successfully'));
});
