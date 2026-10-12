import mongoose, { Schema } from "mongoose";
import { IOwnershipEntity } from "./ownership-entity.types";

const ownershipEntitySchema = new Schema<IOwnershipEntity>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["personal", "limited_company", "partnership", "trust", "other"],
      required: true,
    },
    registrationNumber: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
    },
    taxReference: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    color: {
      type: String,
      default: "#00574b",
    },
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for getting properties that belong to this entity
ownershipEntitySchema.virtual("properties", {
  ref: "Property",
  localField: "_id",
  foreignField: "ownershipEntity",
});

export const OwnershipEntity = mongoose.model<IOwnershipEntity>("OwnershipEntity", ownershipEntitySchema);
