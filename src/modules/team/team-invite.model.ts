import mongoose, { Document, Model } from 'mongoose';
import type { ITeamInvite, TeamInviteStatus } from './team.types';

export interface ITeamInviteDocument extends ITeamInvite, Document {}

const teamInviteSchema = new mongoose.Schema<ITeamInviteDocument>(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeamRole',
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'cancelled', 'expired'] satisfies TeamInviteStatus[],
      default: 'pending',
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    propertyScope: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Property' }],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'team_invites',
  }
);

teamInviteSchema.index({ orgId: 1, email: 1, status: 1 });

const TeamInvite = mongoose.model<ITeamInviteDocument>('TeamInvite', teamInviteSchema);

export default TeamInvite;
