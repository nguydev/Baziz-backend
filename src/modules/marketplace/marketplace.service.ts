import mongoose from 'mongoose';
import Property from '../property/property.model';
import MarketplaceListing from './marketplace-listing.model';
import JointVenture from './joint-venture.model';
import MarketplaceSaved from './marketplace-saved.model';
import MarketplaceInquiry from './marketplace-inquiry.model';
import ApiError from '../../utils/ApiError';
import logger from '../../config/logger';
import type { PaginationMeta } from '../../types/api.types';
import { buildPaginationMeta } from '../../utils/pagination';
import {
  buildListingFilterQuery,
  buildListingSort,
  buildJvFilterQuery,
  buildJvSort,
  toListingCard,
  toJvCard,
} from './marketplace.query';
import type {
  AuthUser,
  BrowseJvQuery,
  BrowseListingsQuery,
  CreateInquiryInput,
  CreateJointVentureInput,
  CreateNewPropertyListingInput,
  CreatePortfolioListingInput,
  IJointVentureDocument,
  IMarketplaceListingDocument,
  UpdateJointVentureInput,
  UpdateListingInput,
} from './marketplace.types';

const ACTIVE_LISTING_STATUSES = ['draft', 'pending_review', 'published'];

const formatPropertyType = (type: string): string =>
  type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const buildLocationString = (parts: {
  line1?: string;
  city?: string;
  postCode?: string;
}): string => [parts.line1, parts.city, parts.postCode].filter(Boolean).join(', ');

const resolveImage = (
  image?: { url: string; storagePath: string },
  fallbackUrl?: string | null
): { imageUrl: string | null; images: Array<{ url: string; storagePath: string }> } => {
  if (image?.url) {
    return {
      imageUrl: image.url,
      images: [{ url: image.url, storagePath: image.storagePath }],
    };
  }
  return { imageUrl: fallbackUrl ?? null, images: [] };
};

