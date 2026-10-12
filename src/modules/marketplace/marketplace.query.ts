import mongoose, { type FilterQuery, type SortOrder } from 'mongoose';
import type {
  BrowseJvQuery,
  BrowseListingsQuery,
  IJointVentureDocument,
  IMarketplaceListingDocument,
  ListingCard,
  JvCard,
  ListingSort,
  JvSort,
  RadiusMiles,
} from './marketplace.types';
import { geocodeLocation, milesToMeters } from './marketplace.geocode.service';
import logger from '../../config/logger';

export const ALLOWED_RADIUS_MILES: readonly RadiusMiles[] = [10, 25, 50, 75, 100];
export const MILES_TO_METERS = 1609.34;

export const PUBLISHED_LISTING_FILTER: FilterQuery<IMarketplaceListingDocument> = {
  status: 'published',
  'flags.isActive': true,
};

export const PUBLISHED_JV_FILTER: FilterQuery<IJointVentureDocument> = {
  status: 'published',
};

const ALL_TYPES_LABEL = 'all types';

export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isAllTypes = (type?: string): boolean => {
  if (!type?.trim()) return true;
  return type.trim().toLowerCase() === ALL_TYPES_LABEL;
};

export const calcListedDays = (publishedAt?: Date | null): number => {
  if (!publishedAt) return 0;
  const diffMs = Date.now() - publishedAt.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

const buildTextLocationFilter = (location: string): Record<string, unknown> => {
  const pattern = new RegExp(escapeRegex(location.trim()), 'i');
  return {
    $or: [{ location: pattern }, { 'address.city': pattern }],
  };
};

const buildSearchFilter = (search: string): Record<string, unknown> => {
  const pattern = new RegExp(escapeRegex(search.trim()), 'i');
  return {
    $or: [
      { title: pattern },
      { location: pattern },
      { description: pattern },
    ],
  };
};

const applyRangeFilter = (
  filter: Record<string, unknown>,
  field: string,
  min?: number,
  max?: number
): void => {
  if (min === undefined && max === undefined) return;
  const range: Record<string, number> = {};
  if (min !== undefined) range.$gte = min;
  if (max !== undefined) range.$lte = max;
  filter[field] = range;
};

const mergeAndConditions = (
  filter: FilterQuery<IMarketplaceListingDocument | IJointVentureDocument>,
  conditions: Record<string, unknown>[]
): void => {
  if (!conditions.length) return;

  const existing = filter.$and;
  if (Array.isArray(existing)) {
    filter.$and = [...existing, ...conditions];
  } else {
    filter.$and = conditions;
  }
};

export interface ListingBrowseContext {
  savedIds?: mongoose.Types.ObjectId[];
}

export interface ListingBrowseFilterResult {
  filter: FilterQuery<IMarketplaceListingDocument>;
  usedGeoRadius: boolean;
}

/**
 * Build MongoDB filter for marketplace property listings browse.
 */
export const buildListingFilterQuery = async (
  query: BrowseListingsQuery,
  context: ListingBrowseContext = {}
): Promise<ListingBrowseFilterResult> => {
  const filter: FilterQuery<IMarketplaceListingDocument> = { ...PUBLISHED_LISTING_FILTER };
  const andConditions: Record<string, unknown>[] = [];
  let usedGeoRadius = false;

  if (!isAllTypes(query.type)) {
    filter.type = new RegExp(`^${escapeRegex(query.type!.trim())}$`, 'i');
  }

  applyRangeFilter(filter as Record<string, unknown>, 'price', query.priceMin, query.priceMax);
  applyRangeFilter(filter as Record<string, unknown>, 'yield', query.yieldMin, query.yieldMax);

  if (query.search?.trim()) {
    andConditions.push(buildSearchFilter(query.search));
  }

  const hasLocation = Boolean(query.location?.trim());
  const hasRadius = query.radiusMiles !== undefined;

  if (hasLocation && hasRadius) {
    const coords = await geocodeLocation(query.location!);
    if (coords) {
      filter.geo = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [coords.lng, coords.lat],
          },
          $maxDistance: milesToMeters(query.radiusMiles!),
        },
      };
      usedGeoRadius = true;
    } else {
      logger.info(
        `[Marketplace] Geocode failed for "${query.location}" — falling back to text match`
      );
      andConditions.push(buildTextLocationFilter(query.location!));
    }
  } else if (hasLocation) {
    andConditions.push(buildTextLocationFilter(query.location!));
  }

  if (query.savedOnly) {
    const ids = context.savedIds ?? [];
    filter._id = { $in: ids };
  }

  mergeAndConditions(filter, andConditions);

  return { filter, usedGeoRadius };
};

