import Joi from 'joi';

export const createProjectSchema = Joi.object({
  property: Joi.string().optional().messages({
    'string.empty': 'Property ID is required',
  }),
  ownershipEntity: Joi.string().optional(),
  name: Joi.string().required().trim().messages({
    'string.empty': 'Project name is required',
  }),
  description: Joi.string().optional().trim(),
  address: Joi.string().optional().trim(),
  type: Joi.string()
    .lowercase()
    .valid('renovation', 'maintenance', 'construction', 'refurbishment', 'other')
    .required()
    .messages({
      'any.only': 'Project type must be one of: renovation, maintenance, construction, refurbishment, other',
    }),
  priority: Joi.string()
    .lowercase()
    .valid('low', 'medium', 'high', 'urgent')
    .default('medium'),
  status: Joi.string()
    .lowercase()
    .valid('planning', 'in-progress', 'on-hold', 'completed', 'cancelled')
    .default('planning'),
  budget: Joi.number().positive().optional(),
  contingency: Joi.number().positive().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
});

export const updateProjectSchema = Joi.object({
  name: Joi.string().optional().trim(),
  description: Joi.string().optional().trim(),
  address: Joi.string().optional().trim(),
  type: Joi.string()
    .lowercase()
    .valid('renovation', 'maintenance', 'construction', 'refurbishment', 'other')
    .optional(),
  priority: Joi.string()
    .lowercase()
    .valid('low', 'medium', 'high', 'urgent')
    .optional(),
  status: Joi.string()
    .lowercase()
    .valid('planning', 'in-progress', 'on-hold', 'completed', 'cancelled')
    .optional(),
  budget: Joi.number().positive().optional(),
  contingency: Joi.number().positive().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  actualStartDate: Joi.date().optional(),
  actualEndDate: Joi.date().optional(),
  spentAmount: Joi.number().min(0).optional(),
  notes: Joi.string().optional(),
});
