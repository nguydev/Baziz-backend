import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import env from '../config/env';
import { ensureRedisReady, getRedisClient } from '../config/redis';
import logger from '../config/logger';

export interface TokenPayload extends JwtPayload {
  userId: string;
  role: string;
  isVerified: boolean;
  orgId?: string;
  teamRoleId?: string;
  teamRoleName?: string;
  permissions?: string[];
}

export interface TeamTokenContext {
  orgId: string;
  teamRoleId: string;
  teamRoleName: string;
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export const generateAccessToken = (
  userId: string,
  role: string,
  isVerified: boolean,
  team?: TeamTokenContext
): string => {
  const payload: TokenPayload = {
    userId,
    role,
    isVerified,
    ...(team && {
      orgId: team.orgId,
      teamRoleId: team.teamRoleId,
      teamRoleName: team.teamRoleName,
      permissions: team.permissions,
    }),
  };

  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: 'b-aziz-backend',
    audience: 'b-aziz-client',
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
};


export const generateRefreshToken = (userId: string): string => {
  const payload = { userId };

  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: 'b-aziz-backend',
  };

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
};

export const generateTokenPair = (
  userId: string,
  role: string,
  isVerified: boolean,
  team?: TeamTokenContext
): TokenPair => {
  const accessToken = generateAccessToken(userId, role, isVerified, team);
  const refreshToken = generateRefreshToken(userId);

  const expiresIn = parseInt(env.JWT_EXPIRES_IN as string) * 1000 || 7 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + expiresIn).toISOString();

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
};


export const verifyAccessToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new Error('Access token has expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    throw err;
  }
};

export const verifyRefreshToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token has expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw err;
  }
};


export const blacklistToken = async (token: string, expiresIn: number): Promise<void> => {
  try {
    const ready = await ensureRedisReady();
    if (!ready) {
      logger.warn('Failed to blacklist token: Redis unavailable');
      return;
    }

    const redis = getRedisClient();
    const key = `blacklist:${token}`;
    const ttlSeconds = Math.max(expiresIn * 60, 1);
    await redis.setex(key, ttlSeconds, '1');
  } catch (err) {
    logger.warn(`Failed to blacklist token: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
};

export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const ready = await ensureRedisReady();
    if (!ready) return false;

    const redis = getRedisClient();
    const key = `blacklist:${token}`;
    const result = await redis.get(key);
    return result !== null;
  } catch (err) {
    logger.warn(`Failed to check token blacklist: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return false;
  }
};


export const decodeToken = (token: string): JwtPayload | null => {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
};
