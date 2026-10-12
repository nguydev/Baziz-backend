/**
 * Property Expense Routes
 * Mounted at /api/v1/properties/:propertyId/expenses
 */

import { Router } from 'express';
import * as expenseController from './expense.controller';
import { apiLimiter } from '../../middlewares/rateLimiter';

const router = Router({ mergeParams: true });

router.post('/', apiLimiter, expenseController.createExpense);
router.get('/report', expenseController.getExpenseReport);
router.get('/', expenseController.listExpenses);
router.get('/:expenseId', expenseController.getExpenseById);
router.patch('/:expenseId', apiLimiter, expenseController.updateExpense);
router.delete('/:expenseId', expenseController.deleteExpense);

export default router;
