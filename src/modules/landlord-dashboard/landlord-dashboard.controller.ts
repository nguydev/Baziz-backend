/**
 * Landlord Portfolio Overview Controller
 */

import type { Request, Response } from 'express';
import * as landlordDashboardService from './landlord-dashboard.service';
import ApiResponse from '../../utils/ApiResponse';
import asyncHandler from '../../utils/asyncHandler';

export const getPortfolioOverview = asyncHandler(async (req: Request, res: Response) => {
  const landlordId = req.user!._id.toString();
  const overview = await landlordDashboardService.getPortfolioOverview(landlordId);
  res.status(200).json(
    ApiResponse.ok('Portfolio overview retrieved', { portfolioOverview: overview })
  );
});
