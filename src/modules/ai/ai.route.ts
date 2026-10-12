/**
 * AI Routes
 * Base: /api/v1/ai
 * All routes are protected — requires authenticated landlord session.
 */

import { Router } from 'express';
import { authMiddleware, authorize } from '../../middlewares/auth.middleware';
import validate from '../../middlewares/validate';
import * as aiController from './ai.controller';
import { chatSchema, transcribeSchema } from './ai.validation';

const router = Router();

// Require authenticated landlord for all AI routes
router.use(authMiddleware, authorize('landlord'));

// POST /api/v1/ai/chat — main chat completion with portfolio context + optional news synthesis
router.post('/chat', validate(chatSchema), aiController.chat);

// POST /api/v1/ai/transcribe — convert base64 audio to text via Vercel AI
router.post('/transcribe', validate(transcribeSchema), aiController.transcribe);

// GET /api/v1/ai/tax-rates/cgt — fetch live or fallback CGT rates
router.get('/tax-rates/cgt', aiController.getCGTRates);

// GET /api/v1/ai/tax-rates/iht — fetch live or fallback IHT rates
router.get('/tax-rates/iht', aiController.getIHTRates);

export default router;
