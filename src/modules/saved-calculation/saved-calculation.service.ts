import crypto from 'crypto';
import SavedCalculation from './saved-calculation.model';
import type { ISavedCalculationDocument } from './saved-calculation.model';
import type { SaveCalculationInput, UpdateCalculationInput, CalculatorType } from './saved-calculation.types';
import ApiError from '../../utils/ApiError';

export const saveCalculation = async (
  userId: string,
  input: SaveCalculationInput
): Promise<ISavedCalculationDocument> => {
  const calc = new SavedCalculation({
    userId,
    ...input,
  });
  return calc.save();
};

export const getSavedCalculations = async (
  userId: string,
  calculatorType?: CalculatorType
): Promise<ISavedCalculationDocument[]> => {
  const query: any = { userId };
  if (calculatorType) {
    query.calculatorType = calculatorType;
  }
  return SavedCalculation.find(query).sort({ createdAt: -1 });
};

export const updateCalculation = async (
  userId: string,
  id: string,
  input: UpdateCalculationInput
): Promise<ISavedCalculationDocument> => {
  const calc = await SavedCalculation.findOne({ _id: id, userId });
  if (!calc) {
    throw ApiError.notFound('Saved calculation not found');
  }

  if (input.name !== undefined) calc.name = input.name;
  if (input.inputs !== undefined) calc.inputs = input.inputs;
  if (input.results !== undefined) calc.results = input.results;
  if (input.notes !== undefined) calc.notes = input.notes;

  return calc.save();
};

export const deleteCalculation = async (
  userId: string,
  id: string
): Promise<void> => {
  const result = await SavedCalculation.deleteOne({ _id: id, userId });
  if (result.deletedCount === 0) {
    throw ApiError.notFound('Saved calculation not found');
  }
};

export const enableSharing = async (
  userId: string,
  id: string
): Promise<ISavedCalculationDocument> => {
  const calc = await SavedCalculation.findOne({ _id: id, userId });
  if (!calc) {
    throw ApiError.notFound('Saved calculation not found');
  }

  if (!calc.shareToken) {
    calc.shareToken = crypto.randomBytes(16).toString('hex');
  }
  calc.isShared = true;
  calc.sharedAt = new Date();

  return calc.save();
};

export const disableSharing = async (
  userId: string,
  id: string
): Promise<ISavedCalculationDocument> => {
  const calc = await SavedCalculation.findOne({ _id: id, userId });
  if (!calc) {
    throw ApiError.notFound('Saved calculation not found');
  }

  calc.isShared = false;
  return calc.save();
};

export const getSharedCalculation = async (
  token: string
): Promise<ISavedCalculationDocument> => {
  const calc = await SavedCalculation.findOne({ shareToken: token, isShared: true });
  if (!calc) {
    throw ApiError.notFound('Shared calculation not found or sharing has been disabled');
  }
  return calc;
};
