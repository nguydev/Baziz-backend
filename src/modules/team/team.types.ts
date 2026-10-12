import type { Types } from 'mongoose';
import type { PermissionKey, SystemRoleKey } from './team.constants';

export type TeamMemberStatus = 'pending' | 'active' | 'removed';
export type TeamInviteStatus = 'pending' | 'accepted' | 'cancelled' | 'expired';

export interface TeamContext {
  orgId: string;
  teamRoleId: string;
  teamRoleName: string;
  permissions: PermissionKey[];
  propertyScope: string[];
}

export interface IOrganization {
  ownerId: Types.ObjectId;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeamRole {
  orgId: Types.ObjectId;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  enabledKeys: PermissionKey[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeamMember {
  orgId: Types.ObjectId;
  userId: Types.ObjectId;
  roleId: Types.ObjectId;
  status: TeamMemberStatus;
  propertyScope: Types.ObjectId[];
  invitedBy?: Types.ObjectId | null;
  joinedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeamInvite {
  orgId: Types.ObjectId;
  email: string;
  roleId: Types.ObjectId;
  token: string;
  status: TeamInviteStatus;
  expiresAt: Date;
  invitedBy: Types.ObjectId;
  propertyScope: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IProjectAssignment {
  orgId: Types.ObjectId;
  projectId: Types.ObjectId;
  memberId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface InviteMemberInput {
  email: string;
  roleId: string;
  propertyScope?: string[];
}

export interface AcceptInviteInput {
  token: string;
  firstName?: string;
  password?: string;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  enabledKeys: PermissionKey[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  enabledKeys?: PermissionKey[];
}

export interface UpdateMemberRoleInput {
  roleId: string;
  propertyScope?: string[];
}

export interface AssignProjectMemberInput {
  memberId: string;
}
