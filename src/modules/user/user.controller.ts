/**
 * User Controller
 * HTTP handlers for profile management and admin user operations
 */

import type { Request, Response } from 'express';
import path from 'path';
import * as userService from './user.service';
import User from './user.model';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import type { ListUsersQuery } from './user.validation';
import { updateProfileSchema, updateSettingsSchema, updateNotificationPreferencesSchema } from './user.validation';
import type { IUserDocument } from './user.model';

/**
 * Shapes the user document for API responses — strips sensitive fields
 * and adds computed `fullName` for the profile page
 */
const formatUser = (user: IUserDocument) => ({
  id: user._id,
  fullName: user.firstName,
  email: user.email,
  phone: user.phone ?? null,
  avatar: user.avatar ?? null,
  companyName: user.companyName ?? null,
  address: user.address ?? null,
  role: user.role,
  isVerified: user.isVerified,
  isProfileCompleted: user.isProfileCompleted,
  biometricEnabled: user.biometricEnabled,
  twoFactorEnabled: user.twoFactorEnabled,
  autoBackupEnabled: user.autoBackupEnabled,
  locationServicesEnabled: user.locationServicesEnabled,
  latitude: user.latitude ?? null,
  longitude: user.longitude ?? null,
  language: user.language ?? 'en',
  theme: user.theme ?? 'light',
  emergencyContact: user.emergencyContact ?? null,
  notificationPreferences: user.notificationPreferences,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.user!._id.toString());
  res.status(200).json(ApiResponse.ok('Profile retrieved', { user: formatUser(user) }));
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = updateProfileSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    throw ApiError.badRequest('Validation failed', messages);
  }

  const hasTextFields = Object.keys(value as object).length > 0;
  const hasFile = !!req.file;

  if (!hasTextFields && !hasFile) {
    throw ApiError.badRequest('No fields provided for update');
  }

  const userId = req.user!._id.toString();
  const updateData: Record<string, unknown> = {};

  if (value.firstName !== undefined) updateData.firstName = value.firstName;
  if (value.phone !== undefined) updateData.phone = value.phone || null;
  if (value.companyName !== undefined) updateData.companyName = value.companyName || null;
  if (value.address !== undefined) updateData.address = value.address || null;
  if (value.emergencyContact !== undefined) updateData.emergencyContact = value.emergencyContact || null;

  if (hasFile) {
    const host = req.get('host') ?? 'localhost:5000';
    const relative = path.relative(process.cwd(), req.file!.path).replace(/\\/g, '/');
    updateData.avatar = `${req.protocol}://${host}/${relative}`;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!user) throw ApiError.notFound('User not found');

  res.status(200).json(ApiResponse.ok('Profile updated successfully', { user: formatUser(user) }));
});

export const removeAvatar = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.removeAvatar(req.user!._id.toString());
  res.status(200).json(
    ApiResponse.ok('Avatar removed successfully', { user: formatUser(user) })
  );
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  await userService.changePassword(req.user!._id.toString(), currentPassword, newPassword);
  res.status(200).json(ApiResponse.ok('Password changed successfully'));
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = updateSettingsSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    throw ApiError.badRequest('Validation failed', messages);
  }

  const user = await userService.updateSettings(req.user!._id.toString(), value);
  res.status(200).json(ApiResponse.ok('Settings updated successfully', { user: formatUser(user) }));
});

export const updateNotificationPreferences = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = updateNotificationPreferencesSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    throw ApiError.badRequest('Validation failed', messages);
  }

  const user = await userService.updateNotificationPreferences(req.user!._id.toString(), value);
  res.status(200).json(ApiResponse.ok('Notification preferences updated successfully', { user: formatUser(user) }));
});

export const deleteMyData = asyncHandler(async (req: Request, res: Response) => {
  // Permanently removes the user record and associated data
  await userService.deleteUser(req.user!._id.toString());
  res.status(200).json(ApiResponse.ok('All data deleted permanently'));
});

export const deactivateProfile = asyncHandler(async (req: Request, res: Response) => {
  // Deactivates the user account without deleting the data
  await userService.deactivateUser(req.user!._id.toString());
  res.status(200).json(ApiResponse.ok('Profile deactivated successfully'));
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { users, meta } = await userService.listUsers(req.query as unknown as ListUsersQuery);
  res.status(200).json(
    ApiResponse.ok('Users retrieved', users.map(formatUser), meta)
  );
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id);
  res.status(200).json(ApiResponse.ok('User retrieved', { user: formatUser(user) }));
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.deleteUser(req.params.id);
  res.status(200).json(ApiResponse.ok('User deleted'));
});
