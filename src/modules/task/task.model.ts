/**
 * Task Model
 * Landlord-only task management with priority, category and property linking
 */

import mongoose, { Document, Model } from 'mongoose';

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in-progress' | 'completed';
export type TaskCategory = 'inspection' | 'compliance' | 'maintenance' | 'financial' | 'administrative' | 'tenant_management' | 'other';

export interface ISubtask {
  title: string;
  isCompleted: boolean;
  completedAt?: Date | null;
}

export interface ITaskRecurrence {
  pattern: 'none' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  endDate?: Date | null;
}

export interface ITask {
  landlordId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  propertyId?: mongoose.Types.ObjectId | null;
  assignedTo?: mongoose.Types.ObjectId | null;
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  dueDate: Date;
  completedAt?: Date | null;
  subtasks: ISubtask[];
  recurrence: ITaskRecurrence;
  recurrenceParentId?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITaskDocument extends ITask, Document {}

export interface ITaskModel extends Model<ITaskDocument> {
  findByLandlord(landlordId: string, filters?: TaskFilterOptions): Promise<ITaskDocument[]>;
}

export interface TaskFilterOptions {
  status?: TaskStatus;
  priority?: TaskPriority;
  propertyId?: string;
  category?: TaskCategory;
  assignedTo?: string;
}

const taskSchema = new mongoose.Schema<ITaskDocument, ITaskModel>(
  {
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Landlord ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: null,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: ['high', 'medium', 'low'],
        message: 'Priority must be high, medium, or low',
      },
      required: [true, 'Priority is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'in-progress', 'completed'],
        message: 'Status must be pending, in-progress, or completed',
      },
      required: [true, 'Status is required'],
      index: true,
    },
    category: {
      type: String,
      enum: {
        values: ['inspection', 'compliance', 'maintenance', 'financial', 'administrative', 'tenant_management', 'other'],
        message: 'Category must be a valid option',
      },
      required: [true, 'Category is required'],
      default: 'other',
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    subtasks: [
      {
        title: {
          type: String,
          required: [true, 'Subtask title is required'],
          trim: true,
        },
        isCompleted: {
          type: Boolean,
          default: false,
        },
        completedAt: {
          type: Date,
          default: null,
        },
      },
    ],
    recurrence: {
      pattern: {
        type: String,
        enum: ['none', 'weekly', 'monthly', 'quarterly', 'annually'],
        default: 'none',
      },
      endDate: {
        type: Date,
        default: null,
      },
    },
    recurrenceParentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const sanitized = ret as Record<string, unknown>;
        delete sanitized.__v;
        return sanitized;
      },
    },
  }
);

taskSchema.index({ landlordId: 1, status: 1, priority: 1 });
taskSchema.index({ landlordId: 1, dueDate: 1 });
taskSchema.index({ landlordId: 1, propertyId: 1 });
taskSchema.index({ landlordId: 1, category: 1 });
taskSchema.index({ landlordId: 1, assignedTo: 1 });
taskSchema.index({ landlordId: 1, isActive: 1, createdAt: -1 });

taskSchema.statics.findByLandlord = async function (
  landlordId: string,
  filters: TaskFilterOptions = {}
) {
  const query: Record<string, unknown> = { landlordId, isActive: true };
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.propertyId) query.propertyId = filters.propertyId;
  if (filters.category) query.category = filters.category;
  if (filters.assignedTo) query.assignedTo = filters.assignedTo;
  return this.find(query)
    .populate('propertyId', 'propertyName streetAddress city')
    .populate('assignedTo', 'name email role')
    .sort({ dueDate: 1 });
};

const Task = mongoose.model<ITaskDocument, ITaskModel>('Task', taskSchema);

export default Task;
