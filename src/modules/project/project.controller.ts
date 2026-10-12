import { Request, Response, NextFunction } from 'express';
import ProjectService from './project.service';
import asyncHandler from '../../utils/asyncHandler';
import ApiResponse from '../../utils/ApiResponse';
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from './project.types';

export const createProject = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const input = req.body as CreateProjectInput;

    const project = await ProjectService.createProject(input);

    res.status(201).json(
      new ApiResponse(201, 'Project created successfully', project)
    );
  }
);

export const listProjects = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const {
      skip = 0,
      limit = 10,
      status,
      priority,
      type,
    } = req.query;

    const filters: Record<string, unknown> = {};

    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (type) filters.type = type;

    const { projects, total } =
      await ProjectService.listProjects(
        filters,
        Number(skip),
        Number(limit)
      );

    res.json(
      new ApiResponse(200, 'Projects fetched successfully', {
        projects,
        total,
        skip: Number(skip),
        limit: Number(limit),
      })
    );
  }
);

export const getProject = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { projectId } = req.params;

    const project =
      await ProjectService.getProjectById(projectId);

    res.json(
      new ApiResponse(200, 'Project fetched successfully', project)
    );
  }
);

export const updateProject = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { projectId } = req.params;

    const input = req.body as UpdateProjectInput;

    const project =
      await ProjectService.updateProject(
        projectId,
        input
      );

    res.json(
      new ApiResponse(200, 'Project updated successfully', project)
    );
  }
);

export const deleteProject = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { projectId } = req.params;

    await ProjectService.deleteProject(projectId);

    res.json(
      new ApiResponse(200, 'Project deleted successfully')
    );
  }
);

export const getProjectsByStatus = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const { status } = req.params;
    const { skip = 0, limit = 10 } = req.query;

    const { projects, total } =
      await ProjectService.getProjectsByStatus(
        status,
        Number(skip),
        Number(limit)
      );

    res.json(
      new ApiResponse(200, 'Projects fetched successfully', {
        projects,
        total,
        skip: Number(skip),
        limit: Number(limit),
      })
    );
  }
);

export const getProjectStats = asyncHandler(
  async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const stats =
      await ProjectService.getProjectStats({});

    res.json(
      new ApiResponse(200, 'Project statistics fetched successfully', stats)
    );
  }
);
