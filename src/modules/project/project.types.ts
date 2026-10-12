import { Document, Types } from 'mongoose';

export interface IProject extends Document {
  _id: Types.ObjectId;
  property: Types.ObjectId;
  ownershipEntity: Types.ObjectId;
  name: string;
  description?: string;
  address?: string;
  type: 'renovation' | 'maintenance' | 'construction' | 'refurbishment' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'planning' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled';
  budget?: number;
  contingency?: number;
  startDate?: Date;
  endDate?: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  spentAmount?: number;
  notes?: string;
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  property: string;
  ownershipEntity?: string;
  name: string;
  description?: string;
  address?: string;
  type: string;
  priority: string;
  status: string;
  budget?: number;
  contingency?: number;
  startDate?: string;
  endDate?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  address?: string;
  type?: string;
  priority?: string;
  status?: string;
  budget?: number;
  contingency?: number;
  startDate?: string;
  endDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  spentAmount?: number;
  notes?: string;
}
