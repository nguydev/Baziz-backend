import type { Request } from 'express';
import { getFileUrl } from '../../middlewares/upload.middleware';
import type { ImagePayload } from './marketplace.types';

const parseBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
};

const parseNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

const parseJsonField = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

export const parseMarketplaceFormBody = (
  body: Record<string, unknown>
): Record<string, unknown> => {
  const parsed: Record<string, unknown> = { ...body };

  for (const field of ['address', 'specs', 'financials', 'image']) {
    if (parsed[field] !== undefined) {
      parsed[field] = parseJsonField(parsed[field]);
    }
  }

  if (parsed.price !== undefined) parsed.price = parseNumber(parsed.price);
  if (parsed.yield !== undefined) parsed.yield = parseNumber(parsed.yield);

  const isNegotiable = parseBoolean(parsed.isNegotiable);
  if (isNegotiable !== undefined) parsed.isNegotiable = isNegotiable;

  const valuationRequested = parseBoolean(parsed.valuationRequested);
  if (valuationRequested !== undefined) parsed.valuationRequested = valuationRequested;

  if (parsed.image === '') delete parsed.image;

  return parsed;
};

export const resolveImageFromRequest = (req: Request): ImagePayload | undefined => {
  if (req.file) {
    const url = getFileUrl(req, req.file);
    const storagePath = req.file.path
      .replace(process.cwd(), '')
      .replace(/\\/g, '/')
      .replace(/^\//, '');
    return { url, storagePath };
  }

  const image = req.body?.image;
  if (!image) return undefined;

  if (typeof image === 'string') {
    try {
      const parsed = JSON.parse(image) as ImagePayload;
      if (parsed?.url && parsed?.storagePath) return parsed;
    } catch {
      return undefined;
    }
  }

  if (typeof image === 'object' && image.url && image.storagePath) {
    return image as ImagePayload;
  }

  return undefined;
};

export const attachImageToBody = (req: Request): void => {
  const image = resolveImageFromRequest(req);
  if (image) {
    req.body = { ...req.body, image };
  } else if (req.body?.image !== undefined) {
    const { image: _removed, ...rest } = req.body as Record<string, unknown>;
    req.body = rest;
  }
};
