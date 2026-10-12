/**
 * Email Testing Utility
 * Test email functionality with different providers
 */

import { sendOTPEmail } from './sendEmail';
import logger from '../config/logger';

/**
 * Test OTP email sending
 * @param email Test email address
 * @param name Test recipient name
 */
export const testOTPEmail = async (email: string, name: string): Promise<void> => {
  try {
    logger.info(`Testing OTP email to: ${email}`);
    
    // Test signup OTP
    await sendOTPEmail(email, name, '123456', 'signup');
    logger.info('✅ Signup OTP email sent successfully');
    
    // Test password reset OTP
    await sendOTPEmail(email, name, '654321', 'password-reset');
    logger.info('✅ Password reset OTP email sent successfully');
    
  } catch (error) {
    logger.error('❌ Email test failed:', error);
    throw error;
  }
};

/**
 * Validate email configuration
 */
export const validateEmailConfig = (): boolean => {
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'EMAIL_FROM'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error(`❌ Missing email configuration: ${missingVars.join(', ')}`);
    return false;
  }
  
  logger.info('✅ Email configuration is complete');
  return true;
};