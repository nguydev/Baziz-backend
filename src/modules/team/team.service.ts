import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../user/user.model';
import Property from '../property/property.model';
import Organization from './organization.model';
import TeamRole from './team-role.model';
import TeamMember from './team-member.model';
import TeamInvite from './team-invite.model';
import ProjectAssignment from './team-project-assignment.model';
import ApiError from '../../utils/ApiError';
import logger from '../../config/logger';
import { queueEmail } from '../../jobs/email.job';
import { assertCanAddTeamMember } from '../billing/billing.service';
import { sendTeamInviteEmail } from '../../utils/sendEmail';
import {
  ALL_PERMISSIONS,
  INVITE_TOKEN_EXPIRY_DAYS,
  OWNER_ROLE_KEY,
  PERMISSION_META,
  SYSTEM_ROLE_KEYS,
} from './team.constants';
import type { PermissionKey } from './team.constants';
import type {
  AcceptInviteInput,
  AssignProjectMemberInput,
  CreateRoleInput,
  InviteMemberInput,
  TeamContext,
  UpdateMemberRoleInput,
  UpdateRoleInput,
} from './team.types';

const formatRole = (doc: {
  _id: mongoose.Types.ObjectId;
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  enabledKeys: string[];
}) => ({
  id: doc._id.toString(),
  key: doc.key,
  name: doc.name,
  description: doc.description,
  isSystem: doc.isSystem,
  enabledKeys: doc.enabledKeys,
});

const formatMember = async (member: {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  roleId: mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId; key: string; name: string };
  status: string;
  propertyScope: mongoose.Types.ObjectId[];
  joinedAt?: Date | null;
  createdAt: Date;
}) => {
  const user = await User.findById(member.userId).select('firstName email');
  const role =
    typeof member.roleId === 'object' && member.roleId !== null && 'key' in member.roleId
      ? member.roleId
      : await TeamRole.findById(member.roleId);

  return {
    id: member._id.toString(),
    userId: member.userId.toString(),
    name: user?.firstName ?? 'Unknown',
    email: user?.email ?? '',
    status: member.status,
    roleId: role?._id?.toString() ?? member.roleId.toString(),
    roleKey: role && 'key' in role ? role.key : null,
    roleName: role && 'name' in role ? role.name : null,
    propertyScope: member.propertyScope.map((id) => id.toString()),
    joinedAt: member.joinedAt,
    createdAt: member.createdAt,
  };
};

const getMembershipForUser = async (userId: string) => {
  const member = await TeamMember.findOne({ userId, status: 'active' });
  if (!member) {
    throw ApiError.forbidden('No active team membership found');
  }
  return member;
};

const getOrgForUser = async (userId: string) => {
  const member = await getMembershipForUser(userId);
  const org = await Organization.findById(member.orgId);
  if (!org || !org.isActive) {
    throw ApiError.notFound('Organization not found');
  }
  return { org, member };
};

const assertNotOwnerRole = async (roleId: string, orgId: mongoose.Types.ObjectId) => {
  const role = await TeamRole.findOne({ _id: roleId, orgId });
  if (!role) throw ApiError.notFound('Role not found');
  if (role.key === OWNER_ROLE_KEY) {
    throw ApiError.badRequest('Cannot assign or invite with Owner role');
  }
  return role;
};

const validatePermissionKeys = (keys: string[]): PermissionKey[] => {
  const invalid = keys.filter((k) => !(ALL_PERMISSIONS as readonly string[]).includes(k));
  if (invalid.length) {
    throw ApiError.badRequest(`Invalid permission keys: ${invalid.join(', ')}`);
  }
  return keys as PermissionKey[];
};

export const listPermissions = () =>
  ALL_PERMISSIONS.map((key) => ({
    key,
    ...PERMISSION_META[key],
  }));

export const listRoles = async (userId: string) => {
  const { org } = await getOrgForUser(userId);
  const roles = await TeamRole.find({ orgId: org._id }).sort({ isSystem: -1, name: 1 });
  return roles.map(formatRole);
};

export const createRole = async (userId: string, input: CreateRoleInput) => {
  const { org } = await getOrgForUser(userId);
  const enabledKeys = validatePermissionKeys(input.enabledKeys);

  const key = input.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  if ((SYSTEM_ROLE_KEYS as readonly string[]).includes(key)) {
    throw ApiError.conflict('Role key conflicts with a system role');
  }

  const existing = await TeamRole.findOne({ orgId: org._id, key });
  if (existing) {
    throw ApiError.conflict('A role with this name already exists');
  }

  const role = await TeamRole.create({
    orgId: org._id,
    key,
    name: input.name.trim(),
    description: input.description?.trim() ?? '',
    isSystem: false,
    enabledKeys,
  });

  return formatRole(role);
};

