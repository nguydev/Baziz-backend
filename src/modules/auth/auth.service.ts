/**
 * Auth Service
 * Handles all authentication business logic
 * Implements: signup, signin, email verification, password reset, token refresh, logout
 */

import User, { IUserDocument, UserRole } from "../user/user.model";
import ApiError from "../../utils/ApiError";
import logger from "../../config/logger";
import { generateOTP, getOTPExpiry, isOTPExpired } from "../../utils/otp";
import {
  generateTokenPair,
  verifyRefreshToken,
  blacklistToken,
  TokenPair,
  generateAccessToken,
} from "../../utils/tokenManager";
import type {
  SignupInput,
  SigninInput,
  VerifyEmailInput,
  ResendOtpInput,
  ForgotPasswordInput,
  VerifyOtpInput,
  ResetPasswordInput,
  ChangePasswordInput,
} from "./auth.validation";
import { sendOTPEmail } from "../../utils/sendEmail";
import {
  ensureOrganizationForLandlord,
  getTeamContextForUser,
  provisionOrganizationForLandlord,
} from "../team/team.seed";
import { buildTeamSessionPayload } from "../team/team.service";
import type { TeamTokenContext } from "../../utils/tokenManager";
import {
  buildLoginSubscriptionPayload,
  provisionLandlordSubscription,
} from "../billing/billing.service";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

const resolveTeamTokenContext = async (
  user: IUserDocument,
): Promise<TeamTokenContext | undefined> => {
  if (user.role !== "landlord") return undefined;
  await ensureOrganizationForLandlord(user);
  const team = await getTeamContextForUser(user._id.toString());
  if (!team) return undefined;
  return {
    orgId: team.orgId,
    teamRoleId: team.teamRoleId,
    teamRoleName: team.teamRoleName,
    permissions: team.permissions,
  };
};

/**
 * Sign up new user
 * Creates user account and sends OTP for email verification
 */
export const signup = async (
  input: SignupInput,
): Promise<{
  message: string;
  email: string;
  user: Partial<IUserDocument>;
  session: TokenPair;
  _dev_otp?: string;
}> => {
  // Check if user already exists
  const existingUser = await User.findByEmail(input.email);
  if (existingUser) {
    throw ApiError.conflict("Email already registered");
  }

  // Create new user
  const user = new User({
    firstName: input.firstName,
    email: input.email,
    password: input.password,
    role: input.role as UserRole,
    authProvider: "email",
    isVerified: false,
    isProfileCompleted: false,
  });

  // Generate OTP
  const otp = generateOTP();
  user.otp = otp;
  user.otpExpiry = getOTPExpiry();

  await user.save();

  if (user.role === "landlord") {
    await provisionOrganizationForLandlord(user._id.toString(), user.firstName);
    void provisionLandlordSubscription(
      user._id.toString(),
      user.email,
      user.firstName,
    );
  }

  // Generate tokens (unverified user)
  const teamContext = await resolveTeamTokenContext(user);
  const tokens = generateTokenPair(
    user._id.toString(),
    user.role,
    false,
    teamContext,
  );

  // Send OTP email
  try {
    await sendOTPEmail(user.email, user.firstName, otp);
  } catch (err) {
    logger.error(
      `Failed to send OTP email: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
    // Don't throw error, user can resend OTP
  }

  logger.info(`User registered: ${user.email} (${user.role})`);

  return {
    message:
      "Registration successful. Please verify your email with the OTP sent.",
    email: user.email,
    user: {
      id: user._id,
      firstName: user.firstName,
      email: user.email,
      authProvider: user.authProvider,
      isProfileCompleted: user.isProfileCompleted,
    },
    session: tokens,
    _dev_otp: process.env.NODE_ENV === "development" ? otp : undefined,
  };
};

/**
 * Sign in user
 * Validates credentials and returns tokens
 */
export const signin = async (
  input: SigninInput,
): Promise<{
  message: string;
  user: Partial<IUserDocument>;
  team: ReturnType<typeof buildTeamSessionPayload>;
  subscription: Awaited<ReturnType<typeof buildLoginSubscriptionPayload>>;
  session: TokenPair;
}> => {
  // Must select password explicitly since it has select: false
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    "+password +loginAttempts +lockUntil +refreshTokens",
  );
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  // Check if account is locked
  if (user.isAccountLocked()) {
    throw ApiError.forbidden(
      `Account is locked. Please try again after ${Math.ceil((user.lockUntil!.getTime() - Date.now()) / 60000)} minutes`,
    );
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(input.password);
  if (!isPasswordValid) {
    // Increment login attempts
    user.loginAttempts = (user.loginAttempts || 0) + 1;

    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_TIME);
      logger.warn(`Account locked due to failed login attempts: ${user.email}`);
    }

    await user.save({ validateBeforeSave: false });
    throw ApiError.unauthorized("Invalid email or password");
  }

  // Check if account is active
  if (!user.isActive) {
    throw ApiError.forbidden("Account is deactivated");
  }

  // Check if account is verified
  if (!user.isVerified) {
    // Auto-resend OTP for better UX
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiry = getOTPExpiry();
    await user.save({ validateBeforeSave: false });

    try {
      await sendOTPEmail(user.email, user.firstName, otp);
    } catch (err) {
      logger.error(
        `Failed to auto-resend OTP email on login: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }

    throw ApiError.forbidden(
      "Email not verified. A new OTP has been sent to your email.",
    );
  }

  // Reset login attempts on successful login
  user.loginAttempts = 0;
  user.lockUntil = null;
  user.lastLogin = new Date();

  const teamContext = await resolveTeamTokenContext(user);
  const team = buildTeamSessionPayload(
    teamContext
      ? {
          orgId: teamContext.orgId,
          teamRoleId: teamContext.teamRoleId,
          teamRoleName: teamContext.teamRoleName,
          permissions:
            teamContext.permissions as import("../team/team.constants").PermissionKey[],
          propertyScope: [],
        }
      : null,
  );

  // Generate tokens
  const tokens = generateTokenPair(
    user._id.toString(),
    user.role,
    user.isVerified,
    teamContext,
  );

  const subscription = await buildLoginSubscriptionPayload(user._id.toString());

  if (user.role === "landlord") {
    void provisionLandlordSubscription(
      user._id.toString(),
      user.email,
      user.firstName,
    );
  }

  // Store refresh token in database
  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push({
    token: tokens.refreshToken,
    expiresAt: new Date(tokens.expiresAt),
    createdAt: new Date(),
  });

  // Keep only last 5 refresh tokens
  if (user.refreshTokens.length > 5) {
    user.refreshTokens = user.refreshTokens.slice(-5);
  }

  await user.save({ validateBeforeSave: false });

  logger.info(`User logged in: ${user.email}`);

  return {
    message: "Login successful",
    user: {
      id: user._id,
      firstName: user.firstName,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      authProvider: user.authProvider,
    },
    team,
    subscription,
    session: tokens,
  };
};

