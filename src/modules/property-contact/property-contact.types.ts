/**
 * Property Contact Types
 */

import mongoose from 'mongoose';
import type { IPropertyContactDocument } from './property-contact.model';

export type PropertyContactProfession =
  | 'electrician'
  | 'plumber'
  | 'landscaper'
  | 'carpenter'
  | 'painter'
  | 'hvac'
  | 'general_contractor'
  | 'locksmith'
  | 'pest_control'
  | 'cleaner'
  | 'other';

export interface IPropertyContact {
  propertyId: mongoose.Types.ObjectId;
  landlordId: mongoose.Types.ObjectId;
  company: string;
  contactPerson: string;
  phone: string;
  email: string | null;
  profession: PropertyContactProfession;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePropertyContactInput {
  company: string;
  contactPerson: string;
  phone: string;
  email?: string | null;
  profession: PropertyContactProfession;
  notes?: string | null;
}

export interface UpdatePropertyContactInput {
  company?: string;
  contactPerson?: string;
  phone?: string;
  email?: string | null;
  profession?: PropertyContactProfession;
  notes?: string | null;
}

export interface ListPropertyContactsQuery {
  profession?: PropertyContactProfession;
  search?: string;
  page: number;
  limit: number;
}

export interface ListPropertyContactsResult {
  contacts: IPropertyContactDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