export const buildListingSort = (sort?: ListingSort): Record<string, SortOrder> => {
  const sortMap: Record<ListingSort, Record<string, SortOrder>> = {
    newest: { publishedAt: -1 },
    oldest: { publishedAt: 1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    yield_desc: { yield: -1 },
    yield_asc: { yield: 1 },
  };
  return sortMap[sort ?? 'newest'] ?? sortMap.newest;
};

export interface JvBrowseContext {
  savedIds?: mongoose.Types.ObjectId[];
}

export interface JvBrowseFilterResult {
  filter: FilterQuery<IJointVentureDocument>;
}

/**
 * Build MongoDB filter for joint venture browse.
 * JV uses text location matching (no geo field on model).
 */
export const buildJvFilterQuery = (
  query: BrowseJvQuery,
  context: JvBrowseContext = {}
): JvBrowseFilterResult => {
  const filter: FilterQuery<IJointVentureDocument> = { ...PUBLISHED_JV_FILTER };
  const andConditions: Record<string, unknown>[] = [];

  if (query.risk) filter.risk = query.risk;

  if (!isAllTypes(query.projectType)) {
    filter.projectType = new RegExp(`^${escapeRegex(query.projectType!.trim())}$`, 'i');
  }

  applyRangeFilter(
    filter as Record<string, unknown>,
    'financials.investmentNeeded',
    query.investmentMin,
    query.investmentMax
  );

  if (query.search?.trim()) {
    andConditions.push(buildSearchFilter(query.search));
  }

  if (query.location?.trim()) {
    andConditions.push({ location: new RegExp(escapeRegex(query.location.trim()), 'i') });
  }

  if (query.savedOnly) {
    const ids = context.savedIds ?? [];
    filter._id = { $in: ids };
  }

  mergeAndConditions(filter, andConditions);

  return { filter };
};

export const buildJvSort = (sort?: JvSort): Record<string, SortOrder> => {
  const sortMap: Record<JvSort, Record<string, SortOrder>> = {
    newest: { publishedAt: -1 },
    oldest: { publishedAt: 1 },
    investment_asc: { 'financials.investmentNeeded': 1 },
    investment_desc: { 'financials.investmentNeeded': -1 },
    return_desc: { 'financials.expectedReturn': -1 },
    return_asc: { 'financials.expectedReturn': 1 },
  };
  return sortMap[sort ?? 'newest'] ?? sortMap.newest;
};

export const toListingCard = (
  doc: IMarketplaceListingDocument,
  isSaved = false
): ListingCard => ({
  id: doc._id.toString(),
  title: doc.title,
  location: doc.location,
  price: doc.price,
  type: doc.type,
  yield: doc.yield ?? null,
  imageUrl: doc.imageUrl ?? null,
  listedDays: calcListedDays(doc.publishedAt),
  isSaved,
});

export const toJvCard = (doc: IJointVentureDocument, isSaved = false): JvCard => ({
  id: doc._id.toString(),
  title: doc.title,
  location: doc.location,
  projectType: doc.projectType,
  investmentNeeded: doc.financials.investmentNeeded,
  expectedReturn: doc.financials.expectedReturn,
  risk: doc.risk,
  imageUrl: doc.imageUrl ?? null,
  listedDays: calcListedDays(doc.publishedAt),
  isSaved,
});

export { milesToMeters as convertMilesToMeters };
