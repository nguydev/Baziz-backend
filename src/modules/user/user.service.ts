import path from 'path';
import fs from 'fs';
import User, { IUserDocument } from './user.model';
import ApiError from '../../utils/ApiError';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import logger from '../../config/logger';
import type { PaginationMeta } from '../../types/api.types';
import type { SignupInput, UpdateProfileInput, UpdateSettingsInput, UpdateNotificationPreferencesInput, ListUsersQuery } from './user.validation';

/**
 * Derives the public avatar URL from the stored file path
 */
const buildAvatarUrl = (host: string, protocol: string, filePath: string): string => {
  const relative = filePath.replace(process.cwd(), '').replace(/\\/g, '/');
  return `${protocol}://${host}${relative}`;
};

/**
 * Removes an old avatar file from disk safely (non-throwing)
 */
const removeAvatarFile = (avatarUrl: string | null): void => {
  if (!avatarUrl) return;
  try {
    const urlPath = new URL(avatarUrl).pathname;
    const filePath = path.join(process.cwd(), urlPath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    logger.warn(`Failed to remove old avatar file: ${avatarUrl}`);
  }
};

/**
 * Create new user
 */
export const createUser = async (userData: SignupInput): Promise<IUserDocument> => {
  const existing = await User.findByEmail(userData.email);
  if (existing) {
    throw ApiError.conflict('Email already registered');
  }

  const user = new User({
    firstName: userData.firstName,
    email: userData.email,
    password: userData.password,
    role: userData.role,
    authProvider: 'email',
    isVerified: false,
    isProfileCompleted: false,
  });

  await user.save();
  logger.info(`User created: ${user.email}`);

  return user;
};

/**
 * Get user by ID
 */
export const getUserById = async (id: string): Promise<IUserDocument> => {
  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  return user;
};

/**
 * Get user by email
 */
export const getUserByEmail = async (
  email: string,
  includePassword = false
): Promise<IUserDocument | null> => {
  if (includePassword) {
    return User.findOne({ email: email.toLowerCase() }).select(
      '+password +refreshTokens +loginAttempts +lockUntil +otp +otpExpiry'
    );
  }
  return User.findOne({ email: email.toLowerCase() });
};

/**
 * Update profile fields: firstName, phone, companyName, address
 * Email is excluded — changing email requires a dedicated verify flow
 */
export const updateProfile = async (
  userId: string,
  input: UpdateProfileInput
): Promise<IUserDocument> => {
  const updateData: Record<string, unknown> = {};

  if (input.firstName !== undefined) updateData.firstName = input.firstName;
  if (input.phone !== undefined) updateData.phone = input.phone || null;
  if (input.companyName !== undefined) updateData.companyName = input.companyName || null;
  if (input.address !== undefined) updateData.address = input.address || null;

  if (Object.keys(updateData).length === 0) {
    throw ApiError.badRequest('No fields provided for update');
  }

  const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true });

  if (!user) throw ApiError.notFound('User not found');

  logger.info(`Profile updated: ${user.email}`);
  return user;
};

/**
 * Update user settings (biometric, 2fa, backup)
 */
export const updateSettings = async (
  userId: string,
  input: UpdateSettingsInput
): Promise<IUserDocument> => {
  const updateData: Record<string, unknown> = {};

  if (input.biometricEnabled !== undefined) updateData.biometricEnabled = input.biometricEnabled;
  if (input.twoFactorEnabled !== undefined) updateData.twoFactorEnabled = input.twoFactorEnabled;
  if (input.autoBackupEnabled !== undefined) updateData.autoBackupEnabled = input.autoBackupEnabled;
  if (input.locationServicesEnabled !== undefined) updateData.locationServicesEnabled = input.locationServicesEnabled;
  if (input.latitude !== undefined) updateData.latitude = input.latitude;
  if (input.longitude !== undefined) updateData.longitude = input.longitude;

  if (Object.keys(updateData).length === 0) {
    throw ApiError.badRequest('No settings provided for update');
  }

  const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true });

  if (!user) throw ApiError.notFound('User not found');

  logger.info(`Settings updated for user: ${user.email}`);
  return user;
};

