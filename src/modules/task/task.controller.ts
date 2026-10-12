 

import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import Joi from 'joi';
import * as taskService from './task.service';
import * as taskValidation from './task.validation';
import type { ITaskDocument } from './task.model';
import tenantModels from '../tenant/tenant.model';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';

const { LeaseAgreement } = tenantModels;

interface PopulatedProperty {
  _id: Types.ObjectId;
  propertyName: string;
  streetAddress?: string;
  city?: string;
}

interface PopulatedAssignee {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: string;
}

type PopulatedTask = Omit<ITaskDocument, 'propertyId' | 'assignedTo'> & {
  propertyId: PopulatedProperty | Types.ObjectId | null;
  assignedTo: PopulatedAssignee | Types.ObjectId | null;
};

const validateBody = <T>(schema: Joi.Schema, body: unknown): T => {
  const { error, value } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((d) => d.message);
    throw ApiError.badRequest('Validation failed', errors);
  }

  return value as T;
};

const getLandlordId = (req: Request): string => {
  const id = req.user?._id?.toString();
  if (!id) throw ApiError.unauthorized('User not authenticated');
  return id;
};

/**
 * Reads X-Timezone-Offset header (minutes).
 * Valid range: -840 to +720. Falls back to 0 (UTC) if missing or out of range.
 */
const getTzOffset = (req: Request): number => {
  const raw = req.headers['x-timezone-offset'];
  if (!raw) return 0;
  const parsed = parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
  if (isNaN(parsed) || parsed < -840 || parsed > 720) return 0;
  return parsed;
};

const formatTask = (task: PopulatedTask) => {
  const prop = task.propertyId;
  const assignee = task.assignedTo;

  const isPropertyPopulated = (v: PopulatedProperty | Types.ObjectId | null): v is PopulatedProperty =>
    v !== null && typeof v === 'object' && 'propertyName' in v;

  const isAssigneePopulated = (v: PopulatedAssignee | Types.ObjectId | null): v is PopulatedAssignee =>
    v !== null && typeof v === 'object' && 'name' in v;

  return {
    id: task._id,
    title: task.title,
    description: task.description ?? null,
    property: isPropertyPopulated(prop)
      ? {
          id: prop._id,
          propertyName: prop.propertyName,
          address:
            prop.streetAddress && prop.city
              ? `${prop.streetAddress}, ${prop.city}`
              : prop.streetAddress ?? null,
        }
      : null,
    assignee: isAssigneePopulated(assignee)
      ? {
          id: assignee._id,
          name: assignee.name,
          email: assignee.email,
          role: assignee.role,
        }
      : null,
    priority: task.priority,
    status: task.status,
    category: task.category,
    dueDate: task.dueDate,
    completedAt: task.completedAt ?? null,
    subtasks: task.subtasks || [],
    recurrence: task.recurrence || { pattern: 'none', endDate: null },
    recurrenceParentId: task.recurrenceParentId ?? null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
};

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  const tzOffset = getTzOffset(req);

  const input = validateBody<taskValidation.CreateTaskInput>(
    taskValidation.createTaskSchema,
    req.body
  );

  const task = await taskService.createTask(input, landlordId, tzOffset);

  res.status(201).json(
    ApiResponse.created('Task created successfully', { task: formatTask(task as PopulatedTask) })
  );
});

export const getTasks = asyncHandler(async (req: Request, res: Response) => {
  let landlordId = req.user?._id?.toString() || '';
  const isTenant = req.user?.role === 'tenant';

  const query = validateBody<taskValidation.GetTasksQuery>(
    taskValidation.getTasksSchema,
    req.query
  );

  if (isTenant) {
    // Enterprise solution: Find tenant's landlord and property to fetch related tasks/inspections
    const lease = await LeaseAgreement.findOne({
      tenantId: req.user?._id,
      status: { $in: ['accepted', 'active'] },
    });

    if (!lease) {
      // If no active lease is found, return empty tasks list
      res.status(200).json(
        ApiResponse.ok('No active lease found. Tasks empty.', [], {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
          summary: {},
        })
      );
      return;
    }

    landlordId = lease.landlordId.toString();
    // Enforce tenant property scoping
    query.propertyId = lease.propertyId.toString();
  }

  const { tasks, meta, summary } = await taskService.getTasks(landlordId, query);

  res.status(200).json(
    ApiResponse.ok(
      'Tasks retrieved successfully',
      tasks.map((t) => formatTask(t as PopulatedTask)),
      { ...meta, summary }
    )
  );
});

export const getTaskStats = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  const stats = await taskService.getTaskStats(landlordId);

  res.status(200).json(ApiResponse.ok('Task stats retrieved', { stats }));
});

export const getTaskById = asyncHandler(async (req: Request, res: Response) => {
  let landlordId = req.user?._id?.toString() || '';
  const isTenant = req.user?.role === 'tenant';

  if (isTenant) {
    const lease = await LeaseAgreement.findOne({
      tenantId: req.user?._id,
      status: { $in: ['accepted', 'active'] },
    });
    if (!lease) {
      throw ApiError.forbidden('No active lease found. Access denied.');
    }
    landlordId = lease.landlordId.toString();
  }

  const task = await taskService.getTaskById(req.params.id, landlordId);

  // Tenant security constraint check
  if (isTenant && task.propertyId?.toString() !== task.propertyId?.toString()) {
    throw ApiError.forbidden('Access denied to this task.');
  }

  res.status(200).json(
    ApiResponse.ok('Task retrieved successfully', { task: formatTask(task as PopulatedTask) })
  );
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  const tzOffset = getTzOffset(req);

  const input = validateBody<taskValidation.UpdateTaskInput>(
    taskValidation.updateTaskSchema,
    req.body
  );

  const task = await taskService.updateTask(req.params.id, landlordId, input, tzOffset);

  res.status(200).json(
    ApiResponse.ok('Task updated successfully', { task: formatTask(task as PopulatedTask) })
  );
});

export const completeTask = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  const task = await taskService.completeTask(req.params.id, landlordId);

  res.status(200).json(
    ApiResponse.ok('Task marked as completed', { task: formatTask(task as PopulatedTask) })
  );
});

export const searchTasks = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);

  const query = validateBody<taskValidation.SearchTasksQuery>(
    taskValidation.searchTasksSchema,
    req.query
  );

  const { tasks, meta } = await taskService.searchTasks(landlordId, query);

  res.status(200).json(
    ApiResponse.ok(
      'Search results retrieved',
      tasks.map((t) => formatTask(t as PopulatedTask)),
      meta
    )
  );
});

export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  await taskService.deleteTask(req.params.id, landlordId);

  res.status(200).json(ApiResponse.ok('Task deleted successfully'));
});

export const getAITaskSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = getLandlordId(req);
  const suggestions = await taskService.getAITaskSuggestions(landlordId);
  res.status(200).json(ApiResponse.ok('AI task suggestions retrieved successfully', { suggestions }));
});
