import Organization from './organization.model';
import TeamRole from './team-role.model';
import TeamMember from './team-member.model';
import { SYSTEM_ROLE_DEFINITIONS, OWNER_ROLE_KEY } from './team.constants';
import type { TeamContext } from './team.types';
import type { IUserDocument } from '../user/user.model';
import logger from '../../config/logger';

/**
 * Create organization + 7 system roles + owner membership for a new landlord.
 */
export const provisionOrganizationForLandlord = async (
  userId: string,
  displayName?: string
): Promise<void> => {
  const existing = await Organization.findOne({ ownerId: userId });
  if (existing) return;

  const org = await Organization.create({
    ownerId: userId,
    name: displayName ? `${displayName}'s Organization` : 'My Organization',
    isActive: true,
  });

  const roleDocs = await TeamRole.insertMany(
    SYSTEM_ROLE_DEFINITIONS.map((def) => ({
      orgId: org._id,
      key: def.key,
      name: def.name,
      description: def.description,
      isSystem: true,
      enabledKeys: def.enabledKeys,
    }))
  );

  const ownerRole = roleDocs.find((r) => r.key === OWNER_ROLE_KEY);
  if (!ownerRole) {
    throw new Error('Owner role seed failed');
  }

  await TeamMember.create({
    orgId: org._id,
    userId,
    roleId: ownerRole._id,
    status: 'active',
    propertyScope: [],
    joinedAt: new Date(),
  });

  logger.info(`[Team] Organization provisioned for landlord ${userId}`);
};

/**
 * Ensure legacy landlords have an organization (migration on login).
 * Skips users who are team members of another org (invited staff).
 */
export const ensureOrganizationForLandlord = async (user: IUserDocument): Promise<void> => {
  if (user.role !== 'landlord') return;

  const ownsOrg = await Organization.findOne({ ownerId: user._id });
  if (ownsOrg) return;

  const externalMembership = await TeamMember.findOne({
    userId: user._id,
    status: 'active',
  });
  if (externalMembership) return;

  await provisionOrganizationForLandlord(user._id.toString(), user.firstName);
};

/**
 * Build team context for JWT and login response.
 */
export const getTeamContextForUser = async (
  userId: string
): Promise<TeamContext | null> => {
  const member = await TeamMember.findOne({
    userId,
    status: 'active',
  }).populate<{ roleId: { key: string; name: string; enabledKeys: string[] } }>('roleId');

  if (!member || !member.roleId || typeof member.roleId === 'string') {
    return null;
  }

  const role = member.roleId;

  return {
    orgId: member.orgId.toString(),
    teamRoleId: role.key,
    teamRoleName: role.name,
    permissions: role.enabledKeys as TeamContext['permissions'],
    propertyScope: member.propertyScope.map((id) => id.toString()),
  };
};
