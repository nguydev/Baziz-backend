import { Request, Response } from 'express';
import { propertyAlertService } from './property-alert.service';

export const createConfig = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const config = await propertyAlertService.createConfig(userId, req.body);
    res.status(201).json({ success: true, data: config });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getConfigs = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const configs = await propertyAlertService.getConfigsByUser(userId);
    res.status(200).json({ success: true, data: configs });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const toggleConfig = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const config = await propertyAlertService.toggleConfigStatus(userId, id);
    res.status(200).json({ success: true, data: config });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const notifications = await propertyAlertService.getNotificationsByUser(userId);
    res.status(200).json({ success: true, data: notifications });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    await propertyAlertService.deleteNotification(userId, id);
    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const notification = await propertyAlertService.markAsRead(userId, id);
    res.status(200).json({ success: true, data: notification });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const sendLiveNotification = async (req: Request, res: Response) => {
  try {
    const senderId = req.user!.id;
    const { tenantId, propertyId, title, description } = req.body;
    
    if (!tenantId || !propertyId || !title || !description) {
      throw new Error('tenantId, propertyId, title, and description are required');
    }

    const notification = await propertyAlertService.sendLiveNotification(senderId, {
      tenantId,
      propertyId,
      title,
      description,
    });
    
    res.status(201).json({ success: true, data: notification });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
