import type { RequestHandler } from "express";
import ApiError from "../utils/ApiError";
import asyncHandler from "../utils/asyncHandler";
import type { PermissionKey } from "../modules/team/team.constants";
import { ALL_PERMISSIONS } from "../modules/team/team.constants";
import logger from "../config/logger";

const isValidPermission = (key: string): key is PermissionKey =>
  (ALL_PERMISSIONS as readonly string[]).includes(key);

const getRequestPermissions = (req: Express.Request): string[] => {
  if (req.team?.permissions?.length) {
    return req.team.permissions;
  }
  return [];
};

const hasPermission = (req: Express.Request, key: PermissionKey): boolean => {
  if (!req.user) return false;

  if (req.user.role === "admin") return true;

  if (req.user.role !== "landlord") return false;

  const permissions = getRequestPermissions(req);

  if (permissions.length === 0) {
    return true;
  }

  return permissions.includes(key);
};

export const requirePermission = (...keys: PermissionKey[]): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized("User not authenticated");
    }

    if (req.user.role === "admin") {
      next();
      return;
    }

    if (req.user.role === "tenant" || req.user.role === "support_agent") {
      next();
      return;
    }

    for (const key of keys) {
      if (!isValidPermission(key)) {
        throw ApiError.internal(`Invalid permission key configured: ${key}`);
      }
      if (!hasPermission(req, key)) {
        logger.warn(
          `Permission denied: user=${req.user.email} required=${key} has=[${getRequestPermissions(req).join(",")}]`,
        );
        throw ApiError.forbidden(`Missing permission: ${key}`);
      }
    }

    next();
  });

export const requireAnyPermission = (
  ...keys: PermissionKey[]
): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    if (!req.user) {
      throw ApiError.unauthorized("User not authenticated");
    }

    if (req.user.role === "admin") {
      next();
      return;
    }

    if (req.user.role === "tenant" || req.user.role === "support_agent") {
      next();
      return;
    }

    const permissions = getRequestPermissions(req);
    if (permissions.length === 0) {
      next();
      return;
    }

    const allowed = keys.some((key) => permissions.includes(key));
    if (!allowed) {
      throw ApiError.forbidden(
        `Missing one of permissions: ${keys.join(", ")}`,
      );
    }

    next();
  });

export const attachTeamFromToken = (
  req: Express.Request,
  decoded: {
    orgId?: string;
    teamRoleId?: string;
    teamRoleName?: string;
    permissions?: string[];
  },
): void => {
  if (!decoded.orgId || !decoded.teamRoleId) return;

  req.team = {
    orgId: decoded.orgId,
    teamRoleId: decoded.teamRoleId,
    teamRoleName: decoded.teamRoleName ?? decoded.teamRoleId,
    permissions: (decoded.permissions ?? []).filter(isValidPermission),
    propertyScope: [],
  };
};
