/**
 * Property Document Service
 */

import mongoose from 'mongoose';
import { Request } from 'express';
import PropertyDocument from './property-document.model';
import type { IPropertyDocumentRecord } from './property-document.model';
import { getPropertyById } from '../property/property.service';
import tenantModels from '../tenant/tenant.model';
import ApiError from '../../utils/ApiError';
import logger from '../../config/logger';
import { getFileUrl } from '../../middlewares/upload.middleware';
import { buildPaginationMeta } from '../../utils/pagination';
import type {
  UploadDocumentInput,
  ListDocumentsQuery,
  ListDocumentsResult,
  AuthUser,
} from './property-document.types';

const { LeaseAgreement } = tenantModels;

const deriveTitle = (originalName: string, customTitle?: string): string => {
  if (customTitle?.trim()) return customTitle.trim();
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  return baseName || originalName;
};

const verifyPropertyAccess = async (
  propertyId: string,
  user: AuthUser
): Promise<void> => {
  if (user.role === 'landlord') {
    await getPropertyById(propertyId, user._id.toString());
    return;
  }

  const lease = await LeaseAgreement.findOne({
    propertyId,
    tenantId: user._id,
    status: { $in: ['accepted', 'active'] },
  });

  if (!lease) {
    throw ApiError.forbidden('You do not have access to documents for this property');
  }
};

// ─── Upload Document (Landlord) ───────────────────────────────────────────────

export const uploadDocument = async (
  propertyId: string | undefined,
  user: AuthUser,
  file: Express.Multer.File,
  input: UploadDocumentInput,
  req: Request
): Promise<IPropertyDocumentRecord> => {
  let property = null;
  if (propertyId) {
    property = await getPropertyById(propertyId, user._id.toString());
  }

  const document = new PropertyDocument({
    propertyId: property ? property._id : undefined,
    landlordId: user._id,
    documentType: input.documentType || 'Other',
    title: deriveTitle(file.originalname, input.title),
    fileName: file.originalname,
    fileUrl: getFileUrl(req, file),
    mimeType: file.mimetype,
    fileSize: file.size,
    uploadedBy: user._id,
    isActive: true,
  });

  await document.save();

  logger.info(
    `Document uploaded: "${document.title}" by landlord ${user._id}`
  );

  return document;
};

// ─── List Documents (Landlord + Tenant) ───────────────────────────────────────

export const listDocuments = async (
  propertyId: string,
  user: AuthUser,
  query: ListDocumentsQuery
): Promise<ListDocumentsResult> => {
  await verifyPropertyAccess(propertyId, user);

  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const filter = {
    propertyId,
    isActive: true,
  };

  const [documents, total] = await Promise.all([
    PropertyDocument.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    PropertyDocument.countDocuments(filter),
  ]);

  const meta = buildPaginationMeta(total, page, limit);

  return {
    documents,
    total,
    page: meta.page,
    limit: meta.limit,
    totalPages: meta.totalPages,
    hasNextPage: meta.hasNextPage,
    hasPrevPage: meta.hasPrevPage,
  };
};

// ─── List All Documents (Landlord) ──────────────────────────────────────────────

export const listAllLandlordDocuments = async (
  user: AuthUser,
  query: ListDocumentsQuery
): Promise<ListDocumentsResult> => {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const filter = {
    landlordId: user._id,
    isActive: true,
  };

  const [documents, total] = await Promise.all([
    PropertyDocument.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('propertyId', 'propertyName'), // Populate property info
    PropertyDocument.countDocuments(filter),
  ]);

  const meta = buildPaginationMeta(total, page, limit);

  return {
    documents,
    total,
    page: meta.page,
    limit: meta.limit,
    totalPages: meta.totalPages,
    hasNextPage: meta.hasNextPage,
    hasPrevPage: meta.hasPrevPage,
  };
};

// ─── Get Single Document (Landlord + Tenant) ───────────────────────────────────

export const getDocumentById = async (
  propertyId: string,
  documentId: string,
  user: AuthUser
): Promise<IPropertyDocumentRecord> => {
  await verifyPropertyAccess(propertyId, user);

  if (!mongoose.isValidObjectId(documentId)) {
    throw ApiError.badRequest('Invalid document ID');
  }

  const document = await PropertyDocument.findOne({
    _id: documentId,
    propertyId,
    isActive: true,
  });

  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  return document;
};

// ─── Delete Document (Landlord) ───────────────────────────────────────────────

export const deleteDocument = async (
  propertyId: string | undefined,
  documentId: string,
  user: AuthUser
): Promise<void> => {
  if (propertyId) {
    await getPropertyById(propertyId, user._id.toString());
  }

  if (!mongoose.isValidObjectId(documentId)) {
    throw ApiError.badRequest('Invalid document ID');
  }

  const query: any = {
    _id: documentId,
    landlordId: user._id,
    isActive: true,
  };
  
  if (propertyId) {
    query.propertyId = propertyId;
  }

  const document = await PropertyDocument.findOne(query);

  if (!document) {
    throw ApiError.notFound('Document not found');
  }

  document.isActive = false;
  await document.save();

  logger.info(`Document soft-deleted: ${documentId} for property ${propertyId}`);
};

// ─── Tenant: List Documents for Active Lease Property ─────────────────────────

export const listMyPropertyDocuments = async (
  tenantId: string,
  query: ListDocumentsQuery
): Promise<ListDocumentsResult & { propertyId: string; propertyName: string }> => {
  const lease = await LeaseAgreement.findOne({
    tenantId,
    status: { $in: ['accepted', 'active'] },
  }).populate('propertyId', 'propertyName');

  if (!lease) {
    return {
      documents: [],
      total: 0,
      page: 1,
      limit: query.limit || 10,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
      propertyId: '',
      propertyName: ''
    } as any;
  }

  const property = lease.propertyId as unknown as {
    _id: mongoose.Types.ObjectId;
    propertyName: string;
  };

  const propertyId = property._id.toString();
  const result = await listDocuments(propertyId, {
    _id: new mongoose.Types.ObjectId(tenantId),
    role: 'tenant',
  }, query);

  return {
    ...result,
    propertyId,
    propertyName: property.propertyName,
  };
};
