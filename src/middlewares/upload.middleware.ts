/**
 * Upload Middleware
 * Handles multipart/form-data file uploads using Multer
 * Stores files on local disk under /uploads/<category>/
 */

import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import ApiError from '../utils/ApiError';

// ─── Allowed MIME types ────────────────────────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
];
const MAX_FILE_SIZE_MB = 5;
const MAX_DOCUMENT_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_DOCUMENT_SIZE_BYTES = MAX_DOCUMENT_SIZE_MB * 1024 * 1024;

// ─── Ensure upload directory exists ───────────────────────────────────────────
const ensureDir = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// ─── Dynamic Disk Storage Factory ─────────────────────────────────────────────
const createDiskStorage = (subFolder: string) =>
  multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb) => {
      const uploadPath = path.join(process.cwd(), 'uploads', subFolder);
      ensureDir(uploadPath);
      cb(null, uploadPath);
    },
    filename: (_req: Request, file: Express.Multer.File, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${subFolder}-${uniqueSuffix}${ext}`);
    },
  });

// ─── Image File Filter ─────────────────────────────────────────────────────────
const imageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        400,
        `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      ) as unknown as null,
      false
    );
  }
};

// ─── Property Image Upload ─────────────────────────────────────────────────────
export const uploadPropertyImage = multer({
  storage: createDiskStorage('properties'),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

// ─── Avatar Upload (for future use) ───────────────────────────────────────────
export const uploadAvatar = multer({
  storage: createDiskStorage('avatars'),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

// ─── Maintenance Request Photos Upload (up to 5 images) ───────────────────────
export const uploadMaintenancePhotos = multer({
  storage: createDiskStorage('maintenance'),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 5 MB per file
    files: 5,                       // max 5 photos per request
  },
});

// ─── Property Document Upload (PDF, DOCX, JPG, PNG — max 10MB) ─────────────────
const documentFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new ApiError(
        400,
        'Invalid file type. Allowed types: PDF, DOCX, JPG, PNG'
      ) as unknown as null,
      false
    );
  }
};

export const uploadPropertyDocument = multer({
  storage: createDiskStorage('documents'),
  fileFilter: documentFileFilter,
  limits: {
    fileSize: MAX_DOCUMENT_SIZE_BYTES,
    files: 1,
  },
});

// ─── Marketplace Image Upload (max 10MB — listings & JV) ─────────────────────
export const uploadMarketplaceImage = multer({
  storage: createDiskStorage('marketplace'),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

// ─── Helper: Get public URL from uploaded file ────────────────────────────────
export const getFileUrl = (req: Request, file: Express.Multer.File): string => {
  const protocol = req.protocol;
  const host = req.get('host') ?? 'localhost:5000';
  const relativePath = file.path
    .replace(process.cwd(), '')
    .replace(/\\/g, '/');
  return `${protocol}://${host}${relativePath}`;
};
