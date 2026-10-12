import mongoose, { Document, Model } from 'mongoose';
import type { ITeamRole } from './team.types';
import type { PermissionKey } from './team.constants';

export interface ITeamRoleDocument extends ITeamRole, Document {}

const teamRoleSchema = new mongoose.Schema<ITeamRoleDocument>(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    key: { type: String, required: true, trim: true, maxlength: 50 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    isSystem: { type: Boolean, default: false, index: true },
    enabledKeys: {
      type: [String],
      default: [],
      validate: {
        validator(keys: string[]) {
          return keys.every((k) => typeof k === 'string' && k.length > 0);
        },
        message: 'Invalid permission keys',
      },
    },
  },
  {
    timestamps: true,
    collection: 'team_roles',
  }
);

teamRoleSchema.index({ orgId: 1, key: 1 }, { unique: true });

const TeamRole = mongoose.model<ITeamRoleDocument>('TeamRole', teamRoleSchema);

export type { PermissionKey };

export default TeamRole;
