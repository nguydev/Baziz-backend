import mongoose from "mongoose";
import type { IPropertyDocumentRecord } from "./property-document.model";

export interface IPropertyDocument {
  propertyId?: mongoose.Types.ObjectId;
  documentType: string;
  landlordId: mongoose.Types.ObjectId;
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadDocumentInput {
  title?: string;
  documentType?: string;
  propertyId?: string;
}

export interface ListDocumentsQuery {
  page: number;
  limit: number;
}

export interface ListDocumentsResult {
  documents: IPropertyDocumentRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AuthUser {
  _id: mongoose.Types.ObjectId;
  role: "landlord" | "tenant";
}
