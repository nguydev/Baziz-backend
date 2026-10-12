/**
 * Maintenance Request Validation Schemas
 * Joi schemas for all maintenance request endpoints
 */

import Joi from 'joi';
import type {
  CreateMaintenanceRequestInput,
  UpdateStatusInput,
  AddCommentInput,
  ListRequestsQuery,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
} from './maintenance-request.types';

// ─── Valid Enum Values ─────────────────────────────────────────────────────────

const MAINTENANCE_CATEGORIES: MaintenanceCategory[] = [
  'plumbing',
  'electrical',
  'heating_cooling',
  'appliances',
  'structural',
  'pest_control',
  'security',
  'cleaning',
  'other',
];

const MAINTENANCE_PRIORITIES: MaintenancePriority[] = ['low', 'medium', 'high', 'emergency'];

const MAINTENANCE_STATUSES: MaintenanceStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

// ─── Create Maintenance Request ───────────────────────────────────────────────

export const createMaintenanceRequestSchema = Joi.object<CreateMaintenanceRequestInput>({
  title: Joi.string().trim().min(1).max(150).required().messages({
    'string.empty': 'Title is required',
    'string.max': 'Title cannot exceed 150 characters',
    'any.required': 'Title is required',
  }),
  category: Joi.string()
    .valid(...MAINTENANCE_CATEGORIES)
    .required()
    .messages({
      'any.only': `Category must be one of: ${MAINTENANCE_CATEGORIES.join(', ')}`,
      'any.required': 'Category is required',
    }),
  priority: Joi.string()
    .valid(...MAINTENANCE_PRIORITIES)
    .required()
    .messages({
      'any.only': `Priority must be one of: ${MAINTENANCE_PRIORITIES.join(', ')}`,
      'any.required': 'Priority is required',
    }),
  description: Joi.string().trim().min(1).max(2000).required().messages({
    'string.empty': 'Description is required',
    'string.max': 'Description cannot exceed 2000 characters',
    'any.required': 'Description is required',
  }),
  propertyId: Joi.string().optional(),
  cost: Joi.number().min(0).optional(),
}).options({ stripUnknown: true }); // strips any 'status' field from the body

// ─── Update Status ────────────────────────────────────────────────────────────

export const updateStatusSchema = Joi.object<UpdateStatusInput>({
  status: Joi.string()
    .valid(...MAINTENANCE_STATUSES)
    .required()
    .messages({
      'any.only': `Status must be one of: ${MAINTENANCE_STATUSES.join(', ')}`,
      'any.required': 'Status is required',
    }),
});

// ─── Add Comment ──────────────────────────────────────────────────────────────

export const addCommentSchema = Joi.object<AddCommentInput>({
  body: Joi.string().trim().min(1).max(2000).required().messages({
    'string.empty': 'Comment body is required',
    'string.max': 'Comment cannot exceed 2000 characters',
    'any.required': 'Comment body is required',
  }),
});

// ─── List Requests Query ──────────────────────────────────────────────────────

export const listRequestsSchema = Joi.object<ListRequestsQuery>({
  status: Joi.string()
    .valid(...MAINTENANCE_STATUSES)
    .optional(),
  priority: Joi.string()
    .valid(...MAINTENANCE_PRIORITIES)
    .optional(),
  category: Joi.string()
    .valid(...MAINTENANCE_CATEGORIES)
    .optional(),
  propertyId: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).options({ stripUnknown: true });
