import Joi from 'joi';
import type { TaskPriority, TaskStatus, TaskCategory } from './task.model';

const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low'];
const STATUSES: TaskStatus[] = ['pending', 'in-progress', 'completed'];
const CATEGORIES: TaskCategory[] = ['inspection', 'compliance', 'maintenance', 'financial', 'administrative', 'tenant_management', 'other'];

const subtaskSchema = Joi.object({
  title: Joi.string().trim().required().messages({
    'string.empty': 'Subtask title is required',
  }),
  isCompleted: Joi.boolean().default(false),
  completedAt: Joi.alternatives()
    .try(Joi.date().iso(), Joi.valid(null, ''))
    .optional()
    .default(null),
});

const recurrenceSchema = Joi.object({
  pattern: Joi.string().lowercase().valid('none', 'weekly', 'monthly', 'quarterly', 'annually').default('none'),
  endDate: Joi.date().optional().allow(null),
});

export const createTaskSchema = Joi.object({
  title: Joi.string().trim().required().max(200).messages({
    'string.empty': 'Task title is required',
    'string.max': 'Title cannot exceed 200 characters',
  }),
  description: Joi.string().trim().optional().max(1000).allow('').messages({
    'string.max': 'Description cannot exceed 1000 characters',
  }),
  propertyId: Joi.string()
    .pattern(/^[a-fA-F0-9]{24}$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Invalid property ID format',
    }),
  assignedTo: Joi.string()
    .pattern(/^[a-fA-F0-9]{24}$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Invalid assigned user ID format',
    }),
  priority: Joi.string()
    .lowercase()
    .valid(...PRIORITIES)
    .required()
    .messages({
      'any.only': 'Priority must be high, medium, or low',
      'string.empty': 'Priority is required',
    }),
  status: Joi.string()
    .lowercase()
    .valid(...STATUSES)
    .optional()
    .default('pending')
    .messages({
      'any.only': 'Status must be pending, in-progress, or completed',
    }),
  category: Joi.string()
    .lowercase()
    .valid(...CATEGORIES)
    .required()
    .messages({
      'any.only': 'Category must be a valid option',
      'string.empty': 'Category is required',
    }),
  dueDate: Joi.date().required().messages({
    'date.base': 'Due date must be a valid date',
    'any.required': 'Due date is required',
  }),
  subtasks: Joi.array().items(subtaskSchema).optional().default([]),
  recurrence: recurrenceSchema.optional().default({ pattern: 'none' }),
});

// Reusable nullable-ObjectId rule: accepts a 24-char hex string, null, or ''
const nullableObjectId = Joi.alternatives()
  .try(
    Joi.string().pattern(/^[a-fA-F0-9]{24}$/).required(),
    Joi.valid(null, '').optional()
  )
  .optional();

export const updateTaskSchema = Joi.object({
  title: Joi.string().trim().optional().max(200).messages({
    'string.max': 'Title cannot exceed 200 characters',
  }),
  description: Joi.string().trim().optional().max(1000).allow('', null).messages({
    'string.max': 'Description cannot exceed 1000 characters',
  }),
  propertyId: nullableObjectId,
  assignedTo: nullableObjectId,
  priority: Joi.string()
    .lowercase()
    .valid(...PRIORITIES)
    .optional()
    .messages({
      'any.only': 'Priority must be high, medium, or low',
    }),
  status: Joi.string()
    .lowercase()
    .valid(...STATUSES)
    .optional()
    .messages({
      'any.only': 'Status must be pending, in-progress, or completed',
    }),
  category: Joi.string()
    .lowercase()
    .valid(...CATEGORIES)
    .optional()
    .messages({
      'any.only': 'Category must be a valid option',
    }),
  dueDate: Joi.date().optional().messages({
    'date.base': 'Due date must be a valid date',
  }),
  subtasks: Joi.array().items(subtaskSchema).optional(),
  recurrence: Joi.object({
    pattern: Joi.string().lowercase().valid('none', 'weekly', 'monthly', 'quarterly', 'annually').default('none'),
    endDate: Joi.alternatives()
      .try(Joi.date().required(), Joi.valid(null, '').optional())
      .optional(),
  }).optional(),
}).options({ stripUnknown: true });

export const searchTasksSchema = Joi.object({
  q: Joi.string().trim().optional().max(100).allow('').messages({
    'string.max': 'Search query cannot exceed 100 characters',
  }),
  dueDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Due date must be in YYYY-MM-DD format (e.g. 2026-06-10)',
    }),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
}).or('q', 'dueDate').messages({
  'object.missing': 'Provide at least q (keyword) or dueDate to search',
});

export type SearchTasksQuery = {
  q?: string;
  dueDate?: string;
  page: number;
  limit: number;
};

export const getTasksSchema = Joi.object({
  status: Joi.string().lowercase().valid('today', 'upcoming', 'pending', 'in-progress', 'completed').optional().messages({
    'any.only': 'Status must be today, upcoming, pending, in-progress, or completed',
  }),
  priority: Joi.string().lowercase().valid(...PRIORITIES).optional().messages({
    'any.only': 'Priority must be high, medium, or low',
  }),
  propertyId: Joi.string()
    .pattern(/^[a-fA-F0-9]{24}$/)
    .optional()
    .allow(''),
  category: Joi.string().lowercase().valid(...CATEGORIES).optional(),
  assignedTo: Joi.string().pattern(/^[a-fA-F0-9]{24}$/).optional(),
  q: Joi.string().trim().optional().allow(''),
  sortBy: Joi.string().valid('dueDate', 'priority', 'category', 'property', 'createdAt').optional().default('dueDate'),
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
});

export type CreateTaskInput = {
  title: string;
  description?: string;
  propertyId?: string | null;
  assignedTo?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  dueDate: Date;
  subtasks?: Array<{ title: string; isCompleted: boolean; completedAt?: Date | null }>;
  recurrence?: { pattern: 'none' | 'weekly' | 'monthly' | 'quarterly' | 'annually'; endDate?: Date | null };
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

export type GetTasksQuery = {
  status?: TaskStatus | 'today' | 'upcoming';
  priority?: TaskPriority;
  propertyId?: string;
  category?: TaskCategory;
  assignedTo?: string;
  q?: string;
  sortBy?: 'dueDate' | 'priority' | 'category' | 'property' | 'createdAt';
  page: number;
  limit: number;
};
