/**
 * Maintenance Request Types
 * Shared TypeScript interfaces and types for the Maintenance Request module
 */

import mongoose from 'mongoose';
import type { IMaintenanceRequestDocument } from './maintenance-request.model';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type MaintenanceCategory =
  | 'plumbing'
  | 'electrical'
  | 'heating_cooling'
  | 'appliances'
  | 'structural'
  | 'pest_control'
  | 'security'
  | 'cleaning'
  | 'other';

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'emergency';

export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

// ─── Sub-document Interfaces ──────────────────────────────────────────────────

export interface IMaintenanceComment {
  authorId: mongoose.Types.ObjectId;
  authorRole: 'tenant' | 'landlord';
  body: string;
  createdAt: Date;
}

// ─── Main Interface ───────────────────────────────────────────────────────────

export interface IMaintenanceRequest {
  // Core linkage
  leaseId?: mongoose.Types.ObjectId;
  propertyId: mongoose.Types.ObjectId;
  unitId?: mongoose.Types.ObjectId;
  tenantId?: mongoose.Types.ObjectId;
  landlordId: mongoose.Types.ObjectId;

  // Request details
  title: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  description: string;
  photos: string[];
  cost?: number;

  // Workflow
  status: MaintenanceStatus;
  resolvedAt: Date | null;
  closedAt: Date | null;

  // Collaboration
  comments: IMaintenanceComment[];

  // Soft delete / audit
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Service Input Types ──────────────────────────────────────────────────────

export interface CreateMaintenanceRequestInput {
  title: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  description: string;
  propertyId?: string;
  cost?: number;
}

export interface UpdateStatusInput {
  status: MaintenanceStatus;
}

export interface AddCommentInput {
  body: string;
}

export interface ListRequestsQuery {
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  category?: MaintenanceCategory;
  propertyId?: string;
  page: number;
  limit: number;
}

// ─── Service Response Types ───────────────────────────────────────────────────

export interface ListRequestsResult {
  requests: IMaintenanceRequestDocument[];
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
