/**
 * Contact Validation Schemas
 * Joi-based validation for all contact endpoints
 */

import Joi from 'joi';
import type { ContactProfession } from './contact.model';

const PROFESSIONS: ContactProfession[] = [
  'electrician',
  'plumber',
  'landscaper',
  'carpenter',
  'painter',
  'hvac',
  'general_contractor',
  'locksmith',
  'pest_control',
  'cleaner',
  'other',
];

export const createContactSchema = Joi.object({
  company: Joi.string().trim().required().max(150).messages({
    'string.empty': 'Company name is required',
    'string.max': 'Company name cannot exceed 150 characters',
  }),
  contactPerson: Joi.string().trim().required().max(100).messages({
    'string.empty': 'Contact person name is required',
    'string.max': 'Contact person name cannot exceed 100 characters',
  }),
  phone: Joi.string()
    .trim()
    .required()
    .pattern(/^[+\d\s\-()]{7,20}$/)
    .messages({
      'string.empty': 'Phone number is required',
      'string.pattern.base': 'Invalid phone number format. Use digits, spaces, +, -, or ()',
    }),
  email: Joi.string().trim().email().optional().allow('', null).messages({
    'string.email': 'Please provide a valid email',
  }),
  profession: Joi.string()
    .valid(...PROFESSIONS)
    .required()
    .messages({
      'any.only': `Profession must be one of: ${PROFESSIONS.join(', ')}`,
      'string.empty': 'Profession is required',
    }),
  notes: Joi.string().trim().optional().max(500).allow('', null).messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
});

export const updateContactSchema = Joi.object({
  company: Joi.string().trim().optional().max(150).messages({
    'string.max': 'Company name cannot exceed 150 characters',
  }),
  contactPerson: Joi.string().trim().optional().max(100).messages({
    'string.max': 'Contact person name cannot exceed 100 characters',
  }),
  phone: Joi.string()
    .trim()
    .optional()
    .pattern(/^[+\d\s\-()]{7,20}$/)
    .messages({
      'string.pattern.base': 'Invalid phone number format. Use digits, spaces, +, -, or ()',
    }),
  email: Joi.string().trim().email().optional().allow('', null).messages({
    'string.email': 'Please provide a valid email',
  }),
  profession: Joi.string()
    .valid(...PROFESSIONS)
    .optional()
    .messages({
      'any.only': `Profession must be one of: ${PROFESSIONS.join(', ')}`,
    }),
  notes: Joi.string().trim().optional().max(500).allow('', null).messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
});

export const getContactsSchema = Joi.object({
  profession: Joi.string()
    .valid(...PROFESSIONS)
    .optional()
    .allow('')
    .messages({
      'any.only': `Profession must be one of: ${PROFESSIONS.join(', ')}`,
    }),
  search: Joi.string().trim().optional().max(100).allow('').messages({
    'string.max': 'Search query cannot exceed 100 characters',
  }),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});

export type CreateContactInput = {
  company: string;
  contactPerson: string;
  phone: string;
  email?: string | null;
  profession: ContactProfession;
  notes?: string | null;
};

export type UpdateContactInput = Partial<CreateContactInput>;

export type GetContactsQuery = {
  profession?: ContactProfession;
  search?: string;
  page: number;
  limit: number;
};
