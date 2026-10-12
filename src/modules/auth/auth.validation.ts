import Joi from 'joi';
import type { UserRole } from '../user/user.model';

// Password validation pattern: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special char
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const signupSchema = Joi.object({
  firstName: Joi.string().trim().required().max(50).messages({
    'string.empty': 'First name is required',
    'string.max': 'First name cannot exceed 50 characters',
  }),
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
  }),
  password: Joi.string().required().pattern(passwordPattern).messages({
    'string.empty': 'Password is required',
    'string.pattern.base':
      'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
  }),
  confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
    'any.only': 'Passwords do not match',
    'string.empty': 'Confirm password is required',
  }),
  role: Joi.string()
    .valid('landlord', 'tenant', 'admin')
    .default('tenant')
    .messages({
      'any.only': 'Role must be landlord, tenant, or admin',
    }),
  termsAccepted: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must accept the terms and conditions',
  }),
});

export const signinSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
  }),
});

export const verifyEmailSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  otp: Joi.string().length(6).required().messages({
    'string.length': 'OTP must be 6 digits',
  }),
});

export const resendOtpSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

export const verifyOtpSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  otp: Joi.string().length(6).required().messages({
    'string.length': 'OTP must be 6 digits',
  }),
});

export const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().required().pattern(passwordPattern).messages({
    'string.empty': 'New password is required',
    'string.pattern.base':
      'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
  }),
  confirmPassword: Joi.string().required().valid(Joi.ref('newPassword')).messages({
    'any.only': 'Passwords do not match',
  }),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().optional().messages({
    'string.empty': 'Old password cannot be empty if provided',
  }),
  newPassword: Joi.string().required().pattern(passwordPattern).messages({
    'string.empty': 'New password is required',
    'string.pattern.base':
      'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
  }),
  confirmPassword: Joi.string().required().valid(Joi.ref('newPassword')).messages({
    'any.only': 'Passwords do not match',
    'string.empty': 'Confirm password is required',
  }),
});

// Type definitions
export type SignupInput = {
  firstName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  termsAccepted: boolean;
};

export type SigninInput = {
  email: string;
  password: string;
};

export type VerifyEmailInput = {
  email: string;
  otp: string;
};

export type ResendOtpInput = {
  email: string;
};

export type ForgotPasswordInput = {
  email: string;
};

export type VerifyOtpInput = {
  email: string;
  otp: string;
};

export type ResetPasswordInput = {
  newPassword: string;
  confirmPassword: string;
};

export type RefreshTokenInput = {
  refreshToken: string;
};

export type ChangePasswordInput = {
  oldPassword?: string;
  newPassword: string;
  confirmPassword: string;
};
