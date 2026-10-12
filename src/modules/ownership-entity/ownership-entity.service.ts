import { OwnershipEntity } from "./ownership-entity.model";
import { IOwnershipEntity } from "./ownership-entity.types";
import ApiError from "../../utils/ApiError";

export const createOwnershipEntity = async (userId: string, data: Partial<IOwnershipEntity>) => {
  return await OwnershipEntity.create({ ...data, user: userId });
};

export const getOwnershipEntities = async (userId: string) => {
  return await OwnershipEntity.find({ user: userId }).populate("properties", "_id");
};

export const getOwnershipEntityById = async (userId: string, id: string) => {
  const entity = await OwnershipEntity.findOne({ _id: id, user: userId }).populate("properties", "_id");
  if (!entity) {
    throw ApiError.notFound("Ownership Entity not found");
  }
  return entity;
};

export const updateOwnershipEntity = async (userId: string, id: string, data: Partial<IOwnershipEntity>) => {
  const entity = await OwnershipEntity.findOneAndUpdate(
    { _id: id, user: userId },
    data,
    { new: true, runValidators: true }
  );
  if (!entity) {
    throw ApiError.notFound("Ownership Entity not found");
  }
  return entity;
};

export const deleteOwnershipEntity = async (userId: string, id: string) => {
  const entity = await OwnershipEntity.findOneAndDelete({ _id: id, user: userId });
  if (!entity) {
    throw ApiError.notFound("Ownership Entity not found");
  }
  return entity;
};
