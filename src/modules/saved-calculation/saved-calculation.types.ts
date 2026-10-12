import mongoose from 'mongoose';

export type CalculatorType = 'roi' | 'stamp-duty' | 'property-flip' | 'development';

export interface ISavedCalculation {
  userId: mongoose.Types.ObjectId;
  calculatorType: CalculatorType;
  name: string;
  inputs: Record<string, any>;
  results: Record<string, any>;
  shareToken: string | null;
  isShared: boolean;
  sharedAt: Date | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SaveCalculationInput {
  calculatorType: CalculatorType;
  name: string;
  inputs: Record<string, any>;
  results: Record<string, any>;
  notes?: string;
}

export interface UpdateCalculationInput {
  name?: string;
  inputs?: Record<string, any>;
  results?: Record<string, any>;
  notes?: string;
}
