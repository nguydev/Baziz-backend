import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import env from '../config/env';
import logger from '../config/logger';
import type { EmailPayload } from '../types/api.types';

let transporter: Transporter | null = null;

const getTransporter = (): Transporter => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  return transporter;
};

const sendEmail = async ({ to, subject, html, text }: EmailPayload) => {
  if (!env.SMTP_USER) {
    logger.warn(`Email not sent (SMTP not configured). To: ${to}, Subject: ${subject}`);
    return { messageId: 'mock-id', preview: true as const };
  }

  try {
    const info = await getTransporter().sendMail({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    logger.info(`Email sent successfully: ${info.messageId} → ${to}`);
    return info;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error(`Failed to send email to ${to}: ${message}`);
    throw err;
  }
};

/**
 * Send OTP email
 * @param email - Recipient email
 * @param name - Recipient name
 * @param otp - One-time password
 * @param type - Email type (signup, password-reset)
 */
export const sendOTPEmail = async (
  email: string,
  name: string,
  otp: string,
  type: 'signup' | 'password-reset' = 'signup'
): Promise<void> => {
  const subject = type === 'signup' ? 'Verify Your Email - B Aziz' : 'Reset Your Password - B Aziz';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .otp-box { background-color: #fff; border: 2px solid #007bff; padding: 15px; text-align: center; margin: 20px 0; border-radius: 5px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; }
          .footer { background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 5px 5px; }
          .warning { color: #d9534f; font-size: 12px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>B Aziz</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>${type === 'signup' ? 'Thank you for signing up! Please verify your email address to complete your registration.' : 'We received a request to reset your password. Use the OTP below to proceed.'}</p>
            <div class="otp-box">
              <p>Your One-Time Password (OTP):</p>
              <div class="otp-code">${otp}</div>
            </div>
            <p>This OTP will expire in 15 minutes.</p>
            <p class="warning">⚠️ Never share this OTP with anyone. B Aziz staff will never ask for your OTP.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 B Aziz. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  if (env.NODE_ENV === 'development') {
    console.log(`[DEV OTP] ${type} OTP for ${email}: ${otp}`);
  }

  await sendEmail({
    to: email,
    subject,
    html,
    text: `Your OTP is: ${otp}. This will expire in 15 minutes.`,
  });
};

/**
 * Send Tenant Invitation Email
 */
export const sendTenantInvitationEmail = async (
  email: string,
  name: string,
  leaseDetails: {
    leaseId: string;
    propertyName: string;
    unitNumber: string;
    rentAmount: number;
    leaseStartDate: Date;
    leaseEndDate: Date;
    invitationExpiresAt: Date;
  }
): Promise<void> => {
  const signupLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/tenant/signup?leaseId=${leaseDetails.leaseId}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #007bff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
          .lease-details { background-color: #fff; border-left: 4px solid #007bff; padding: 15px; margin: 20px 0; }
          .lease-details h3 { margin-top: 0; color: #007bff; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .cta-button { 
            background-color: #007bff; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            display: inline-block; 
            margin: 20px 0;
          }
          .expiry-warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 5px; color: #856404; }
          .footer { background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 5px 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>B Aziz - Tenant Invitation</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>You have been invited to become a tenant for a property on B Aziz. Please review the lease details below and accept the invitation to create your account.</p>
            
            <div class="lease-details">
              <h3>Lease Details</h3>
              <div class="detail-row">
                <span><strong>Property:</strong></span>
                <span>${leaseDetails.propertyName}</span>
              </div>
              <div class="detail-row">
                <span><strong>Unit:</strong></span>
                <span>${leaseDetails.unitNumber}</span>
              </div>
              <div class="detail-row">
                <span><strong>Monthly Rent:</strong></span>
                <span>৳${leaseDetails.rentAmount.toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span><strong>Lease Period:</strong></span>
                <span>${new Date(leaseDetails.leaseStartDate).toLocaleDateString()} - ${new Date(leaseDetails.leaseEndDate).toLocaleDateString()}</span>
              </div>
            </div>

            <p style="text-align: center;">
              <a href="${signupLink}" class="cta-button">Accept Invitation & Sign Up</a>
            </p>

            <div class="expiry-warning">
              ⏰ <strong>Important:</strong> This invitation expires on <strong>${new Date(leaseDetails.invitationExpiresAt).toLocaleDateString()}</strong>. 
              After this date, you'll need to ask your landlord to send a new invitation.
            </div>

            <p><strong>What happens next:</strong></p>
            <ol>
              <li>Click the button above to accept the invitation</li>
              <li>Create your tenant account with your credentials</li>
              <li>Verify your email address with the OTP</li>
              <li>Access your dashboard and manage your lease</li>
            </ol>

            <p style="margin-top: 30px;">If you have any questions, please contact your landlord directly.</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 B Aziz. All rights reserved.</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Tenant Invitation for ${leaseDetails.propertyName}, Unit ${leaseDetails.unitNumber}`,
    html,
    text: `You have been invited to become a tenant. Please visit the link to accept the invitation and create your account. This invitation expires on ${new Date(leaseDetails.invitationExpiresAt).toLocaleDateString()}.`,
  });
};

export default sendEmail;

export const sendTeamInviteEmail = async (
  email: string,
  details: {
    orgName: string;
    roleName: string;
    inviterName: string;
    token: string;
    expiresAt: Date;
  }
): Promise<void> => {
  const acceptLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite?token=${details.token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>B Aziz Team Invitation</h2>
        <p><strong>${details.inviterName}</strong> invited you to join <strong>${details.orgName}</strong> as <strong>${details.roleName}</strong>.</p>
        <p><a href="${acceptLink}" style="background:#007bff;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;">Accept Invitation</a></p>
        <p>Or use token: <code>${details.token}</code></p>
        <p>Expires: ${details.expiresAt.toLocaleDateString()}</p>
      </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Team invitation — ${details.orgName}`,
    html,
    text: `You were invited to ${details.orgName} as ${details.roleName}. Accept: ${acceptLink}`,
  });
};
