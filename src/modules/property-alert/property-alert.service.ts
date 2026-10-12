import { AlertConfig, AlertNotification, IAlertConfig, IAlertNotification } from './property-alert.model';
import mongoose from 'mongoose';

export class PropertyAlertService {
  // --- Alert Configs ---

  async createConfig(userId: string, data: Partial<IAlertConfig>) {
    const config = await AlertConfig.create({
      ...data,
      userId: new mongoose.Types.ObjectId(userId),
    });
    return config;
  }

  async getConfigsByUser(userId: string) {
    return AlertConfig.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 });
  }

  async toggleConfigStatus(userId: string, configId: string) {
    const config = await AlertConfig.findOne({ _id: configId, userId: new mongoose.Types.ObjectId(userId) });
    if (!config) throw new Error('Alert configuration not found');
    
    config.isActive = !config.isActive;
    await config.save();
    return config;
  }

  // --- Alert Notifications ---

  async createNotification(data: Partial<IAlertNotification>) {
    const notification = await AlertNotification.create(data);
    return notification;
  }

  async getNotificationsByUser(userId: string) {
    return AlertNotification.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({ createdAt: -1 });
  }

  async deleteNotification(userId: string, notificationId: string) {
    const result = await AlertNotification.deleteOne({ _id: notificationId, userId: new mongoose.Types.ObjectId(userId) });
    if (result.deletedCount === 0) {
      throw new Error('Notification not found');
    }
    return true;
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await AlertNotification.findOneAndUpdate(
      { _id: notificationId, userId: new mongoose.Types.ObjectId(userId) },
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      throw new Error('Notification not found');
    }
    return notification;
  }

  async sendLiveNotification(senderId: string, data: { tenantId: string; propertyId: string; title: string; description: string }) {
    const notification = await AlertNotification.create({
      userId: new mongoose.Types.ObjectId(data.tenantId),
      senderId: new mongoose.Types.ObjectId(senderId),
      propertyId: new mongoose.Types.ObjectId(data.propertyId),
      title: data.title,
      description: data.description,
      iconName: 'Bell',
      tone: 'info',
    });

    // Lazy load socket emission to avoid circular dependency
    const { emitChatEvent } = require('../chat/chat.socket');
    emitChatEvent('notification:new', notification.toJSON(), `user:${data.tenantId}`);

    return notification;
  }
}

export const propertyAlertService = new PropertyAlertService();
