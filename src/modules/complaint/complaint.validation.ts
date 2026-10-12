/**
 * Complaint Validation Schemas
 */

import Joi from 'joi';
import type {
  CreateComplaintInput,
  UpdateComplaintStatusInput,
  ListComplaintsQuery,
  ComplaintCategory,
  ComplaintUrgency,
  ComplaintStatus,
} from './complaint.types';

const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  'property_condition',
  'noise',
  'neighbour_dispute',
  'billing',
  'communication',
  'other',
];

const COMPLAINT_URGENCIES: ComplaintUrgency[] = ['low', 'medium', 'high'];

const COMPLAINT_STATUSES: ComplaintStatus[] = [
  'in_review',
  'in_progress',
  'resolved',
  'closed',
];

export const createComplaintSchema = Joi.object<CreateComplaintInput>({
  category: Joi.string()
    .valid(...COMPLAINT_CATEGORIES)
    .required()
    .messages({
      'any.only': `Category must be one of: ${COMPLAINT_CATEGORIES.join(', ')}`,
      'any.required': 'Category is required',
    }),
  title: Joi.string().trim().min(1).max(150).required().messages({
    'string.empty': 'Title is required',
    'string.max': 'Title cannot exceed 150 characters',
    'any.required': 'Title is required',
  }),
  description: Joi.string().trim().min(1).max(2000).required().messages({
    'string.empty': 'Description is required',
    'string.max': 'Description cannot exceed 2000 characters',
    'any.required': 'Description is required',
  }),
  urgency: Joi.string()
    .valid(...COMPLAINT_URGENCIES)
    .required()
    .messages({
      'any.only': `Urgency must be one of: ${COMPLAINT_URGENCIES.join(', ')}`,
      'any.required': 'Urgency is required',
    }),
}).options({ stripUnknown: true });

export const updateComplaintStatusSchema = Joi.object<UpdateComplaintStatusInput>({
  status: Joi.string()
    .valid(...COMPLAINT_STATUSES)
    .required()
    .messages({
      'any.only': `Status must be one of: ${COMPLAINT_STATUSES.join(', ')}`,
      'any.required': 'Status is required',
    }),
});

export const listComplaintsSchema = Joi.object<ListComplaintsQuery>({
  status: Joi.string()
    .valid(...COMPLAINT_STATUSES)
    .optional(),
  urgency: Joi.string()
    .valid(...COMPLAINT_URGENCIES)
    .optional(),
  category: Joi.string()
    .valid(...COMPLAINT_CATEGORIES)
    .optional(),
  propertyId: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).options({ stripUnknown: true });
