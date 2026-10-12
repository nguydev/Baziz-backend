/**
 * Property Document Validation
 */

import Joi from 'joi';
import type { UploadDocumentInput, ListDocumentsQuery } from './property-document.types';

export const uploadDocumentSchema = Joi.object<UploadDocumentInput>({
  title: Joi.string().trim().min(1).max(200).optional().messages({
    'string.max': 'Title cannot exceed 200 characters',
  }),
  documentType: Joi.string().trim().optional().default('Other'),
  propertyId: Joi.string().optional(),
}).options({ stripUnknown: true });

export const listDocumentsSchema = Joi.object<ListDocumentsQuery>({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).options({ stripUnknown: true });