/**
 * Update user notification preferences
 */
export const updateNotificationPreferences = async (
  userId: string,
  input: UpdateNotificationPreferencesInput
): Promise<IUserDocument> => {
  if (Object.keys(input).length === 0) {
    throw ApiError.badRequest('No notification preferences provided for update');
  }

  // Use dot notation to safely update nested fields
  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      updateData[`notificationPreferences.${key}`] = value;
    }
  }

  const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true });

  if (!user) throw ApiError.notFound('User not found');

  logger.info(`Notification preferences updated for user: ${user.email}`);
  return user;
};

/**
 * Upload or replace avatar image
 * Deletes the previous avatar file from disk before saving the new one
 */
export const uploadAvatar = async (
  userId: string,
  file: Express.Multer.File,
  host: string,
  protocol: string
): Promise<IUserDocument> => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  removeAvatarFile(user.avatar);

  const avatarUrl = buildAvatarUrl(host, protocol, file.path);
  user.avatar = avatarUrl;
  await user.save();

  logger.info(`Avatar updated: ${user.email}`);
  return user;
};

/**
 * Remove avatar — deletes file from disk and clears the DB field
 */
export const removeAvatar = async (userId: string): Promise<IUserDocument> => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  if (!user.avatar) throw ApiError.badRequest('No avatar to remove');

  removeAvatarFile(user.avatar);
  user.avatar = null;
  await user.save();

  logger.info(`Avatar removed: ${user.email}`);
  return user;
};

/**
 * Generic internal update (used by auth module — not exposed via profile endpoint)
 */
export const updateUser = async (
  id: string,
  updates: Record<string, unknown>
): Promise<IUserDocument> => {
  const user = await User.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
  if (!user) throw ApiError.notFound('User not found');
  logger.info(`User updated: ${user.email}`);
  return user;
};

/**
 * Delete user
 */
export const deleteUser = async (id: string): Promise<IUserDocument> => {
  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  logger.info(`User deleted: ${user.email}`);
  return user;
};

/**
 * List users with pagination and filtering
 */
export const listUsers = async (
  query: ListUsersQuery
): Promise<{ users: IUserDocument[]; meta: PaginationMeta }> => {
  const { page, limit, skip } = getPagination(query);
  const filter: Record<string, unknown> = { isActive: true };

  if (query.search) {
    filter.$or = [
      { firstName: { $regex: query.search, $options: 'i' } },
      { lastName: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
    ];
  }

  if (query.role) {
    filter.role = query.role;
  }

  if (query.isVerified !== undefined) {
    filter.isVerified = query.isVerified;
  }

  const [users, total] = await Promise.all([
    User.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(filter),
  ]);

  return {
    users,
    meta: buildPaginationMeta(total, page, limit),
  };
};

/**
 * Change password
 */
export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<IUserDocument> => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  user.password = newPassword;
  user.refreshTokens = []; // Invalidate all sessions
  await user.save();

  logger.info(`Password changed for user: ${user.email}`);
  return user;
};

/**
 * Deactivate user account
 */
export const deactivateUser = async (userId: string): Promise<IUserDocument> => {
  const user = await User.findByIdAndUpdate(
    userId,
    { isActive: false, refreshTokens: [] },
    { new: true }
  );

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  logger.info(`User deactivated: ${user.email}`);
  return user;
};

/**
 * Reactivate user account
 */
export const reactivateUser = async (userId: string): Promise<IUserDocument> => {
  const user = await User.findByIdAndUpdate(userId, { isActive: true }, { new: true });

  if (!user) {
    throw ApiError.notFound('User not found');
  }

  logger.info(`User reactivated: ${user.email}`);
  return user;
};
