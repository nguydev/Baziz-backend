import Joi from 'joi';
import { ALL_PERMISSIONS } from './team.constants';
import type {
  AcceptInviteInput,
  AssignProjectMemberInput,
  CreateRoleInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  UpdateRoleInput,
} from './team.types';

const permissionKey = Joi.string().valid(...ALL_PERMISSIONS);

export const inviteMemberSchema = Joi.object<InviteMemberInput>({
  email: Joi.string().trim().email().required(),
  roleId: Joi.string().required(),
  propertyScope: Joi.array().items(Joi.string()).optional(),
}).options({ stripUnknown: true });

export const acceptInviteSchema = Joi.object<AcceptInviteInput>({
  token: Joi.string().trim().required(),
  firstName: Joi.string().trim().min(1).max(50).optional(),
  password: Joi.string().min(8).max(128).optional(),
}).options({ stripUnknown: true });

export const createRoleSchema = Joi.object<CreateRoleInput>({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().trim().max(500).optional(),
  enabledKeys: Joi.array().items(permissionKey).min(1).required(),
}).options({ stripUnknown: true });

export const updateRoleSchema = Joi.object<UpdateRoleInput>({
  name: Joi.string().trim().min(1).max(100).optional(),
  description: Joi.string().trim().max(500).optional(),
  enabledKeys: Joi.array().items(permissionKey).min(1).optional(),
})
  .min(1)
  .options({ stripUnknown: true });

export const updateMemberRoleSchema = Joi.object<UpdateMemberRoleInput>({
  roleId: Joi.string().required(),
  propertyScope: Joi.array().items(Joi.string()).optional(),
}).options({ stripUnknown: true });

export const assignProjectMemberSchema = Joi.object<AssignProjectMemberInput>({
  memberId: Joi.string().required(),
}).options({ stripUnknown: true });

export const roleIdParamSchema = Joi.object({
  id: Joi.string().required(),
});

export const memberIdParamSchema = Joi.object({
  id: Joi.string().required(),
});

export const projectIdParamSchema = Joi.object({
  projectId: Joi.string().required(),
});
