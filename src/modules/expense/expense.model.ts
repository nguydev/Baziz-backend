/**
 * Property Expense Model
 */

import mongoose, { Document, Model } from 'mongoose';
import type { ExpenseCategory, IExpense } from './expense.types';

export interface IExpenseDocument extends IExpense, Document {}

export interface IExpenseModel extends Model<IExpenseDocument> {}

const expenseSchema = new mongoose.Schema<IExpenseDocument, IExpenseModel>(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property ID is required'],
      index: true,
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Landlord ID is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Expense date is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    currency: {
      type: String,
      default: 'GBP',
      trim: true,
      uppercase: true,
      maxlength: [3, 'Currency code cannot exceed 3 characters'],
    },
    category: {
      type: String,
      enum: {
        values: [
          'repairs',
          'utilities',
          'taxes',
          'insurance',
          'maintenance',
        ] as ExpenseCategory[],
        message: 'Invalid expense category',
      },
      required: [true, 'Category is required'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const sanitized = ret as Record<string, unknown>;
        delete sanitized.__v;
        return sanitized;
      },
    },
  }
);

expenseSchema.index({ propertyId: 1, date: -1 });
expenseSchema.index({ propertyId: 1, category: 1, date: -1 });
expenseSchema.index({ landlordId: 1, isActive: 1 });

const Expense = mongoose.model<IExpenseDocument, IExpenseModel>(
  'Expense',
  expenseSchema
);

export default Expense;
