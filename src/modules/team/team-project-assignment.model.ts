import mongoose, { Document, Model } from 'mongoose';
import type { IProjectAssignment } from './team.types';

export interface IProjectAssignmentDocument extends IProjectAssignment, Document {}

const projectAssignmentSchema = new mongoose.Schema<IProjectAssignmentDocument>(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamMember',
      required: true,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'team_project_assignments',
  }
);

projectAssignmentSchema.index({ projectId: 1, memberId: 1 }, { unique: true });
projectAssignmentSchema.index({ orgId: 1, projectId: 1 });

const ProjectAssignment = mongoose.model<IProjectAssignmentDocument>(
  'ProjectAssignment',
  projectAssignmentSchema
);

export default ProjectAssignment;
