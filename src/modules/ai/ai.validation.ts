import Joi from 'joi';

export const chatSchema = Joi.object({
  messages: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant').required(),
        content: Joi.string().max(4000).required(),
      })
    )
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.min': 'At least one message is required.',
      'array.max': 'Conversation history cannot exceed 50 messages.',
    }),
  isNews: Joi.boolean().default(false),
});

export const transcribeSchema = Joi.object({
  base64Audio: Joi.string().required().messages({
    'string.empty': 'Audio data is required.',
  }),
  mediaType: Joi.string().default('audio/m4a'),
});
