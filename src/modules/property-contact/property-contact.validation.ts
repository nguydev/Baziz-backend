/**
 * Property Contact Validation
 */

import Joi from 'joi';
import type {
  CreatePropertyContactInput,
  UpdatePropertyContactInput,
  ListPropertyContactsQuery,
  PropertyContactProfession,
} from './property-contact.types';

const PROFESSIONS: PropertyContactProfession[] = [
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

export const createPropertyContactSchema = Joi.object<CreatePropertyContactInput>({
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
      'string.pattern.base': 'Invalid phone number format',
    }),
  email: Joi.string().trim().email().optional().allow('', null).messages({
    'string.email': 'Please provide a valid email',
  }),
  profession: Joi.string()
    .valid(...PROFESSIONS)
    .required()
    .messages({
      'any.only': `Profession must be one of: ${PROFESSIONS.join(', ')}`,
      'any.required': 'Profession is required',
    }),
  notes: Joi.string().trim().optional().max(500).allow('', null).messages({
    'string.max': 'Notes cannot exceed 500 characters',
  }),
}).options({ stripUnknown: true });

export const updatePropertyContactSchema = Joi.object<UpdatePropertyContactInput>({
  company: Joi.string().trim().optional().max(150),
  contactPerson: Joi.string().trim().optional().max(100),
  phone: Joi.string()
    .trim()
    .optional()
    .pattern(/^[+\d\s\-()]{7,20}$/)
    .messages({
      'string.pattern.base': 'Invalid phone number format',
    }),
  email: Joi.string().trim().email().optional().allow('', null),
  profession: Joi.string().valid(...PROFESSIONS).optional(),
  notes: Joi.string().trim().optional().max(500).allow('', null),
})
  .min(1)
  .messages({ 'object.min': 'At least one field must be provided to update' })
  .options({ stripUnknown: true });

export const listPropertyContactsSchema = Joi.object<ListPropertyContactsQuery>({
  profession: Joi.string().valid(...PROFESSIONS).optional(),
  search: Joi.string().trim().optional().max(100).allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).options({ stripUnknown: true });