export const updateRole = async (userId: string, roleId: string, input: UpdateRoleInput) => {
  const { org } = await getOrgForUser(userId);
  const role = await TeamRole.findOne({ _id: roleId, orgId: org._id });
  if (!role) throw ApiError.notFound('Role not found');

  if (input.name !== undefined) role.name = input.name.trim();
  if (input.description !== undefined) role.description = input.description.trim();
  if (input.enabledKeys !== undefined) {
    role.enabledKeys = validatePermissionKeys(input.enabledKeys);
  }

  if (role.key === OWNER_ROLE_KEY && input.enabledKeys) {
    throw ApiError.badRequest('Owner role permissions cannot be modified');
  }

  await role.save();
  return formatRole(role);
};

export const deleteRole = async (userId: string, roleId: string) => {
  const { org } = await getOrgForUser(userId);
  const role = await TeamRole.findOne({ _id: roleId, orgId: org._id });
  if (!role) throw ApiError.notFound('Role not found');

  if (role.isSystem) {
    throw ApiError.badRequest('System roles cannot be deleted');
  }

  const inUse = await TeamMember.countDocuments({ orgId: org._id, roleId: role._id, status: 'active' });
  if (inUse > 0) {
    throw ApiError.conflict('Role is assigned to active members');
  }

  await role.deleteOne();
  return { id: roleId, deleted: true };
};

export const listMembers = async (userId: string) => {
  const { org } = await getOrgForUser(userId);

  const [members, pendingInvites] = await Promise.all([
    TeamMember.find({ orgId: org._id, status: { $ne: 'removed' } })
      .populate('roleId')
      .sort({ createdAt: 1 }),
    TeamInvite.find({ orgId: org._id, status: 'pending', expiresAt: { $gt: new Date() } })
      .populate('roleId')
      .sort({ createdAt: -1 }),
  ]);

  const memberList = await Promise.all(members.map((m) => formatMember(m)));

  const inviteList = await Promise.all(
    pendingInvites.map(async (inv) => {
      const role =
        typeof inv.roleId === 'object' && inv.roleId !== null && 'name' in inv.roleId
          ? inv.roleId
          : await TeamRole.findById(inv.roleId);
      return {
        id: inv._id.toString(),
        email: inv.email,
        status: 'pending' as const,
        roleId: role?._id?.toString(),
        roleKey: role && 'key' in role ? role.key : null,
        roleName: role && 'name' in role ? role.name : null,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      };
    })
  );

  return { members: memberList, pendingInvites: inviteList };
};

export const inviteMember = async (userId: string, input: InviteMemberInput) => {
  const { org, member: inviter } = await getOrgForUser(userId);
  await assertCanAddTeamMember(userId);
  const role = await assertNotOwnerRole(input.roleId, org._id);

  const email = input.email.toLowerCase().trim();

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const existingMember = await TeamMember.findOne({
      orgId: org._id,
      userId: existingUser._id,
      status: 'active',
    });
    if (existingMember) {
      throw ApiError.conflict('User is already a team member');
    }
  }

  const pending = await TeamInvite.findOne({
    orgId: org._id,
    email,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  });
  if (pending) {
    throw ApiError.conflict('An invitation is already pending for this email');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const invite = await TeamInvite.create({
    orgId: org._id,
    email,
    roleId: role._id,
    token,
    status: 'pending',
    expiresAt,
    invitedBy: userId,
    propertyScope: input.propertyScope?.map((id) => new mongoose.Types.ObjectId(id)) ?? [],
  });

  const inviterUser = await User.findById(userId);

  try {
    await sendTeamInviteEmail(email, {
      orgName: org.name,
      roleName: role.name,
      inviterName: inviterUser?.firstName ?? 'A team member',
      token,
      expiresAt,
    });
  } catch (err) {
    logger.warn(`[Team] Invite email failed, queuing: ${err instanceof Error ? err.message : 'Unknown'}`);
    await queueEmail({
      to: email,
      subject: `You're invited to join ${org.name} on B Aziz`,
      html: `<p>You have been invited as <strong>${role.name}</strong>. Token: ${token}</p>`,
    });
  }

  return {
    id: invite._id.toString(),
    email: invite.email,
    roleId: role._id.toString(),
    roleName: role.name,
    status: invite.status,
    expiresAt: invite.expiresAt,
  };
};

