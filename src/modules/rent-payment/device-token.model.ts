/**
 * FCM Device Tokens
 */

import mongoose, { Document } from 'mongoose';

export interface IDeviceToken {
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: 'ios' | 'android' | 'web';
  isActive: boolean;
}

export interface IDeviceTokenDocument extends IDeviceToken, Document {}

const deviceTokenSchema = new mongoose.Schema<IDeviceTokenDocument>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const DeviceToken = mongoose.model<IDeviceTokenDocument>('DeviceToken', deviceTokenSchema);

export default DeviceToken;
