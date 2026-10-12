/**
 * Property Contact Service
 */

import mongoose from 'mongoose';
import PropertyContact from './property-contact.model';
import type { IPropertyContactDocument } from './property-contact.model';
import { getPropertyById } from '../property/property.service';
import ApiError from '../../utils/ApiError';
import logger from '../../config/logger';
import { buildPaginationMeta } from '../../utils/pagination';
import type {
  CreatePropertyContactInput,
  UpdatePropertyContactInput,
  ListPropertyContactsQuery,
  ListPropertyContactsResult,
} from './property-contact.types';

const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeOptionalString = (value?: string | null): string | null => {
  if (value === undefined || value === null || value.trim() === '') return null;
  return value.trim();
};

const getContactForProperty = async (
  contactId: string,
  propertyId: string,
  landlordId: string
): Promise<IPropertyContactDocument> => {
  if (!mongoose.isValidObjectId(contactId)) {
    throw ApiError.badRequest('Invalid contact ID');
  }

  const contact = await PropertyContact.findOne({
    _id: contactId,
    propertyId,
    landlordId,
    isActive: true,
  });

  if (!contact) {
    throw ApiError.notFound('Contact not found');
  }

  return contact;
};

export const createPropertyContact = async (
  propertyId: string,
  landlordId: string,
  input: CreatePropertyContactInput
): Promise<IPropertyContactDocument> => {
  await getPropertyById(propertyId, landlordId);

  const contact = await PropertyContact.create({
    propertyId,
    landlordId,
    company: input.company,
    contactPerson: input.contactPerson,
    phone: input.phone,
    email: normalizeOptionalString(input.email),
    profession: input.profession,
    notes: normalizeOptionalString(input.notes),
    isActive: true,
  });

  logger.info(
    `Property contact added: ${input.company} (${input.profession}) for property ${propertyId}`
  );

  return contact;
};

export const listPropertyContacts = async (
  propertyId: string,
  landlordId: string,
  query: ListPropertyContactsQuery
): Promise<ListPropertyContactsResult> => {
  await getPropertyById(propertyId, landlordId);

  const { page, limit, profession, search } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {
    propertyId,
    landlordId,
    isActive: true,
  };

  if (profession) filter.profession = profession;

  if (search?.trim()) {
    const escaped = escapeRegex(search.trim());
    filter.$or = [
      { company: { $regex: escaped, $options: 'i' } },
      { contactPerson: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
    ];
  }

  const [contacts, total] = await Promise.all([
    PropertyContact.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    PropertyContact.countDocuments(filter),
  ]);

  const meta = buildPaginationMeta(total, page, limit);

  return {
    contacts,
    total,
    page: meta.page,
    limit: meta.limit,
    totalPages: meta.totalPages,
    hasNextPage: meta.hasNextPage,
    hasPrevPage: meta.hasPrevPage,
  };
};

export const getPropertyContactById = async (
  propertyId: string,
  contactId: string,
  landlordId: string
): Promise<IPropertyContactDocument> => {
  await getPropertyById(propertyId, landlordId);
  return getContactForProperty(contactId, propertyId, landlordId);
};

export const updatePropertyContact = async (
  propertyId: string,
  contactId: string,
  landlordId: string,
  input: UpdatePropertyContactInput
): Promise<IPropertyContactDocument> => {
  await getPropertyById(propertyId, landlordId);
  const contact = await getContactForProperty(contactId, propertyId, landlordId);

  if (input.company !== undefined) contact.company = input.company;
  if (input.contactPerson !== undefined) contact.contactPerson = input.contactPerson;
  if (input.phone !== undefined) contact.phone = input.phone;
  if (input.email !== undefined) contact.email = normalizeOptionalString(input.email);
  if (input.profession !== undefined) contact.profession = input.profession;
  if (input.notes !== undefined) contact.notes = normalizeOptionalString(input.notes);

  await contact.save();

  logger.info(`Property contact updated: ${contactId} for property ${propertyId}`);

  return contact;
};

export const deletePropertyContact = async (
  propertyId: string,
  contactId: string,
  landlordId: string
): Promise<void> => {
  await getPropertyById(propertyId, landlordId);
  const contact = await getContactForProperty(contactId, propertyId, landlordId);

  contact.isActive = false;
  await contact.save();

  logger.info(`Property contact deleted: ${contactId} for property ${propertyId}`);
};