const formatListing = (doc: IMarketplaceListingDocument) => ({
  id: doc._id.toString(),
  sellerId: doc.sellerId.toString(),
  category: doc.category,
  sourceType: doc.sourceType,
  propertyId: doc.propertyId?.toString() ?? null,
  title: doc.title,
  location: doc.location,
  address: doc.address,
  geo: doc.geo,
  price: doc.price,
  yield: doc.yield,
  type: doc.type,
  size: doc.size,
  description: doc.description,
  imageUrl: doc.imageUrl,
  images: doc.images,
  specs: doc.specs,
  flags: doc.flags,
  valuation: doc.valuation,
  status: doc.status,
  views: doc.views,
  inquiries: doc.inquiries,
  publishedAt: doc.publishedAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const formatJointVenture = (doc: IJointVentureDocument) => ({
  id: doc._id.toString(),
  creatorId: doc.creatorId.toString(),
  category: doc.category,
  title: doc.title,
  projectType: doc.projectType,
  investmentModel: doc.investmentModel,
  risk: doc.risk,
  location: doc.location,
  description: doc.description,
  exitStrategy: doc.exitStrategy,
  financials: doc.financials,
  imageUrl: doc.imageUrl,
  images: doc.images,
  status: doc.status,
  views: doc.views,
  inquiries: doc.inquiries,
  publishedAt: doc.publishedAt,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const queueAlertMatching = (listingId: string): void => {
  logger.info(`[Marketplace] Alert matching queued for listing ${listingId}`);
};

const queueValuationJob = async (
  listingId: string,
  propertyId: string,
  basePrice: number
): Promise<void> => {
  setTimeout(async () => {
    try {
      const estimatedValue = Math.round(basePrice * 1.03);
      await MarketplaceListing.findByIdAndUpdate(listingId, {
        $set: {
          'valuation.estimatedValue': estimatedValue,
          'valuation.confidence': 75,
          'valuation.completedAt': new Date(),
        },
      });
      logger.info(
        `[Marketplace] Valuation completed for listing ${listingId} (property ${propertyId}): €${estimatedValue}`
      );
    } catch (err) {
      logger.error(
        `[Marketplace] Valuation job failed: ${err instanceof Error ? err.message : 'Unknown'}`
      );
    }
  }, 2000);
};

export const getPropertiesForMarketplace = async (
  landlordId: string,
  excludeListed = false
) => {
  const query: Record<string, unknown> = {
    landlordId,
    isActive: true,
  };

  if (excludeListed) {
    query.$or = [
      { marketplaceListingId: { $exists: false } },
      { marketplaceListingId: null },
    ];
  }

  const properties = await Property.find(query).sort({ createdAt: -1 }).lean();

  return properties.map((p) => {
    const isListed = Boolean(p.marketplaceListingId);
    return {
      id: p._id.toString(),
      name: p.propertyName,
      type: formatPropertyType(p.propertyType),
      address: `${p.streetAddress}, ${p.city}`,
      specs: {
        bedrooms: p.bedrooms ?? null,
        sqft: p.squareFeet ?? null,
        epcRating: p.epcRating ?? null,
      },
      primaryImageUrl: p.propertyImage ?? null,
      isListed,
    };
  });
};

export const createPortfolioListing = async (
  user: AuthUser,
  input: CreatePortfolioListingInput
) => {
  const sellerId = user._id.toString();
  const property = await Property.findOne({
    _id: input.propertyId,
    landlordId: sellerId,
    isActive: true,
  });

  if (!property) {
    throw ApiError.notFound('Property not found');
  }

  if (property.marketplaceListingId) {
    const existing = await MarketplaceListing.findOne({
      _id: property.marketplaceListingId,
      status: { $in: ACTIVE_LISTING_STATUSES },
    });
    if (existing) {
      throw ApiError.conflict('This property already has an active marketplace listing');
    }
  }

  const address = {
    line1: property.streetAddress,
    city: property.city,
    postCode: property.postcode,
    country: 'UK',
  };
  const location = buildLocationString(address);
  const { imageUrl, images } = resolveImage(input.image, property.propertyImage);

  const listing = await MarketplaceListing.create({
    sellerId,
    category: 'property',
    sourceType: 'portfolio',
    propertyId: property._id,
    title: property.propertyName,
    location,
    address,
    price: input.price,
    type: formatPropertyType(property.propertyType),
    size: property.squareFeet ? `${property.squareFeet} sq ft` : null,
    description: input.description,
    imageUrl,
    images,
    specs: {
      sqft: property.squareFeet ?? null,
      bedrooms: property.bedrooms ?? null,
      bathrooms: property.bathrooms ?? null,
      epcRating: property.epcRating ?? null,
      tenure: property.tenure,
      occupancy: null,
    },
    flags: {
      isNegotiable: input.isNegotiable ?? false,
      valuationRequested: input.valuationRequested ?? false,
      isActive: true,
    },
    valuation: {},
    status: 'published',
    publishedAt: new Date(),
  });

  property.marketplaceListingId = listing._id;
  await property.save();

  if (input.valuationRequested) {
    void queueValuationJob(listing._id.toString(), property._id.toString(), input.price);
  }

  queueAlertMatching(listing._id.toString());

  return formatListing(listing);
};

export const createNewPropertyListing = async (
  user: AuthUser,
  input: CreateNewPropertyListingInput
) => {
  const address = {
    ...input.address,
    country: input.address.country ?? 'UK',
  };
  const location = buildLocationString(address);
  const { imageUrl, images } = resolveImage(input.image);

  const listing = await MarketplaceListing.create({
    sellerId: user._id,
    category: 'property',
    sourceType: 'external',
    propertyId: null,
    title: input.title,
    location,
    address,
    price: input.price,
    yield: input.yield ?? null,
    type: input.type,
    size: input.specs?.sqft ? `${input.specs.sqft} sq ft` : null,
    description: input.description,
    imageUrl,
    images,
    specs: {
      sqft: input.specs?.sqft ?? null,
      bedrooms: input.specs?.bedrooms ?? null,
      bathrooms: input.specs?.bathrooms ?? null,
      epcRating: input.specs?.epcRating ?? null,
      tenure: input.tenure ?? null,
      occupancy: null,
    },
    flags: {
      isNegotiable: input.isNegotiable ?? false,
      valuationRequested: false,
      isActive: true,
    },
    valuation: {},
    status: 'published',
    publishedAt: new Date(),
  });

  queueAlertMatching(listing._id.toString());

  return formatListing(listing);
};

export const createJointVenture = async (user: AuthUser, input: CreateJointVentureInput) => {
  const { imageUrl, images } = resolveImage(input.image);

  const jv = await JointVenture.create({
    creatorId: user._id,
    category: 'joint_venture',
    title: input.title,
    projectType: input.projectType,
    investmentModel: input.investmentModel,
    risk: input.risk,
    location: input.location,
    description: input.description,
    exitStrategy: input.exitStrategy,
    financials: input.financials,
    imageUrl,
    images,
    status: 'published',
    publishedAt: new Date(),
  });

  return formatJointVenture(jv);
};

export const estimateValuation = async (user: AuthUser, propertyId: string) => {
  const property = await Property.findOne({
    _id: propertyId,
    landlordId: user._id.toString(),
    isActive: true,
  });

  if (!property) {
    throw ApiError.notFound('Property not found');
  }

  const listing = property.marketplaceListingId
    ? await MarketplaceListing.findById(property.marketplaceListingId)
    : null;

  const basePrice = listing?.price ?? property.purchasePrice ?? 0;
  const estimatedValue = Math.round(basePrice * 1.03);

  if (listing) {
    listing.valuation = {
      estimatedValue,
      confidence: 75,
      completedAt: new Date(),
    };
    await listing.save();
  }

  return {
    propertyId,
    listingId: listing?._id.toString() ?? null,
    estimatedValue,
    confidence: 75,
  };
};

const fetchSavedItemIds = async (
  userId: string,
  itemType: 'listing' | 'joint_venture'
): Promise<mongoose.Types.ObjectId[]> => {
  const saved = await MarketplaceSaved.find({ userId, itemType }).select('itemId').lean();
  return saved.map((s) => s.itemId);
};

const fetchSavedIdSet = async (
  userId: string,
  itemType: 'listing' | 'joint_venture'
): Promise<Set<string>> => {
  const ids = await fetchSavedItemIds(userId, itemType);
  return new Set(ids.map((id) => id.toString()));
};

export const browseListings = async (query: BrowseListingsQuery, userId?: string) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const savedIds = query.savedOnly && userId ? await fetchSavedItemIds(userId, 'listing') : undefined;

  const { filter } = await buildListingFilterQuery(query, { savedIds });

  const sort = buildListingSort(query.sort);

  const [items, total] = await Promise.all([
    MarketplaceListing.find(filter).sort(sort).skip(skip).limit(limit),
    MarketplaceListing.countDocuments(filter),
  ]);

  const savedSet = userId ? await fetchSavedIdSet(userId, 'listing') : new Set<string>();

  const meta: PaginationMeta = buildPaginationMeta(total, page, limit);

  return {
    listings: items.map((doc) => toListingCard(doc, savedSet.has(doc._id.toString()))),
    meta,
  };
};

export const browseJointVentures = async (query: BrowseJvQuery, userId?: string) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const savedIds =
    query.savedOnly && userId ? await fetchSavedItemIds(userId, 'joint_venture') : undefined;

  const { filter } = buildJvFilterQuery(query, { savedIds });
  const sort = buildJvSort(query.sort);

  const [items, total] = await Promise.all([
    JointVenture.find(filter).sort(sort).skip(skip).limit(limit),
    JointVenture.countDocuments(filter),
  ]);

  const savedSet = userId ? await fetchSavedIdSet(userId, 'joint_venture') : new Set<string>();

  const meta: PaginationMeta = buildPaginationMeta(total, page, limit);

  return {
    jointVentures: items.map((doc) => toJvCard(doc, savedSet.has(doc._id.toString()))),
    meta,
  };
};

export const getListingById = async (id: string, incrementView = true) => {
  const listing = await MarketplaceListing.findById(id);
  if (!listing || listing.status === 'removed') {
    throw ApiError.notFound('Listing not found');
  }

  if (incrementView && listing.status === 'published') {
    listing.views += 1;
    await listing.save();
  }

  return formatListing(listing);
};

export const updateListing = async (
  user: AuthUser,
  id: string,
  input: UpdateListingInput
) => {
  const listing = await MarketplaceListing.findById(id);
  if (!listing || listing.status === 'removed') {
    throw ApiError.notFound('Listing not found');
  }

  if (listing.sellerId.toString() !== user._id.toString()) {
    throw ApiError.forbidden('You can only edit your own listings');
  }

  if (input.price !== undefined) listing.price = input.price;
  if (input.description !== undefined) listing.description = input.description;
  if (input.yield !== undefined) listing.yield = input.yield;
  if (input.isNegotiable !== undefined) listing.flags.isNegotiable = input.isNegotiable;
  if (input.status !== undefined) {
    listing.status = input.status;
    if (input.status === 'published' && !listing.publishedAt) {
      listing.publishedAt = new Date();
    }
  }
  if (input.image) {
    listing.imageUrl = input.image.url;
    listing.images = [{ url: input.image.url, storagePath: input.image.storagePath }];
  }

  await listing.save();
  return formatListing(listing);
};

export const deleteListing = async (user: AuthUser, id: string) => {
  const listing = await MarketplaceListing.findById(id);
  if (!listing || listing.status === 'removed') {
    throw ApiError.notFound('Listing not found');
  }

  if (listing.sellerId.toString() !== user._id.toString()) {
    throw ApiError.forbidden('You can only delete your own listings');
  }

  listing.status = 'removed';
  listing.flags.isActive = false;
  await listing.save();

  if (listing.propertyId) {
    await Property.updateOne(
      { _id: listing.propertyId, marketplaceListingId: listing._id },
      { $set: { marketplaceListingId: null } }
    );
  }

  return { id: listing._id.toString(), status: listing.status };
};

export const updateJointVenture = async (
  user: AuthUser,
  id: string,
  input: UpdateJointVentureInput
) => {
  const jv = await JointVenture.findById(id);
  if (!jv || jv.status === 'removed') {
    throw ApiError.notFound('Joint venture not found');
  }

  if (jv.creatorId.toString() !== user._id.toString()) {
    throw ApiError.forbidden('You can only edit your own joint ventures');
  }

  if (input.title !== undefined) jv.title = input.title;
  if (input.projectType !== undefined) jv.projectType = input.projectType;
  if (input.investmentModel !== undefined) jv.investmentModel = input.investmentModel;
  if (input.risk !== undefined) jv.risk = input.risk;
  if (input.location !== undefined) jv.location = input.location;
  if (input.description !== undefined) jv.description = input.description;
  if (input.exitStrategy !== undefined) jv.exitStrategy = input.exitStrategy;
  if (input.status !== undefined) {
    jv.status = input.status;
    if (input.status === 'published' && !jv.publishedAt) {
      jv.publishedAt = new Date();
    }
  }
  if (input.financials) {
    const merged = { ...jv.financials, ...input.financials };
    if (merged.investmentNeeded > merged.totalProjectCost) {
      throw ApiError.badRequest('Investment needed cannot exceed total project cost');
    }
    jv.financials = merged;
  }
  if (input.image) {
    jv.imageUrl = input.image.url;
    jv.images = [{ url: input.image.url, storagePath: input.image.storagePath }];
  }

  await jv.save();
  return formatJointVenture(jv);
};

export const deleteJointVenture = async (user: AuthUser, id: string) => {
  const jv = await JointVenture.findById(id);
  if (!jv || jv.status === 'removed') {
    throw ApiError.notFound('Joint venture not found');
  }

  if (jv.creatorId.toString() !== user._id.toString()) {
    throw ApiError.forbidden('You can only delete your own joint ventures');
  }

  jv.status = 'removed';
  await jv.save();

  return { id: jv._id.toString(), status: jv.status };
};

export const createListingInquiry = async (
  user: AuthUser,
  listingId: string,
  input: CreateInquiryInput
) => {
  const listing = await MarketplaceListing.findById(listingId);
  if (!listing || listing.status !== 'published') {
    throw ApiError.notFound('Listing not found');
  }

  if (listing.sellerId.toString() === user._id.toString()) {
    throw ApiError.badRequest('You cannot inquire on your own listing');
  }

  const inquiry = await MarketplaceInquiry.create({
    listingId: listing._id,
    inquirerId: user._id,
    sellerId: listing.sellerId,
    message: input.message,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
  });

  listing.inquiries += 1;
  await listing.save();

  return {
    id: inquiry._id.toString(),
    listingId: listing._id.toString(),
    message: inquiry.message,
    status: inquiry.status,
    createdAt: inquiry.createdAt,
  };
};

export const toggleSavedItem = async (
  user: AuthUser,
  itemId: string,
  itemType: 'listing' | 'joint_venture'
) => {
  const existing = await MarketplaceSaved.findOne({
    userId: user._id,
    itemType,
    itemId,
  });

  if (existing) {
    await existing.deleteOne();
    return { saved: false, itemId, itemType };
  }

  if (itemType === 'listing') {
    const listing = await MarketplaceListing.findById(itemId);
    if (!listing || listing.status !== 'published') {
      throw ApiError.notFound('Listing not found');
    }
  } else {
    const jv = await JointVenture.findById(itemId);
    if (!jv || jv.status !== 'published') {
      throw ApiError.notFound('Joint venture not found');
    }
  }

  await MarketplaceSaved.create({
    userId: user._id,
    itemType,
    itemId,
  });

  return { saved: true, itemId, itemType };
};
