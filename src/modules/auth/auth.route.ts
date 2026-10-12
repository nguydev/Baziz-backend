/**
 * Auth Routes
 * Defines all authentication endpoints
 */

import { Router } from 'express';
import * as authController from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { apiLimiter } from '../../middlewares/rateLimiter';

const router = Router();

/**
 * Public routes (no authentication required)
 */

// Sign up
router.post('/signup', apiLimiter, authController.signup);

// Sign in
router.post('/signin', apiLimiter, authController.signin);

// Verify email with OTP
router.post('/verify-email', apiLimiter, authController.verifyEmail);

// Resend OTP
router.post('/resend-otp', apiLimiter, authController.resendOTP);

// Forgot password
router.post('/forgot-password', apiLimiter, authController.forgotPassword);

// Verify OTP for password reset
router.post('/verify-otp', apiLimiter, authController.verifyOTP);

// Refresh token
router.post('/refresh-token', apiLimiter, authController.refreshToken);

/**
 * Protected routes (authentication required)
 */

// Reset password (requires valid access token from OTP verification)
router.post('/reset-password', authMiddleware, authController.resetPassword);

// Change password (requires valid access token)
router.post('/change-password', authMiddleware, authController.changePassword);

// Logout
router.post('/logout', authMiddleware, authController.logout);

// Get current user
router.get('/me', authMiddleware, authController.getCurrentUser);

export default router;
