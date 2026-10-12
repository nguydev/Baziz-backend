import type { Request, Response } from 'express';
import Joi from 'joi';
import * as teamService from './team.service';
import {
  acceptInviteSchema,
  assignProjectMemberSchema,
  createRoleSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateRoleSchema,
} from './team.validation';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import type {
  AcceptInviteInput,
  AssignProjectMemberInput,
  CreateRoleInput,
  InviteMemberInput,
  UpdateMemberRoleInput,
  UpdateRoleInput,
} from './team.types';

const validate = <T>(schema: Joi.ObjectSchema<T>, data: unknown): T => {
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw ApiError.badRequest('Validation failed', error.details.map((d) => d.message));
  }
  return value as T;
};

const getUserId = (req: Request): string => {
  if (!req.user) throw ApiError.unauthorized('User not authenticated');
  return req.user._id.toString();
};

export const listPermissions = asyncHandler(async (_req: Request, res: Response) => {
  const permissions = teamService.listPermissions();
  res.status(200).json(ApiResponse.ok('Permissions retrieved', { permissions }));
});

export const listRoles = asyncHandler(async (req: Request, res: Response) => {
  const roles = await teamService.listRoles(getUserId(req));
  res.status(200).json(ApiResponse.ok('Roles retrieved', { roles }));
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const input = validate<CreateRoleInput>(createRoleSchema, req.body);
  const role = await teamService.createRole(getUserId(req), input);
  res.status(201).json(ApiResponse.created('Role created', { role }));
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  const input = validate<UpdateRoleInput>(updateRoleSchema, req.body);
  const role = await teamService.updateRole(getUserId(req), req.params.id, input);
  res.status(200).json(ApiResponse.ok('Role updated', { role }));
});

export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
  const result = await teamService.deleteRole(getUserId(req), req.params.id);
  res.status(200).json(ApiResponse.ok('Role deleted', result));
});

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  const data = await teamService.listMembers(getUserId(req));
  res.status(200).json(ApiResponse.ok('Team members retrieved', data));
});

export const inviteMember = asyncHandler(async (req: Request, res: Response) => {
  const input = validate<InviteMemberInput>(inviteMemberSchema, req.body);
  const invite = await teamService.inviteMember(getUserId(req), input);
  res.status(201).json(ApiResponse.created('Invitation sent', { invite }));
});

export const acceptInvite = asyncHandler(async (req: Request, res: Response) => {
  const input = validate<AcceptInviteInput>(acceptInviteSchema, req.body);
  const result = await teamService.acceptInvite(input);
  res.status(200).json(ApiResponse.ok(result.message, result));
});

export const updateMemberRole = asyncHandler(async (req: Request, res: Response) => {
  const input = validate<UpdateMemberRoleInput>(updateMemberRoleSchema, req.body);
  const member = await teamService.updateMemberRole(getUserId(req), req.params.id, input);
  res.status(200).json(ApiResponse.ok('Member role updated', { member }));
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const result = await teamService.removeMember(getUserId(req), req.params.id);
  res.status(200).json(ApiResponse.ok('Member removed', result));
});

export const assignProjectMember = asyncHandler(async (req: Request, res: Response) => {
  const input = validate<AssignProjectMemberInput>(assignProjectMemberSchema, req.body);
  const assignment = await teamService.assignProjectMember(
    getUserId(req),
    req.params.projectId,
    input
  );
  res.status(201).json(ApiResponse.created('Member assigned to project', { assignment }));
});

export const removeProjectMember = asyncHandler(async (req: Request, res: Response) => {
  const result = await teamService.removeProjectMember(
    getUserId(req),
    req.params.projectId,
    req.params.memberId
  );
  res.status(200).json(ApiResponse.ok('Member removed from project', result));
});

export const listProjectMembers = asyncHandler(async (req: Request, res: Response) => {
  const data = await teamService.listProjectMembers(getUserId(req), req.params.projectId);
  res.status(200).json(ApiResponse.ok('Project members retrieved', data));
});