/**
 * Verify email with OTP
 * Marks user as verified after OTP validation
 */
export const verifyEmail = async (
  input: VerifyEmailInput,
): Promise<{
  message: string;
  user: Partial<IUserDocument>;
}> => {
  // Must select otp and otpExpiry explicitly since they have select: false
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    "+otp +otpExpiry",
  );
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // Check if already verified
  if (user.isVerified) {
    throw ApiError.badRequest("Email already verified");
  }

  // Validate OTP
  if (!user.otp || user.otp !== input.otp) {
    throw ApiError.badRequest("Invalid OTP");
  }

  if (isOTPExpired(user.otpExpiry)) {
    throw ApiError.badRequest("OTP has expired. Please request a new one.");
  }

  // Mark as verified
  user.isVerified = true;
  user.otp = null;
  user.otpExpiry = null;

  await user.save({ validateBeforeSave: false });

  logger.info(`Email verified: ${user.email}`);

  return {
    message: "Email verified successfully",
    user: {
      id: user._id,
      firstName: user.firstName,
      email: user.email,
      isVerified: user.isVerified,
      authProvider: user.authProvider,
      isProfileCompleted: user.isProfileCompleted,
    },
  };
};

/**
 * Resend OTP to user email
 */
export const resendOTP = async (
  input: ResendOtpInput,
): Promise<{
  message: string;
  accessToken: string;
  _dev_otp?: string;
}> => {
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    "+otp +otpExpiry",
  );
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (user.isVerified) {
    throw ApiError.badRequest("Email already verified");
  }

  // Generate new OTP
  const otp = generateOTP();
  user.otp = otp;
  user.otpExpiry = getOTPExpiry();

  await user.save({ validateBeforeSave: false });

  // Send OTP email
  try {
    await sendOTPEmail(user.email, user.firstName, otp);
  } catch (err) {
    logger.error(
      `Failed to send OTP email: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }

  // Generate temporary access token for unverified user
  const accessToken = generateAccessToken(
    user._id.toString(),
    user.role,
    false,
  );

  logger.info(`OTP resent to: ${user.email}`);

  return {
    message: "OTP sent successfully to your email",
    accessToken,
    _dev_otp: process.env.NODE_ENV === "development" ? otp : undefined,
  };
};

/**
 * Initiate password reset
 * Sends OTP to user email
 */
export const forgotPassword = async (
  input: ForgotPasswordInput,
): Promise<{
  message: string;
  _dev_otp?: string;
}> => {
  const user = await User.findByEmail(input.email);
  if (!user) {
    // Don't reveal if email exists (security best practice)
    return {
      message: "If email exists, OTP will be sent shortly",
      _dev_otp:
        process.env.NODE_ENV === "development" ? "user-not-found" : undefined,
    };
  }

  // Generate OTP
  const otp = generateOTP();
  user.otp = otp;
  user.otpExpiry = getOTPExpiry();

  await user.save({ validateBeforeSave: false });

  // Send OTP email
  try {
    await sendOTPEmail(user.email, user.firstName, otp, "password-reset");
  } catch (err) {
    logger.error(
      `Failed to send password reset OTP: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
  }

  logger.info(`Password reset OTP sent to: ${user.email}`);

  return {
    message: "OTP sent to your email for password reset.",
    _dev_otp: process.env.NODE_ENV === "development" ? otp : undefined,
  };
};

