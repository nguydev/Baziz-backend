/**
 * Complaint Service
 * Business logic for tenant complaints (submit, list, getById, updateStatus, softDelete)
 */

import mongoose from 'mongoose';
import Complaint from './complaint.model';
import type { IComplaintDocument } from './complaint.model';
import tenantModels from '../tenant/tenant.model';
import ApiError from '../../utils/ApiError';
import logger from '../../config/logger';
import { buildPaginationMeta } from '../../utils/pagination';
import type {
  CreateComplaintInput,
  UpdateComplaintStatusInput,
  ListComplaintsQuery,
  ListComplaintsResult,
  ComplaintStatus,
  AuthUser,
} from './complaint.types';

const { LeaseAgreement } = tenantModels;

const POPULATE_FIELDS = [
  { path: 'propertyId', select: 'propertyName streetAddress city' },
  { path: 'tenantId', select: 'firstName lastName email' },
];

// ─── Status Machine ───────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  in_review: ['in_progress', 'resolved', 'closed'],
  in_progress: ['in_review', 'resolved', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

// ─── Submit Complaint (Tenant) ────────────────────────────────────────────────

export const submitComplaint = async (
  input: CreateComplaintInput,
  user: AuthUser
): Promise<IComplaintDocument> => {
  const tenantId = user._id.toString();

  const lease = await LeaseAgreement.findOne({
    tenantId,
    status: { $in: ['accepted', 'active'] },
  });

  if (!lease) {
    throw ApiError.forbidden(
      'No active lease found. You must have an active lease to submit a complaint.'
    );
  }

  const complaint = new Complaint({
    leaseId: lease._id,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    tenantId: lease.tenantId,
    landlordId: lease.landlordId,
    category: input.category,
    title: input.title,
    description: input.description,
    urgency: input.urgency,
    status: 'in_review',
    isActive: true,
  });

  await complaint.save();
  await complaint.populate(POPULATE_FIELDS);

  logger.info(
    `Complaint submitted: "${input.title}" by tenant ${tenantId} for property ${lease.propertyId}`
  );

  return complaint;
};

// ─── List Complaints ──────────────────────────────────────────────────────────

export const listComplaints = async (
  query: ListComplaintsQuery,
  user: AuthUser
): Promise<ListComplaintsResult> => {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { isActive: true };

  if (user.role === 'tenant') {
    filter.tenantId = user._id;
  } else {
    filter.landlordId = user._id;
    if (query.propertyId) {
      if (!mongoose.isValidObjectId(query.propertyId)) {
        throw ApiError.badRequest('Invalid property ID');
      }
      filter.propertyId = new mongoose.Types.ObjectId(query.propertyId);
    }
  }

  if (query.status) filter.status = query.status;
  if (query.urgency) filter.urgency = query.urgency;
  if (query.category) filter.category = query.category;

  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Complaint.countDocuments(filter),
  ]);

  const meta = buildPaginationMeta(total, page, limit);

  return {
    complaints,
    total,
    page: meta.page,
    limit: meta.limit,
    totalPages: meta.totalPages,
    hasNextPage: meta.hasNextPage,
    hasPrevPage: meta.hasPrevPage,
  };
};

// ─── Get Single Complaint ─────────────────────────────────────────────────────

export const getComplaintById = async (
  complaintId: string,
  user: AuthUser
): Promise<IComplaintDocument> => {
  if (!mongoose.isValidObjectId(complaintId)) {
    throw ApiError.badRequest('Invalid complaint ID');
  }

  const complaint = await Complaint.findOne({
    _id: complaintId,
    isActive: true,
  }).populate(POPULATE_FIELDS);

  if (!complaint) {
    throw ApiError.notFound('Complaint not found');
  }

  const userId = user._id.toString();
  if (
    complaint.tenantId.toString() !== userId &&
    complaint.landlordId.toString() !== userId
  ) {
    throw ApiError.forbidden('Access denied');
  }

  return complaint;
};

// ─── Update Status (Landlord) ─────────────────────────────────────────────────

export const updateStatus = async (
  complaintId: string,
  input: UpdateComplaintStatusInput,
  user: AuthUser
): Promise<IComplaintDocument> => {
  if (!mongoose.isValidObjectId(complaintId)) {
    throw ApiError.badRequest('Invalid complaint ID');
  }

  const complaint = await Complaint.findOne({
    _id: complaintId,
    isActive: true,
  });

  if (!complaint) {
    throw ApiError.notFound('Complaint not found');
  }

  if (complaint.landlordId.toString() !== user._id.toString()) {
    throw ApiError.forbidden('Access denied');
  }

  const allowedNext = ALLOWED_TRANSITIONS[complaint.status];
  if (!allowedNext.includes(input.status)) {
    throw ApiError.badRequest(
      `Invalid status transition: cannot move from '${complaint.status}' to '${input.status}'. ` +
        `Allowed transitions: ${allowedNext.length ? allowedNext.join(', ') : 'none (terminal state)'}`
    );
  }

  complaint.status = input.status;

  if (input.status === 'resolved') {
    complaint.resolvedAt = new Date();
  }
  if (input.status === 'closed') {
    complaint.closedAt = new Date();
  }

  await complaint.save();
  await complaint.populate(POPULATE_FIELDS);

  logger.info(
    `Complaint ${complaintId} status updated to '${input.status}' by landlord ${user._id}`
  );

  return complaint;
};

// ─── Soft Delete (Tenant) ─────────────────────────────────────────────────────

export const softDeleteComplaint = async (
  complaintId: string,
  user: AuthUser
): Promise<void> => {
  if (!mongoose.isValidObjectId(complaintId)) {
    throw ApiError.badRequest('Invalid complaint ID');
  }

  const complaint = await Complaint.findOne({
    _id: complaintId,
    isActive: true,
  });

  if (!complaint) {
    throw ApiError.notFound('Complaint not found');
  }

  if (complaint.tenantId.toString() !== user._id.toString()) {
    throw ApiError.forbidden('Access denied');
  }

  if (complaint.status !== 'in_review') {
    throw ApiError.badRequest(
      `Only complaints in review can be deleted. Current status: '${complaint.status}'`
    );
  }

  complaint.isActive = false;
  await complaint.save();

  logger.info(`Complaint ${complaintId} soft-deleted by tenant ${user._id}`);
};
