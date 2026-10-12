import Joi from 'joi';

export const createRateSetSchema = Joi.object({
  region: Joi.string().valid('england-ni', 'wales', 'scotland').required(),
  regime: Joi.string().valid('residential', 'residential-ftb', 'commercial').required(),
  bands: Joi.array().items(
    Joi.object({
      upTo: Joi.number().required(), // -1 for Infinity
      rate: Joi.number().min(0).max(1).required(),
    })
  ).min(1).required(),
  surchargeRate: Joi.number().min(0).max(1).required(),
  effectiveFrom: Joi.date().iso(),
});
