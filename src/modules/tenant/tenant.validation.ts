import Joi from 'joi';
import type { PaymentFrequency, LeaseStatus } from './tenant.model';

/**
 * Invite Tenant Schema
 */
export const inviteTenantSchema = Joi.object({
  propertyId: Joi.string().required().messages({
    'string.empty': 'Property ID is required',
  }),
  unitId: Joi.string().required().messages({
    'string.empty': 'Unit ID is required',
  }),
  tenantFullName: Joi.string().trim().required().max(100).messages({
    'string.empty': 'Tenant full name is required',
    'string.max': 'Name cannot exceed 100 characters',
  }),
  tenantEmail: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
  }),
  tenantPhone: Joi.string().trim().required().max(20).messages({
    'string.empty': 'Phone number is required',
    'string.max': 'Phone cannot exceed 20 characters',
  }),
  rentAmount: Joi.number().required().min(1).messages({
    'number.base': 'Rent amount must be a number',
    'number.min': 'Rent amount must be greater than 0',
  }),
  securityDeposit: Joi.number().required().min(0).messages({
    'number.base': 'Security deposit must be a number',
    'number.min': 'Security deposit cannot be negative',
  }),
  paymentFrequency: Joi.string()
    .valid('monthly', 'quarterly', 'yearly')
    .required()
    .messages({
      'any.only': 'Payment frequency must be monthly, quarterly, or yearly',
    }),
  paymentDueDay: Joi.number().required().min(1).max(31).messages({
    'number.base': 'Payment due day must be a number',
    'number.min': 'Payment due day must be between 1 and 31',
    'number.max': 'Payment due day must be between 1 and 31',
  }),
  leaseStartDate: Joi.date().required().messages({
    'date.base': 'Lease start date must be a valid date',
  }),
  leaseEndDate: Joi.date().required().min(Joi.ref('leaseStartDate')).messages({
    'date.base': 'Lease end date must be a valid date',
    'date.min': 'Lease end date must be after start date',
  }),
  lastRentReviewDate: Joi.date().optional().allow(null).messages({
    'date.base': 'Last rent review date must be a valid date',
  }),
  numberOfParkingSpots: Joi.number().required().min(0).messages({
    'number.base': 'Number of parking spots must be a number',
    'number.min': 'Parking spots cannot be negative',
  }),
  parkingBayNumbers: Joi.array().items(Joi.string()).optional().default([]).messages({
    'array.base': 'Parking bay numbers must be an array',
  }),
  parkingNotes: Joi.string().optional().allow('').messages({
    'string.base': 'Parking notes must be a string',
  }),
});

/**
 * Accept Lease Invitation Schema
 */
export const acceptLeaseSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'Please provide a valid email address',
    'string.empty': 'Email is required',
  }),
  firstName: Joi.string().trim().required().max(50).messages({
    'string.empty': 'First name is required',
    'string.max': 'First name cannot exceed 50 characters',
  }),
  lastName: Joi.string().trim().required().max(50).messages({
    'string.empty': 'Last name is required',
    'string.max': 'Last name cannot exceed 50 characters',
  }),
  password: Joi.string()
    .required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .messages({
      'string.empty': 'Password is required',
      'string.pattern.base':
        'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
    }),
  confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
    'any.only': 'Passwords do not match',
    'string.empty': 'Confirm password is required',
  }),
  phoneNumber: Joi.string().trim().required().max(20).messages({
    'string.empty': 'Phone number is required',
    'string.max': 'Phone cannot exceed 20 characters',
  }),
  termsAccepted: Joi.boolean().valid(true).required().messages({
    'any.only': 'You must accept the terms and conditions',
  }),
});

/**
 * Resend Invitation Schema
 */
export const resendInvitationSchema = Joi.object({});

/**
 * Update Parking Bays Schema
 */
export const updateParkingBaysSchema = Joi.object({
  action: Joi.string().valid('add', 'remove', 'update').required().messages({
    'any.only': 'Action must be add, remove, or update',
  }),
  parkingBays: Joi.array()
    .items(
      Joi.object({
        bayNumber: Joi.string().required().messages({
          'string.empty': 'Bay number is required',
        }),
        notes: Joi.string().optional().allow(''),
      })
    )
    .required()
    .messages({
      'array.base': 'Parking bays must be an array',
    }),
});

/**
 * Get Tenants Query Schema
 */
export const getTenantsSchema = Joi.object({
  propertyId: Joi.string().optional(),
  status: Joi.string().valid('pending_acceptance', 'accepted', 'active', 'ended').optional(),
  limit: Joi.number().optional().default(10).min(1).max(100),
  skip: Joi.number().optional().default(0).min(0),
});

/**
 * Type Definitions
 */
export type InviteTenantInput = {
  propertyId: string;
  unitId: string;
  tenantFullName: string;
  tenantEmail: string;
  tenantPhone: string;
  rentAmount: number;
  securityDeposit: number;
  paymentFrequency: PaymentFrequency;
  paymentDueDay: number;
  leaseStartDate: Date;
  leaseEndDate: Date;
  lastRentReviewDate?: Date;
  numberOfParkingSpots: number;
  parkingBayNumbers?: string[];
  parkingNotes?: string;
};

export type AcceptLeaseInput = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  phoneNumber: string;
  termsAccepted: boolean;
};

export type UpdateParkingBaysInput = {
  action: 'add' | 'remove' | 'update';
  parkingBays: Array<{
    bayNumber: string;
    notes?: string;
  }>;
};

export type GetTenantsQuery = {
  propertyId?: string;
  status?: LeaseStatus;
  limit: number;
  skip: number;
};
