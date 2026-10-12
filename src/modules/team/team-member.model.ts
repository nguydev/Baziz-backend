import mongoose, { Document, Model } from 'mongoose';
import type { ITeamMember, TeamMemberStatus } from './team.types';

export interface ITeamMemberDocument extends ITeamMember, Document {}

const teamMemberSchema = new mongoose.Schema<ITeamMemberDocument>(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamRole',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'removed'] satisfies TeamMemberStatus[],
      default: 'active',
      index: true,
    },
    propertyScope: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
      default: [],
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    joinedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'team_members',
  }
);

teamMemberSchema.index({ orgId: 1, userId: 1 }, { unique: true });
teamMemberSchema.index({ orgId: 1, status: 1 });

const TeamMember = mongoose.model<ITeamMemberDocument>('TeamMember', teamMemberSchema);

export default TeamMember;
