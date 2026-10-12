import { Document, Types } from "mongoose";

export interface IOwnershipEntity extends Document {
  user: Types.ObjectId;
  name: string;
  type: "personal" | "limited_company" | "partnership" | "trust" | "other";
  registrationNumber?: string;
  address?: string;
  taxReference?: string;
  contactEmail?: string;
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
