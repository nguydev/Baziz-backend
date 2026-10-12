import Joi from 'joi';
import type { UserRole } from './user.model';

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).messages({
    'string.min': 'Full name must be at least 2 characters',
    'string.max': 'Full name cannot exceed 50 characters',
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^[+\d\s\-()]{7,20}$/)
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Invalid phone number format. Use digits, spaces, +, -, or ()',
    }),
  companyName: Joi.string().trim().max(150).allow(null, '').messages({
    'string.max': 'Company name cannot exceed 150 characters',
  }),
  address: Joi.string().trim().max(300).allow(null, '').messages({
    'string.max': 'Address cannot exceed 300 characters',
  }),
  emergencyContact: Joi.object({
    name: Joi.string().trim().required(),
    phone: Joi.string().trim().required(),
    relationship: Joi.string().trim().optional().allow(null, ''),
  }).optional().allow(null),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

export const updateSettingsSchema = Joi.object({
  biometricEnabled: Joi.boolean().optional(),
  twoFactorEnabled: Joi.boolean().optional(),
  autoBackupEnabled: Joi.boolean().optional(),
  locationServicesEnabled: Joi.boolean().optional(),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  language: Joi.string().valid('en', 'es', 'fr').optional(),
  theme: Joi.string().valid('light', 'dark').optional(),
}).min(1).messages({
  'object.min': 'At least one setting must be provided for update',
});

export const updateNotificationPreferencesSchema = Joi.object({
  paymentReceived: Joi.boolean().optional(),
  paymentDue: Joi.boolean().optional(),
  leaseRenewal: Joi.boolean().optional(),
  leaseExpired: Joi.boolean().optional(),
  maintenance: Joi.boolean().optional(),
  insuranceRenewal: Joi.boolean().optional(),
  documentUploads: Joi.boolean().optional(),
  taskDeadlines: Joi.boolean().optional(),
  tenantMessages: Joi.boolean().optional(),
  marketplaceInquiries: Joi.boolean().optional(),
  pushNotifications: Joi.boolean().optional(),
  emailNotifications: Joi.boolean().optional(),
  smsNotifications: Joi.boolean().optional(),
}).min(1).messages({
  'object.min': 'At least one notification preference must be provided for update',
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'string.empty': 'Current password is required',
  }),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base':
        'Password must contain uppercase, lowercase, number, and special character',
    }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Passwords do not match',
    'string.empty': 'Confirm password is required',
  }),
});

export const listUsersSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().allow('').default(''),
  role: Joi.string().valid('landlord', 'tenant', 'admin').optional(),
  isVerified: Joi.boolean().optional(),
});

export type SignupInput = {
  firstName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  termsAccepted: boolean;
};

export type UpdateProfileInput = {
  firstName?: string;
  phone?: string | null;
  companyName?: string | null;
  address?: string | null;
};

export type UpdateSettingsInput = {
  biometricEnabled?: boolean;
  twoFactorEnabled?: boolean;
  autoBackupEnabled?: boolean;
  locationServicesEnabled?: boolean;
  latitude?: number;
  longitude?: number;
};

export type UpdateNotificationPreferencesInput = {
  paymentReceived?: boolean;
  paymentDue?: boolean;
  leaseRenewal?: boolean;
  leaseExpired?: boolean;
  maintenance?: boolean;
  insuranceRenewal?: boolean;
  documentUploads?: boolean;
  taskDeadlines?: boolean;
  tenantMessages?: boolean;
  marketplaceInquiries?: boolean;
  pushNotifications?: boolean;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type ListUsersQuery = {
  page: number;
  limit: number;
  search: string;
  role?: UserRole;
  isVerified?: boolean;
};
