import type { Document, Types } from 'mongoose';

export type ListingSourceType = 'portfolio' | 'external';
export type ListingStatus = 'draft' | 'pending_review' | 'published' | 'sold' | 'removed';
export type JvStatus = 'draft' | 'published' | 'closed' | 'removed';
export type JvRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type MediaContext = 'listing' | 'jv';

export interface ImagePayload {
  storagePath: string;
  url: string;
}

export interface AuthUser {
  _id: Types.ObjectId;
  role: string;
  firstName: string;
}

export interface CreatePortfolioListingInput {
  propertyId: string;
  price: number;
  description: string;
  isNegotiable?: boolean;
  valuationRequested?: boolean;
  image?: ImagePayload;
}

export interface CreateNewPropertyListingInput {
  title: string;
  type: string;
  tenure?: string;
  address: {
    line1: string;
    city: string;
    postCode: string;
    country?: string;
  };
  specs?: {
    sqft?: number;
    bedrooms?: number;
    bathrooms?: number;
    epcRating?: string;
  };
  price: number;
  yield?: number;
  description: string;
  isNegotiable?: boolean;
  image?: ImagePayload;
}

export interface CreateJointVentureInput {
  title: string;
  projectType: string;
  investmentModel: string;
  risk: JvRisk;
  location: string;
  description: string;
  exitStrategy: string;
  financials: {
    totalProjectCost: number;
    investmentNeeded: number;
    expectedReturn: number;
    timeline: string;
  };
  image?: ImagePayload;
}

export interface UpdateListingInput {
  price?: number;
  description?: string;
  isNegotiable?: boolean;
  yield?: number;
  image?: ImagePayload;
  status?: ListingStatus;
}

export interface UpdateJointVentureInput {
  title?: string;
  projectType?: string;
  investmentModel?: string;
  risk?: JvRisk;
  location?: string;
  description?: string;
  exitStrategy?: string;
  financials?: Partial<CreateJointVentureInput['financials']>;
  image?: ImagePayload;
  status?: JvStatus;
}

export type RadiusMiles = 10 | 25 | 50 | 75 | 100;

export type ListingSort =
  | 'newest'
  | 'oldest'
  | 'price_asc'
  | 'price_desc'
  | 'yield_desc'
  | 'yield_asc';

export type JvSort =
  | 'newest'
  | 'oldest'
  | 'investment_asc'
  | 'investment_desc'
  | 'return_desc'
  | 'return_asc';

export interface BrowseListingsQuery {
  search?: string;
  type?: string;
  location?: string;
  radiusMiles?: RadiusMiles;
  priceMin?: number;
  priceMax?: number;
  yieldMin?: number;
  yieldMax?: number;
  savedOnly?: boolean;
  sort?: ListingSort;
  page?: number;
  limit?: number;
}

export interface BrowseJvQuery {
  search?: string;
  risk?: JvRisk;
  projectType?: string;
  location?: string;
  investmentMin?: number;
  investmentMax?: number;
  savedOnly?: boolean;
  sort?: JvSort;
  page?: number;
  limit?: number;
}

/** Card shape returned by browse listings API (Flutter list UI). */
export interface ListingCard {
  id: string;
  title: string;
  location: string;
  price: number;
  type: string;
  yield: number | null;
  imageUrl: string | null;
  listedDays: number;
  isSaved: boolean;
}

/** Card shape returned by browse JV API (Flutter list UI). */
export interface JvCard {
  id: string;
  title: string;
  location: string;
  projectType: string;
  investmentNeeded: number;
  expectedReturn: number;
  risk: JvRisk;
  imageUrl: string | null;
  listedDays: number;
  isSaved: boolean;
}

export interface ValuationEstimateInput {
  propertyId: string;
}

export interface MediaUploadInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  context: MediaContext;
}

export interface CreateInquiryInput {
  message: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface IMarketplaceListing {
  sellerId: Types.ObjectId;
  category: 'property';
  sourceType: ListingSourceType;
  propertyId?: Types.ObjectId | null;
  title: string;
  location: string;
  address?: {
    line1?: string;
    city?: string;
    postCode?: string;
    country?: string;
  };
  geo?: {
    type: 'Point';
    coordinates: [number, number];
  };
  price: number;
  yield?: number | null;
  type: string;
  size?: string | null;
  description: string;
  imageUrl?: string | null;
  images: Array<{ url: string; storagePath: string }>;
  specs: {
    sqft?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    epcRating?: string | null;
    tenure?: string | null;
    occupancy?: string | null;
  };
  flags: {
    isNegotiable: boolean;
    valuationRequested: boolean;
    isActive: boolean;
  };
  valuation: {
    estimatedValue?: number | null;
    confidence?: number | null;
    completedAt?: Date | null;
  };
  status: ListingStatus;
  views: number;
  inquiries: number;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IJointVenture {
  creatorId: Types.ObjectId;
  category: 'joint_venture';
  title: string;
  projectType: string;
  investmentModel: string;
  risk: JvRisk;
  location: string;
  description: string;
  exitStrategy: string;
  financials: {
    totalProjectCost: number;
    investmentNeeded: number;
    expectedReturn: number;
    timeline: string;
  };
  imageUrl?: string | null;
  images: Array<{ url: string; storagePath: string }>;
  status: JvStatus;
  views: number;
  inquiries: number;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type IMarketplaceListingDocument = IMarketplaceListing & Document;
export type IJointVentureDocument = IJointVenture & Document;
