/**
 * OTP Utility Functions
 * Handles generation and validation of One-Time Passwords
 */

/**
 * Generate a 6-digit OTP
 * @returns 6-digit OTP as string
 */
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Calculate OTP expiry time (15 minutes from now)
 * @returns Date object representing expiry time
 */
export const getOTPExpiry = (): Date => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 15);
  return expiry;
};

/**
 * Check if OTP has expired
 * @param otpExpiry - OTP expiry date
 * @returns true if expired, false otherwise
 */
export const isOTPExpired = (otpExpiry: Date | null | undefined): boolean => {
  if (!otpExpiry) return true;
  return new Date() > otpExpiry;
};
