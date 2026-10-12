import Joi from 'joi';

// Accepts both 'PERSONAL' and 'personal', 'LIMITED_COMPANY' and 'limited_company', etc.
const ownershipTypeSchema = Joi.string()
  .lowercase()
  .valid('personal', 'limited_company', 'partnership', 'trust', 'other')
  .messages({
    'any.only': '"type" must be one of [personal, limited_company, partnership, trust, other] (case-insensitive)',
  });

export const ownershipEntityValidation = {
  create: {
    body: Joi.object().keys({
      name: Joi.string().required(),
      type: ownershipTypeSchema.required(),
      registrationNumber: Joi.string().allow('', null).optional(),
      address: Joi.string().allow('', null).optional(),
      taxReference: Joi.string().allow('', null).optional(),
      contactEmail: Joi.string().email().allow('', null).optional(),
      color: Joi.string().allow('', null).optional(),
      description: Joi.string().allow('', null).optional(),
    }),
  },
  update: {
    body: Joi.object().keys({
      name: Joi.string().optional(),
      type: ownershipTypeSchema.optional(),
      registrationNumber: Joi.string().allow('', null).optional(),
      address: Joi.string().allow('', null).optional(),
      taxReference: Joi.string().allow('', null).optional(),
      contactEmail: Joi.string().email().allow('', null).optional(),
      color: Joi.string().allow('', null).optional(),
      description: Joi.string().allow('', null).optional(),
    }),
  },
};
