/**
 * Auth Controller
 * Handles HTTP requests for authentication endpoints
 */

import type { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import * as authValidation from './auth.validation';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';
import ApiError from '../../utils/ApiError';
import Joi from 'joi';

/**
 * Helper to validate request body and throw on error
 */
const validateBody = <T>(schema: Joi.Schema, body: unknown): T => {
  const { error, value } = schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map((d) => d.message);
    throw ApiError.badRequest('Validation failed', errors);
  }

  return value as T;
};

/**
 * POST /auth/signup
 * Register new user
 */
export const signup = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = validateBody<authValidation.SignupInput>(authValidation.signupSchema, req.body);
  const result = await authService.signup(input);

  res.status(201).json(
    ApiResponse.created('Registration successful. Please verify your email with the OTP sent.', {
      email: result.email,
      user: result.user,
      session: result.session,
      _dev_otp: result._dev_otp,
    })
  );
});

/**
 * POST /auth/signin
 * Login user
 */
export const signin = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = validateBody<authValidation.SigninInput>(authValidation.signinSchema, req.body);
  const result = await authService.signin(input);

  res.status(200).json(
    ApiResponse.ok('Login successful', {
      user: result.user,
      team: result.team,
      subscription: result.subscription,
      session: result.session,
    })
  );
});

/**
 * POST /auth/verify-email
 * Verify email with OTP
 */
export const verifyEmail = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = validateBody<authValidation.VerifyEmailInput>(authValidation.verifyEmailSchema, req.body);
  const result = await authService.verifyEmail(input);

  res.status(200).json(
    ApiResponse.ok('Email verified successfully', {
      user: result.user,
    })
  );
});

/**
 * POST /auth/resend-otp
 * Resend OTP to email
 */
export const resendOTP = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = validateBody<authValidation.ResendOtpInput>(authValidation.resendOtpSchema, req.body);
  const result = await authService.resendOTP(input);

  res.status(200).json(
    ApiResponse.ok('OTP sent successfully to your email', {
      accessToken: result.accessToken,
      _dev_otp: result._dev_otp,
    })
  );
});

/**
 * POST /auth/forgot-password
 * Initiate password reset
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = validateBody<authValidation.ForgotPasswordInput>(authValidation.forgotPasswordSchema, req.body);
  const result = await authService.forgotPassword(input);

  res.status(200).json(
    ApiResponse.ok('OTP sent to your email for password reset.', {
      _dev_otp: result._dev_otp,
    })
  );
});

/**
 * POST /auth/verify-otp
 * Verify OTP for password reset
 */
export const verifyOTP = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = validateBody<authValidation.VerifyOtpInput>(authValidation.verifyOtpSchema, req.body);
  const result = await authService.verifyOTP(input);

  res.status(200).json(
    ApiResponse.ok('OTP verified successfully. You can now reset your password.', {
      accessToken: result.accessToken,
    })
  );
});

/**
 * POST /auth/reset-password
 * Reset password (requires valid access token)
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?._id.toString();
  if (!userId) {
    throw ApiError.unauthorized('User not authenticated');
  }

  const input = validateBody<authValidation.ResetPasswordInput>(authValidation.resetPasswordSchema, req.body);
  const result = await authService.resetPassword(userId, input);

  res.status(200).json(ApiResponse.ok(result.message));
});

/**
 * POST /auth/change-password
 * Change password (requires valid access token)
 */
export const changePassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?._id.toString();
  if (!userId) {
    throw ApiError.unauthorized('User not authenticated');
  }

  const input = validateBody<authValidation.ChangePasswordInput>(authValidation.changePasswordSchema, req.body);
  const result = await authService.changePassword(userId, input);

  res.status(200).json(ApiResponse.ok(result.message));
});

/**
 * POST /auth/refresh-token
 * Refresh access token
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = validateBody<authValidation.RefreshTokenInput>(authValidation.refreshTokenSchema, req.body);
  const result = await authService.refreshAccessToken(input.refreshToken);

  res.status(200).json(
    ApiResponse.ok('Token refreshed', {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
    })
  );
});

/**
 * POST /auth/logout
 * Logout user
 */
export const logout = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?._id.toString();
  if (!userId) {
    throw ApiError.unauthorized('User not authenticated');
  }

  const refreshToken = req.body.refreshToken as string | undefined;
  await authService.logout(userId, refreshToken);

  res.status(200).json(ApiResponse.ok('Logged out successfully'));
});

/**
 * GET /auth/me
 * Get current user
 */
export const getCurrentUser = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user?._id.toString();
  if (!userId) {
    throw ApiError.unauthorized('User not authenticated');
  }

  const user = await authService.getCurrentUser(userId);

  res.status(200).json(ApiResponse.ok('User retrieved successfully', { user }));
});