export const acceptInvite = async (input: AcceptInviteInput) => {
  const invite = await TeamInvite.findOne({ token: input.token, status: 'pending' });
  if (!invite) {
    throw ApiError.notFound('Invalid or expired invitation');
  }

  if (invite.expiresAt < new Date()) {
    invite.status = 'expired';
    await invite.save();
    throw ApiError.badRequest('Invitation has expired');
  }

  const role = await TeamRole.findById(invite.roleId);
  if (!role) throw ApiError.notFound('Role not found');

  let user = await User.findOne({ email: invite.email });

  if (!user) {
    if (!input.firstName || !input.password) {
      throw ApiError.badRequest('firstName and password are required for new accounts');
    }
    user = await User.create({
      firstName: input.firstName,
      email: invite.email,
      password: input.password,
      role: 'landlord',
      authProvider: 'email',
      isVerified: true,
      isProfileCompleted: false,
    });
  } else if (user.role !== 'landlord') {
    throw ApiError.badRequest('Only landlord accounts can join a team');
  }

  const existingMembership = await TeamMember.findOne({
    orgId: invite.orgId,
    userId: user._id,
    status: 'active',
  });
  if (existingMembership) {
    throw ApiError.conflict('You are already a member of this organization');
  }

  await TeamMember.findOneAndUpdate(
    { orgId: invite.orgId, userId: user._id },
    {
      orgId: invite.orgId,
      userId: user._id,
      roleId: invite.roleId,
      status: 'active',
      propertyScope: invite.propertyScope,
      invitedBy: invite.invitedBy,
      joinedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  invite.status = 'accepted';
  await invite.save();

  const team = await import('./team.seed').then((m) => m.getTeamContextForUser(user!._id.toString()));

  return {
    message: 'Invitation accepted successfully',
    user: {
      id: user._id.toString(),
      firstName: user.firstName,
      email: user.email,
      role: user.role,
    },
    team,
  };
};

export const updateMemberRole = async (
  actorUserId: string,
  memberId: string,
  input: UpdateMemberRoleInput
) => {
  const { org } = await getOrgForUser(actorUserId);
  const target = await TeamMember.findOne({ _id: memberId, orgId: org._id, status: 'active' });
  if (!target) throw ApiError.notFound('Team member not found');

  const currentRole = await TeamRole.findById(target.roleId);
  if (currentRole?.key === OWNER_ROLE_KEY) {
    throw ApiError.badRequest('Owner role cannot be changed');
  }

  const newRole = await assertNotOwnerRole(input.roleId, org._id);
  target.roleId = newRole._id;
  if (input.propertyScope !== undefined) {
    target.propertyScope = input.propertyScope.map((id) => new mongoose.Types.ObjectId(id));
  }
  await target.save();

  return formatMember(await target.populate('roleId'));
};

export const removeMember = async (actorUserId: string, memberId: string) => {
  const { org } = await getOrgForUser(actorUserId);
  const target = await TeamMember.findOne({ _id: memberId, orgId: org._id, status: 'active' });
  if (!target) throw ApiError.notFound('Team member not found');

  const role = await TeamRole.findById(target.roleId);
  if (role?.key === OWNER_ROLE_KEY) {
    throw ApiError.badRequest('Owner cannot be removed');
  }

  if (target.userId.toString() === actorUserId) {
    throw ApiError.badRequest('You cannot remove yourself');
  }

  target.status = 'removed';
  await target.save();

  await ProjectAssignment.deleteMany({ orgId: org._id, memberId: target._id });

  return { id: memberId, status: 'removed' };
};

export const assignProjectMember = async (
  userId: string,
  projectId: string,
  input: AssignProjectMemberInput
) => {
  const { org } = await getOrgForUser(userId);

  const property = await Property.findOne({
    _id: projectId,
    landlordId: org.ownerId,
    isActive: true,
  });
  if (!property) {
    throw ApiError.notFound('Project (property) not found');
  }

  const member = await TeamMember.findOne({
    _id: input.memberId,
    orgId: org._id,
    status: 'active',
  });
  if (!member) throw ApiError.notFound('Team member not found');

  const assignment = await ProjectAssignment.findOneAndUpdate(
    { projectId, memberId: member._id },
    {
      orgId: org._id,
      projectId,
      memberId: member._id,
      assignedBy: userId,
    },
    { upsert: true, new: true }
  );

  return {
    id: assignment._id.toString(),
    projectId,
    memberId: member._id.toString(),
  };
};

export const removeProjectMember = async (
  userId: string,
  projectId: string,
  memberId: string
) => {
  const { org } = await getOrgForUser(userId);

  const result = await ProjectAssignment.findOneAndDelete({
    orgId: org._id,
    projectId,
    memberId,
  });

  if (!result) throw ApiError.notFound('Project assignment not found');

  return { projectId, memberId, removed: true };
};

export const listProjectMembers = async (userId: string, projectId: string) => {
  const { org } = await getOrgForUser(userId);

  const assignments = await ProjectAssignment.find({ orgId: org._id, projectId }).populate({
    path: 'memberId',
    populate: { path: 'roleId' },
  });

  const members = await Promise.all(
    assignments.map((a) => {
      const member = a.memberId as unknown as Parameters<typeof formatMember>[0];
      return formatMember(member);
    })
  );

  return { projectId, members };
};

export const buildTeamSessionPayload = (team: TeamContext | null) => {
  if (!team) return null;
  return {
    orgId: team.orgId,
    teamRoleId: team.teamRoleId,
    teamRoleName: team.teamRoleName,
    permissions: team.permissions,
    propertyScope: team.propertyScope,
  };
};
