import { Project } from './project.model';
import type { IProject, CreateProjectInput, UpdateProjectInput } from './project.types';
import ApiError from '../../utils/ApiError';

class ProjectService {
  async createProject(input: CreateProjectInput): Promise<IProject> {
    try {
      const project = new Project({
        ...input,
        property: input.property,
        ownershipEntity: input.ownershipEntity,
      });

      await project.save();
      return project.populate(['property', 'ownershipEntity']);
    } catch (error: any) {
      throw new ApiError(400, `Failed to create project: ${error.message}`);
    }
  }

  async listProjects(
    filters: Record<string, any> = {},
    skip: number = 0,
    limit: number = 10
  ): Promise<{ projects: IProject[]; total: number }> {
    try {
      const projects = await Project.find(filters)
        .populate(['property', 'ownershipEntity'])
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await Project.countDocuments(filters);

      return { projects, total };
    } catch (error: any) {
      throw new ApiError(400, `Failed to list projects: ${error.message}`);
    }
  }

  async getProjectById(projectId: string): Promise<IProject> {
    try {
      const project = await Project.findById(projectId).populate(['property', 'ownershipEntity']);

      if (!project) {
        throw new ApiError(404, 'Project not found');
      }

      return project;
    } catch (error: any) {
      if (error.statusCode === 404) throw error;
      throw new ApiError(400, `Failed to fetch project: ${error.message}`);
    }
  }

  async getProjectsByProperty(propertyId: string, skip: number = 0, limit: number = 10) {
    try {
      const projects = await Project.find({ property: propertyId })
        .populate(['property', 'ownershipEntity'])
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await Project.countDocuments({ property: propertyId });

      return { projects, total };
    } catch (error: any) {
      throw new ApiError(400, `Failed to fetch projects: ${error.message}`);
    }
  }

  async updateProject(projectId: string, input: UpdateProjectInput): Promise<IProject> {
    try {
      const project = await Project.findByIdAndUpdate(projectId, input, {
        new: true,
        runValidators: true,
      }).populate(['property', 'ownershipEntity']);

      if (!project) {
        throw new ApiError(404, 'Project not found');
      }

      return project;
    } catch (error: any) {
      if (error.statusCode === 404) throw error;
      throw new ApiError(400, `Failed to update project: ${error.message}`);
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      const project = await Project.findByIdAndDelete(projectId);

      if (!project) {
        throw new ApiError(404, 'Project not found');
      }
    } catch (error: any) {
      if (error.statusCode === 404) throw error;
      throw new ApiError(400, `Failed to delete project: ${error.message}`);
    }
  }

  async getProjectsByStatus(status: string, skip: number = 0, limit: number = 10) {
    try {
      const projects = await Project.find({ status })
        .populate(['property', 'ownershipEntity'])
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await Project.countDocuments({ status });

      return { projects, total };
    } catch (error: any) {
      throw new ApiError(400, `Failed to fetch projects by status: ${error.message}`);
    }
  }

  async getProjectStats(filters: Record<string, any> = {}) {
    try {
      const stats = await Project.aggregate([
        {
          $match: filters,
        },
        {
          $group: {
            _id: null,
            totalBudget: { $sum: '$budget' },
            totalContingency: { $sum: '$contingency' },
            totalSpent: { $sum: '$spentAmount' },
            byStatus: {
              $push: {
                status: '$status',
                count: { $cond: [true, 1, 0] },
              },
            },
            byPriority: {
              $push: {
                priority: '$priority',
                count: { $cond: [true, 1, 0] },
              },
            },
          },
        },
      ]);

      return stats[0] || null;
    } catch (error: any) {
      throw new ApiError(400, `Failed to get project stats: ${error.message}`);
    }
  }
}

export default new ProjectService();
