/**
 * Complaint Types
 * Shared TypeScript interfaces for the Tenant Complaints module
 */

import mongoose from 'mongoose';
import type { IComplaintDocument } from './complaint.model';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ComplaintCategory =
  | 'property_condition'
  | 'noise'
  | 'neighbour_dispute'
  | 'billing'
  | 'communication'
  | 'other';

export type ComplaintUrgency = 'low' | 'medium' | 'high';

export type ComplaintStatus = 'in_review' | 'in_progress' | 'resolved' | 'closed';

// ─── Main Interface ─────────────────────────────────────────────────────────────

export interface IComplaint {
  leaseId: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  landlordId: mongoose.Types.ObjectId;

  category: ComplaintCategory;
  title: string;
  description: string;
  urgency: ComplaintUrgency;

  status: ComplaintStatus;
  resolvedAt: Date | null;
  closedAt: Date | null;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Service Input Types ────────────────────────────────────────────────────────

export interface CreateComplaintInput {
  category: ComplaintCategory;
  title: string;
  description: string;
  urgency: ComplaintUrgency;
}

export interface UpdateComplaintStatusInput {
  status: ComplaintStatus;
}

export interface ListComplaintsQuery {
  status?: ComplaintStatus;
  urgency?: ComplaintUrgency;
  category?: ComplaintCategory;
  propertyId?: string;
  page: number;
  limit: number;
}

// ─── Service Response Types ─────────────────────────────────────────────────────

export interface ListComplaintsResult {
  complaints: IComplaintDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AuthUser {
  _id: mongoose.Types.ObjectId;
  role: 'tenant' | 'landlord';
}
