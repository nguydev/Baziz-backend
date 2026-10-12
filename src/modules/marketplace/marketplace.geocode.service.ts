import { isRedisEnabled, isRedisReady, getRedisClient } from '../../config/redis';
import logger from '../../config/logger';

const CACHE_PREFIX = 'marketplace:geocode:';
const CACHE_TTL_SECONDS = 86_400; // 24 hours

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

const memoryCache = new Map<string, { value: GeoCoordinates; expiresAt: number }>();

const normalizeCacheKey = (location: string): string =>
  location.trim().toLowerCase().replace(/\s+/g, ' ');

const readMemoryCache = (key: string): GeoCoordinates | null => {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
};

const writeMemoryCache = (key: string, coords: GeoCoordinates): void => {
  memoryCache.set(key, { value: coords, expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000 });
};

const readRedisCache = async (key: string): Promise<GeoCoordinates | null> => {
  if (!isRedisEnabled() || !isRedisReady()) return null;
  try {
    const raw = await getRedisClient().get(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeoCoordinates;
    if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
      return parsed;
    }
  } catch (err) {
    logger.warn(
      `[Geocode] Redis cache read failed: ${err instanceof Error ? err.message : 'Unknown'}`
    );
  }
  return null;
};

const writeRedisCache = async (key: string, coords: GeoCoordinates): Promise<void> => {
  if (!isRedisEnabled() || !isRedisReady()) return;
  try {
    await getRedisClient().set(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify(coords),
      'EX',
      CACHE_TTL_SECONDS
    );
  } catch (err) {
    logger.warn(
      `[Geocode] Redis cache write failed: ${err instanceof Error ? err.message : 'Unknown'}`
    );
  }
};

const geocodeWithNominatim = async (location: string): Promise<GeoCoordinates | null> => {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', location);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'gb');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'B-Aziz-Marketplace/1.0 (property-management)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    logger.warn(`[Geocode] Nominatim HTTP ${response.status} for "${location}"`);
    return null;
  }

  const results = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (!results.length) return null;

  const lat = parseFloat(results[0].lat);
  const lng = parseFloat(results[0].lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  return { lat, lng };
};

const geocodeWithGoogle = async (
  location: string,
  apiKey: string
): Promise<GeoCoordinates | null> => {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', location);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('region', 'gb');

  const response = await fetch(url.toString());
  if (!response.ok) return null;

  const data = (await response.json()) as {
    status: string;
    results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
  };

  if (data.status !== 'OK' || !data.results.length) return null;

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
};

/**
 * Geocode a location string (e.g. "Manchester, UK") to lat/lng.
 * Results are cached in Redis (24h) with in-memory fallback.
 * Returns null on failure — caller should fall back to text matching.
 */
export const geocodeLocation = async (location: string): Promise<GeoCoordinates | null> => {
  const trimmed = location.trim();
  if (!trimmed) return null;

  const cacheKey = normalizeCacheKey(trimmed);

  const fromRedis = await readRedisCache(cacheKey);
  if (fromRedis) return fromRedis;

  const fromMemory = readMemoryCache(cacheKey);
  if (fromMemory) return fromMemory;

  let coords: GeoCoordinates | null = null;

  const googleKey = process.env.GOOGLE_GEOCODING_API_KEY?.trim();
  if (googleKey) {
    try {
      coords = await geocodeWithGoogle(trimmed, googleKey);
    } catch (err) {
      logger.warn(
        `[Geocode] Google API failed: ${err instanceof Error ? err.message : 'Unknown'}`
      );
    }
  }

  if (!coords) {
    try {
      coords = await geocodeWithNominatim(trimmed);
    } catch (err) {
      logger.warn(
        `[Geocode] Nominatim failed: ${err instanceof Error ? err.message : 'Unknown'}`
      );
    }
  }

  if (coords) {
    writeMemoryCache(cacheKey, coords);
    await writeRedisCache(cacheKey, coords);
  }

  return coords;
};

export const milesToMeters = (miles: number): number => miles * 1609.34;
