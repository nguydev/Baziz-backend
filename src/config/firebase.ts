/**
 * Firebase Admin SDK — Storage signed URLs for chat attachments
 */

import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import logger from './logger';

let initialized = false;

const getFirebaseCredentials = (): { projectId: string; credentials: ServiceAccount } | null => {
  const projectId = process.env.FCM_PROJECT_ID;
  const jsonRaw = process.env.FCM_SERVICE_ACCOUNT_JSON;

  if (!projectId || !jsonRaw) return null;

  try {
    const credentials = JSON.parse(jsonRaw) as ServiceAccount;
    return { projectId, credentials };
  } catch {
    logger.error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON');
    return null;
  }
};

export const initFirebase = (): boolean => {
  if (initialized) return true;

  const config = getFirebaseCredentials();
  if (!config) return false;

  try {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert(config.credentials),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${config.projectId}.appspot.com`,
      });
    }
    initialized = true;
    logger.info('Firebase Admin initialized for chat storage');
    return true;
  } catch (err) {
    logger.warn(
      `Firebase Admin init failed: ${err instanceof Error ? err.message : 'Unknown'}`
    );
    return false;
  }
};

export const isFirebaseStorageConfigured = (): boolean => {
  if (!initialized) initFirebase();
  return initialized;
};

export const generateSignedUploadUrl = async (
  storagePath: string,
  mimeType: string,
  expiresInMinutes = 15
): Promise<string | null> => {
  if (!isFirebaseStorageConfigured()) return null;

  try {
    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
      contentType: mimeType,
    });
    return url;
  } catch (err) {
    logger.error(
      `Failed to generate signed upload URL: ${err instanceof Error ? err.message : 'Unknown'}`
    );
    return null;
  }
};

export const getPublicDownloadUrl = (storagePath: string): string => {
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FCM_PROJECT_ID}.appspot.com`;
  const encoded = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encoded}?alt=media`;
};
