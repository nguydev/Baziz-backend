import mongoose, { Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'landlord' | 'tenant' | 'admin' | 'support_agent';
export type AuthProvider = 'email' | 'google' | 'facebook';

export interface IRefreshToken {
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface INotificationPreferences {
  paymentReceived: boolean;
  paymentDue: boolean;
  leaseRenewal: boolean;
  leaseExpired: boolean;
  maintenance: boolean;
  insuranceRenewal: boolean;
  documentUploads: boolean;
  taskDeadlines: boolean;
  tenantMessages: boolean;
  marketplaceInquiries: boolean;
  pushNotifications: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

export interface IEmergencyContact {
  name: string;
  phone: string;
  relationship?: string;
}

export interface IUser {
  firstName: string;
  email: string;
  password: string;
  role: UserRole;
  authProvider: AuthProvider;
  avatar: string | null;
  phone: string | null;
  companyName: string | null;
  address: string | null;
  isActive: boolean;
  isVerified: boolean;
  isProfileCompleted: boolean;
  biometricEnabled: boolean;
  twoFactorEnabled: boolean;
  autoBackupEnabled: boolean;
  locationServicesEnabled: boolean;
  latitude?: number | null;
  longitude?: number | null;
  notificationPreferences: INotificationPreferences;
  isOnline: boolean;
  lastSeenAt?: Date | null;
  otp?: string | null;
  otpExpiry?: Date | null;
  refreshTokens: IRefreshToken[];
  language: string;
  theme: string;
  lastLogin?: Date | null;
  loginAttempts: number;
  lockUntil?: Date | null;
  emergencyContact?: IEmergencyContact | null;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  isAccountLocked(): boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserModel extends Model<IUserDocument> {
  findByEmail(email: string): Promise<IUserDocument | null>;
}

const refreshTokenSchema = new mongoose.Schema<IRefreshToken>(
  {
    token: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const notificationPreferencesSchema = new mongoose.Schema<INotificationPreferences>(
  {
    paymentReceived: { type: Boolean, default: true },
    paymentDue: { type: Boolean, default: true },
    leaseRenewal: { type: Boolean, default: true },
    leaseExpired: { type: Boolean, default: true },
    maintenance: { type: Boolean, default: true },
    insuranceRenewal: { type: Boolean, default: true },
    documentUploads: { type: Boolean, default: true },
    taskDeadlines: { type: Boolean, default: true },
    tenantMessages: { type: Boolean, default: true },
    marketplaceInquiries: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema<IUserDocument, IUserModel>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['landlord', 'tenant', 'admin', 'support_agent'],
        message: 'Role must be landlord, tenant, admin, or support_agent',
      },
      default: 'tenant',
      index: true,
    },
    authProvider: {
      type: String,
      enum: {
        values: ['email', 'google', 'facebook'],
        message: 'Auth provider must be email, google, or facebook',
      },
      default: 'email',
    },
    avatar: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    companyName: {
      type: String,
      trim: true,
      maxlength: [150, 'Company name cannot exceed 150 characters'],
      default: null,
    },
    address: {
      type: String,
      trim: true,
      maxlength: [300, 'Address cannot exceed 300 characters'],
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    isProfileCompleted: {
      type: Boolean,
      default: false,
    },
    biometricEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    autoBackupEnabled: {
      type: Boolean,
      default: false,
    },
    locationServicesEnabled: { type: Boolean, default: false },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    emergencyContact: {
      name: { type: String },
      phone: { type: String },
      relationship: { type: String },
    },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({}),
    },
    language: {
      type: String,
      default: 'en',
    },
    theme: {
      type: String,
      default: 'light',
    },
    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
    otp: {
      type: String,
      select: false,
      default: null,
    },
    otpExpiry: {
      type: Date,
      select: false,
      default: null,
    },
    refreshTokens: {
      type: [refreshTokenSchema],
      select: false,
      default: [],
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const sanitized = ret as Record<string, unknown>;
        delete sanitized.password;
        delete sanitized.otp;
        delete sanitized.otpExpiry;
        delete sanitized.refreshTokens;
        delete sanitized.loginAttempts;
        delete sanitized.lockUntil;
        delete sanitized.__v;
        return sanitized;
      },
    },
  }
);

// Indexes for performance
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ role: 1, isVerified: 1 });
userSchema.index({ createdAt: -1 });

// Pre-save middleware: hash password
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) {
    next(err as Error);
  }
});

// Instance methods
userSchema.methods.comparePassword = async function comparePassword(
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isAccountLocked = function isAccountLocked(): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// Static methods
userSchema.statics.findByEmail = async function findByEmail(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Cascade delete middleware for related LeaseAgreements when User is deleted
userSchema.post(['deleteOne', 'findOneAndDelete'], async function (doc, next) {
  if (doc) {
    try {
      const LeaseAgreement = mongoose.model('LeaseAgreement');
      if (doc.role === 'tenant') {
        // Delete any lease agreement associated with this tenant
        await LeaseAgreement.deleteMany({
          $or: [
            { tenantId: doc._id },
            { tenantEmail: doc.email.toLowerCase() }
          ]
        });
      } else if (doc.role === 'landlord') {
        // Delete leases owned by the landlord
        await LeaseAgreement.deleteMany({ landlordId: doc._id });
      }
    } catch (err) {
      console.error('Error during cascade delete of lease agreements:', err);
    }
  }
  next();
});


const User = mongoose.model<IUserDocument, IUserModel>('User', userSchema);

export default User;
