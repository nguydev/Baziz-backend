import Joi from 'joi';

export const saveCalculationSchema = Joi.object({
  calculatorType: Joi.string().valid('roi', 'stamp-duty', 'property-flip', 'development').required(),
  name: Joi.string().max(100).required(),
  inputs: Joi.object().required(),
  results: Joi.object().required(),
  notes: Joi.string().max(1000).allow(null, ''),
});

export const updateCalculationSchema = Joi.object({
  name: Joi.string().max(100),
  inputs: Joi.object(),
  results: Joi.object(),
  notes: Joi.string().max(1000).allow(null, ''),
}).min(1);
