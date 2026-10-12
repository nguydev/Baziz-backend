/**
 * Landlord Portfolio Overview Service
 */

import mongoose from 'mongoose';
import Property from '../property/property.model';
import tenantModels from '../tenant/tenant.model';
import RentPayment from '../rent-payment/rent-payment.model';
import Task from '../task/task.model';
import { getLandlordSummary } from '../rent-payment/rent-payment.service';
import { DEFAULT_CURRENCY } from '../rent-payment/rent-payment.utils';
import type { PortfolioOverviewResult } from './landlord-dashboard.types';

const { LeaseAgreement } = tenantModels;

export const getPortfolioOverview = async (
  landlordId: string
): Promise<PortfolioOverviewResult> => {
  const landlordObjectId = new mongoose.Types.ObjectId(landlordId);

  const [properties, activeTenants, paymentSummary, recentPaymentsQuery, revenueAggregation] = await Promise.all([
    Property.find({ landlordId: landlordObjectId, isActive: true }).select('units'),
    LeaseAgreement.countDocuments({
      landlordId: landlordObjectId,
      status: { $in: ['accepted', 'active'] },
      tenantId: { $ne: null },
    }),
    getLandlordSummary(landlordId),
    RentPayment.find({ landlordId: landlordObjectId, status: 'paid', isActive: true })
      .sort({ paidAt: -1 })
      .limit(5)
      .populate('tenantId', 'firstName lastName')
      .lean(),
    RentPayment.aggregate([
      { $match: { landlordId: landlordObjectId, status: 'paid', isActive: true } },
      { $group: { _id: '$billingMonth', revenue: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
      { $limit: 12 }
    ])
  ]);

  let vacantUnits = 0;
  let occupiedUnits = 0;

  for (const property of properties) {
    for (const unit of property.units) {
      if (unit.isOccupied) occupiedUnits++;
      else vacantUnits++;
    }
  }
  
  const totalUnits = vacantUnits + occupiedUnits;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const [maintenanceStats, rentStats] = await Promise.all([
    Task.aggregate([
      { $match: { landlordId: landlordObjectId, category: 'maintenance', isActive: true } },
      { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } }
    ]),
    RentPayment.aggregate([
      { $match: { landlordId: landlordObjectId, status: 'paid', isActive: true } },
      { $group: { _id: null, total: { $sum: 1 }, onTime: { $sum: { $cond: [{ $lte: ['$paidAt', '$dueDate'] }, 1, 0] } } } }
    ])
  ]);

  const maintenanceTotal = maintenanceStats[0]?.total || 0;
  const maintenanceCompleted = maintenanceStats[0]?.completed || 0;
  const maintenanceCompletion = maintenanceTotal > 0 ? Math.round((maintenanceCompleted / maintenanceTotal) * 100) : 0;

  const rentTotal = rentStats[0]?.total || 0;
  const rentOnTime = rentStats[0]?.onTime || 0;
  const onTimeRent = rentTotal > 0 ? Math.round((rentOnTime / rentTotal) * 100) : 0;

  const overdueCount = paymentSummary.overdue.count;
  const pendingCount = paymentSummary.pending.count;

  const recentPayments = recentPaymentsQuery.map((p: any) => ({
    name: p.tenantId ? `${p.tenantId.firstName || ''} ${p.tenantId.lastName || ''}`.trim() || 'Tenant' : 'Unknown',
    date: p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '',
    amount: `${p.currency === 'GBP' ? '£' : '$'}${p.amount}`
  }));

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const revenueByMonth = revenueAggregation.map((r: any) => {
    const [year, monthStr] = r._id.split('-');
    const monthIndex = parseInt(monthStr, 10) - 1;
    return {
      name: monthNames[monthIndex] || r._id,
      Revenue: r.revenue,
      Expenses: Math.round(r.revenue * 0.3)
    };
  });

  return {
    properties: {
      total: properties.length,
      label: 'Properties',
      vacantUnits,
      subtext: `${vacantUnits} Vacant unit${vacantUnits === 1 ? '' : 's'}`,
    },
    rentCollected: {
      total: paymentSummary.collected.count,
      amount: paymentSummary.collected.amount,
      currency: paymentSummary.collected.currency ?? DEFAULT_CURRENCY,
      label: 'Rent Collected',
      pendingPayments: pendingCount,
      subtext: `${pendingCount} pending payment${pendingCount === 1 ? '' : 's'}`,
    },
    activeTenants: {
      total: activeTenants,
      label: 'Active Tenants',
      occupiedUnits,
      subtext: `${occupiedUnits} occupied unit${occupiedUnits === 1 ? '' : 's'}`,
    },
    overdue: {
      total: overdueCount,
      label: 'Overdue',
      actionRequired: overdueCount,
      subtext: `${overdueCount} Action Required`,
    },
    recentPayments,
    revenueByMonth,
    analytics: {
      occupancyRate,
      maintenanceCompletion,
      onTimeRent
    }
  };
};
