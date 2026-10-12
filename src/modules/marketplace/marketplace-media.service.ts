import path from 'path';
import { randomUUID } from 'crypto';
import {
  generateSignedUploadUrl,
  getPublicDownloadUrl,
  isFirebaseStorageConfigured,
} from '../../config/firebase';
import ApiError from '../../utils/ApiError';
import type { AuthUser, MediaUploadInput } from './marketplace.types';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

const generateStoragePath = (
  userId: string,
  context: 'listing' | 'jv',
  fileName: string
): string => {
  const ext = path.extname(fileName).toLowerCase() || '.jpg';
  const folder = context === 'jv' ? 'jv' : 'listings';
  return `${folder}/${userId}/${randomUUID()}${ext}`;
};

export const createMediaUploadUrl = async (user: AuthUser, input: MediaUploadInput) => {
  if (!ALLOWED_MIME.includes(input.mimeType)) {
    throw ApiError.badRequest('Only JPEG, PNG, and WebP images are allowed');
  }

  if (input.sizeBytes > MAX_BYTES) {
    throw ApiError.badRequest('Image exceeds maximum size of 10MB');
  }

  const storagePath = generateStoragePath(user._id.toString(), input.context, input.fileName);

  if (isFirebaseStorageConfigured()) {
    const uploadUrl = await generateSignedUploadUrl(storagePath, input.mimeType);
    if (!uploadUrl) {
      throw ApiError.internal('Failed to generate upload URL');
    }

    return {
      uploadUrl,
      storagePath,
      publicUrl: getPublicDownloadUrl(storagePath),
      provider: 'firebase' as const,
      expiresInMinutes: 15,
    };
  }

  throw ApiError.internal(
    'Firebase Storage is not configured. Set FCM_PROJECT_ID and FCM_SERVICE_ACCOUNT_JSON.'
  );
};
