/**
 * Chat Media Service — Firebase Storage signed URLs + local fallback
 */

import path from 'path';
import { randomUUID } from 'crypto';
import {
  generateSignedUploadUrl,
  getPublicDownloadUrl,
  isFirebaseStorageConfigured,
} from '../../config/firebase';
import { ensureParticipant } from './chat.helpers';
import ApiError from '../../utils/ApiError';
import type { AuthUser, MediaUploadUrlInput } from './chat.types';

const MEDIA_LIMITS: Record<string, { maxBytes: number; mimeTypes: string[] }> = {
  image: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  },
  audio: {
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/ogg', 'audio/x-m4a'],
  },
  file: {
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
};

const getMediaCategory = (mimeType: string): 'image' | 'audio' | 'file' => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
};

const validateMedia = (mimeType: string, sizeBytes: number): void => {
  const category = getMediaCategory(mimeType);
  const limits = MEDIA_LIMITS[category];

  if (!limits.mimeTypes.includes(mimeType)) {
    throw ApiError.badRequest(`MIME type ${mimeType} is not allowed for ${category} uploads`);
  }

  if (sizeBytes > limits.maxBytes) {
    throw ApiError.badRequest(
      `File exceeds maximum size of ${limits.maxBytes / (1024 * 1024)}MB for ${category}`
    );
  }
};

const generateStoragePath = (
  conversationId: string,
  fileName: string
): string => {
  const ext = path.extname(fileName).toLowerCase() || '.bin';
  const uniqueId = randomUUID();
  return `chat/${conversationId}/${uniqueId}${ext}`;
};

export const createUploadUrl = async (
  user: AuthUser,
  input: MediaUploadUrlInput
) => {
  await ensureParticipant(input.conversationId, user._id.toString());
  validateMedia(input.mimeType, input.sizeBytes);

  const storagePath = generateStoragePath(input.conversationId, input.fileName);

  if (isFirebaseStorageConfigured()) {
    const uploadUrl = await generateSignedUploadUrl(storagePath, input.mimeType);
    if (!uploadUrl) {
      throw ApiError.internal('Failed to generate upload URL');
    }

    return {
      uploadUrl,
      storagePath,
      downloadUrl: getPublicDownloadUrl(storagePath),
      provider: 'firebase' as const,
      expiresInMinutes: 15,
    };
  }

  return {
    uploadUrl: null,
    storagePath,
    downloadUrl: `/uploads/chat/${storagePath.split('/').pop()}`,
    provider: 'local' as const,
    expiresInMinutes: null,
    message: 'Use POST /chat/media/upload for local file upload when Firebase is not configured',
  };
};
