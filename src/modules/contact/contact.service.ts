/**
 * Contact Service
 * Business logic for landlord's maintenance contact management
 */

import mongoose from 'mongoose';
import Contact from './contact.model';
import type { IContactDocument } from './contact.model';
import type { CreateContactInput, UpdateContactInput, GetContactsQuery } from './contact.validation';
import ApiError from '../../utils/ApiError';
import { buildPaginationMeta } from '../../utils/pagination';
import type { PaginationMeta } from '../../types/api.types';

/**
 * Escapes special regex characters to prevent regex injection attacks
 */
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const createContact = async (
  input: CreateContactInput,
  landlordId: string
): Promise<IContactDocument> => {
  const contactData = {
    landlordId: new mongoose.Types.ObjectId(landlordId),
    company: input.company,
    contactPerson: input.contactPerson,
    phone: input.phone,
    email: input.email || null,
    profession: input.profession,
    notes: input.notes || null,
  };

  const contact = await Contact.create(contactData);
  return contact;
};

export const getContacts = async (
  landlordId: string,
  query: GetContactsQuery
): Promise<{ contacts: IContactDocument[]; meta: PaginationMeta }> => {
  const { profession, search, page, limit } = query;

  const filter: Record<string, unknown> = {
    landlordId: new mongoose.Types.ObjectId(landlordId),
    isActive: true,
  };

  if (profession) {
    filter.profession = profession;
  }

  if (search && search.trim()) {
    const escapedSearch = escapeRegex(search.trim());
    filter.$or = [
      { company: { $regex: escapedSearch, $options: 'i' } },
      { contactPerson: { $regex: escapedSearch, $options: 'i' } },
      { phone: { $regex: escapedSearch, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [contacts, total] = await Promise.all([
    Contact.find(filter).sort({ company: 1, createdAt: -1 }).skip(skip).limit(limit),
    Contact.countDocuments(filter),
  ]);

  const meta = buildPaginationMeta(total, page, limit);

  return { contacts, meta };
};

export const getContactById = async (
  contactId: string,
  landlordId: string
): Promise<IContactDocument> => {
  if (!mongoose.Types.ObjectId.isValid(contactId)) {
    throw ApiError.badRequest('Invalid contact ID format');
  }

  const contact = await Contact.findOne({
    _id: contactId,
    landlordId: new mongoose.Types.ObjectId(landlordId),
    isActive: true,
  });

  if (!contact) {
    throw ApiError.notFound('Contact not found');
  }

  return contact;
};

export const updateContact = async (
  contactId: string,
  landlordId: string,
  input: UpdateContactInput
): Promise<IContactDocument> => {
  if (!mongoose.Types.ObjectId.isValid(contactId)) {
    throw ApiError.badRequest('Invalid contact ID format');
  }

  const updateData: Record<string, unknown> = {};

  if (input.company !== undefined) updateData.company = input.company;
  if (input.contactPerson !== undefined) updateData.contactPerson = input.contactPerson;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.email !== undefined) updateData.email = input.email || null;
  if (input.profession !== undefined) updateData.profession = input.profession;
  if (input.notes !== undefined) updateData.notes = input.notes || null;

  if (Object.keys(updateData).length === 0) {
    throw ApiError.badRequest('No fields provided for update');
  }

  const contact = await Contact.findOneAndUpdate(
    {
      _id: contactId,
      landlordId: new mongoose.Types.ObjectId(landlordId),
      isActive: true,
    },
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!contact) {
    throw ApiError.notFound('Contact not found');
  }

  return contact;
};

export const deleteContact = async (contactId: string, landlordId: string): Promise<void> => {
  if (!mongoose.Types.ObjectId.isValid(contactId)) {
    throw ApiError.badRequest('Invalid contact ID format');
  }

  const contact = await Contact.findOneAndUpdate(
    {
      _id: contactId,
      landlordId: new mongoose.Types.ObjectId(landlordId),
      isActive: true,
    },
    { $set: { isActive: false } },
    { new: true }
  );

  if (!contact) {
    throw ApiError.notFound('Contact not found');
  }
};

export const getContactStats = async (
  landlordId: string
): Promise<{ totalContacts: number; byProfession: Record<string, number> }> => {
  const result = await Contact.aggregate([
    {
      $match: {
        landlordId: new mongoose.Types.ObjectId(landlordId),
        isActive: true,
      },
    },
    {
      $group: {
        _id: '$profession',
        count: { $sum: 1 },
      },
    },
  ]);

  const byProfession: Record<string, number> = {};

  result.forEach((item) => {
    byProfession[item._id] = item.count;
  });

  const totalContacts = result.reduce((sum, item) => sum + item.count, 0);

  return { totalContacts, byProfession };
};
