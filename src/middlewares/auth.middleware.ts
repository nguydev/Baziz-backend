import ApiError from '../utils/ApiError';
import asyncHandler from '../utils/asyncHandler';
import User from '../modules/user/user.model';
import { verifyAccessToken, isTokenBlacklisted } from '../utils/tokenManager';
import { attachTeamFromToken } from './permission.middleware';
import logger from '../config/logger';

/**
 * Authentication Middleware
 * Verifies JWT access token and attaches user to request
 */
export const authMiddleware = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Access token required');
  }

  const token = authHeader.split(' ')[1];

  try {
    // Check if token is blacklisted
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      throw ApiError.unauthorized('Token has been revoked');
    }

    // Verify token
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or inactive');
    }

    req.user = user;
    attachTeamFromToken(req, decoded);
    next();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error) {
      logger.warn(`Auth error: ${err.message}`);
      throw ApiError.unauthorized(err.message);
    }
    throw ApiError.unauthorized('Invalid or expired token');
  }
});

/**
 * Authorization Middleware
 * Checks if user has required role
 */
export const authorize =
  (...roles: string[]) =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized('User not authenticated');
    }

    if (roles.length && !roles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt by ${req.user.email} (role: ${req.user.role}) for required roles: ${roles.join(', ')}`);
      throw ApiError.forbidden(`Insufficient permissions: Your role is '${req.user.role}' but required is one of '${roles.join(', ')}'`);
    }

    next();
  });

/**
 * Optional Auth Middleware
 * Attaches user if token is valid, but doesn't fail if missing
 */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.userId);

      if (user && user.isActive) {
        req.user = user;
        attachTeamFromToken(req, decoded);
      }
    } catch (err) {
      // Silently fail, user will be undefined
      logger.debug(`Optional auth failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  next();
});