/**
 * Verify OTP for password reset
 * Returns temporary token for password reset
 */
export const verifyOTP = async (
  input: VerifyOtpInput,
): Promise<{
  message: string;
  accessToken: string;
}> => {
  // Must select otp and otpExpiry explicitly since they have select: false
  const user = await User.findOne({ email: input.email.toLowerCase() }).select(
    "+otp +otpExpiry",
  );
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // Validate OTP
  if (!user.otp || user.otp !== input.otp) {
    throw ApiError.badRequest("Invalid OTP");
  }

  if (isOTPExpired(user.otpExpiry)) {
    throw ApiError.badRequest("OTP has expired. Please request a new one.");
  }

  // Generate temporary access token for password reset
  const accessToken = generateAccessToken(
    user._id.toString(),
    user.role,
    user.isVerified,
  );

  logger.info(`OTP verified for password reset: ${user.email}`);

  return {
    message: "OTP verified successfully. You can now reset your password.",
    accessToken,
  };
};

/**
 * Reset password
 * Requires valid access token from OTP verification
 */
export const resetPassword = async (
  userId: string,
  input: ResetPasswordInput,
): Promise<{
  message: string;
}> => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // Update password
  user.password = input.newPassword;
  user.otp = null;
  user.otpExpiry = null;
  user.refreshTokens = []; // Invalidate all refresh tokens

  await user.save();

  logger.info(`Password reset for user: ${user.email}`);

  return {
    message: "Password reset successfully.",
  };
};

/**
 * Change password
 * Requires valid access token
 */
export const changePassword = async (
  userId: string,
  input: ChangePasswordInput,
): Promise<{
  message: string;
}> => {
  const user = await User.findById(userId).select("+password +refreshTokens");
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  if (input.oldPassword) {
    const isPasswordValid = await user.comparePassword(input.oldPassword);
    if (!isPasswordValid) {
      throw ApiError.badRequest("Invalid old password");
    }
  }

  const isSamePassword = await user.comparePassword(input.newPassword);
  if (isSamePassword) {
    throw ApiError.badRequest(
      "New password must be different from the old password",
    );
  }

  user.password = input.newPassword;

  // Optionally, invalidate all refresh tokens to force re-login on other devices
  // user.refreshTokens = [];

  await user.save();

  logger.info(`Password changed for user: ${user.email}`);

  return {
    message: "Password changed successfully",
  };
};

/**
 * Refresh access token
 * Validates refresh token and returns new token pair
 */
export const refreshAccessToken = async (
  refreshToken: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}> => {
  try {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);
    const userId = decoded.userId as string;

    // Find user and validate refresh token
    const user = await User.findById(userId).select("+refreshTokens");
    if (!user) {
      throw ApiError.unauthorized("User not found");
    }

    // Check if refresh token exists in database
    const tokenExists = user.refreshTokens?.some(
      (rt) => rt.token === refreshToken,
    );
    if (!tokenExists) {
      throw ApiError.unauthorized("Invalid refresh token");
    }

    // Generate new token pair
    const teamContext = await resolveTeamTokenContext(user);
    const tokens = generateTokenPair(
      user._id.toString(),
      user.role,
      user.isVerified,
      teamContext,
    );

    // Update refresh token in database
    user.refreshTokens =
      user.refreshTokens?.filter((rt) => rt.token !== refreshToken) || [];
    user.refreshTokens.push({
      token: tokens.refreshToken,
      expiresAt: new Date(tokens.expiresAt),
      createdAt: new Date(),
    });

    // Keep only last 5 refresh tokens
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save({ validateBeforeSave: false });

    logger.info(`Token refreshed for user: ${user.email}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }
};

/**
 * Logout user
 * Invalidates refresh token
 */
export const logout = async (
  userId: string,
  refreshToken?: string,
): Promise<void> => {
  const user = await User.findById(userId).select("+refreshTokens");
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  // Remove refresh token from database
  if (refreshToken) {
    user.refreshTokens =
      user.refreshTokens?.filter((rt) => rt.token !== refreshToken) || [];
    await user.save({ validateBeforeSave: false });
  }

  // Blacklist token in Redis
  if (refreshToken) {
    const decoded = verifyRefreshToken(refreshToken);
    const expiresIn = Math.floor(
      (decoded.exp! - Math.floor(Date.now() / 1000)) / 60,
    );
    await blacklistToken(refreshToken, expiresIn);
  }

  logger.info(`User logged out: ${user.email}`);
};

/**
 * Get current user
 */
export const getCurrentUser = async (
  userId: string,
): Promise<Partial<IUserDocument>> => {
  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }

  return {
    id: user._id,
    firstName: user.firstName,
    email: user.email,
    role: user.role,
    isVerified: user.isVerified,
    isProfileCompleted: user.isProfileCompleted,
    authProvider: user.authProvider,
    avatar: user.avatar,
  };
};
