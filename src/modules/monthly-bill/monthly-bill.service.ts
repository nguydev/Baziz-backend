/**
 * Monthly Bill Service
 * Business logic for all monthly bill operations
 *
 * Who does what:
 *  - Tenant:   add bill (propertyId/unitId auto-resolved from active lease), view own bills, update/delete own bills
 *  - Landlord: view bills for their properties, update payment status
 */

import mongoose from "mongoose";
import MonthlyBill from "./monthly-bill.model";
import type { IMonthlyBillDocument } from "./monthly-bill.model";
import tenantModels from "../tenant/tenant.model";
import ApiError from "../../utils/ApiError";
import logger from "../../config/logger";
import { buildPaginationMeta } from "../../utils/pagination";
import type {
  AddBillInput,
  UpdateBillInput,
  UpdateStatusInput,
  ListBillsQuery,
  ListBillsResult,
  BillSummary,
  AuthUser,
} from "./monthly-bill.types";

const { LeaseAgreement } = tenantModels;

// ─── Add Bill (Tenant only) ───────────────────────────────────────────────────

export const addBill = async (
  input: AddBillInput,
  user: AuthUser,
): Promise<IMonthlyBillDocument> => {
  let tenantId: string;
  let landlordId: string;

  if (user.role === "landlord") {
    if (!input.tenantId) {
      throw ApiError.badRequest("tenantId is required when landlord adds a bill");
    }
    tenantId = input.tenantId;
    landlordId = user._id.toString();
  } else {
    tenantId = user._id.toString();
    // For tenant, landlordId will be resolved from lease
    landlordId = ""; 
  }

  // Resolve property, unit, and landlord from the tenant's active lease
  const leaseQuery: any = {
    tenantId,
    status: { $ne: "ended" },
  };
  
  if (user.role === "landlord") {
    leaseQuery.landlordId = landlordId;
  }

  const lease = await LeaseAgreement.findOne(leaseQuery);

  if (!lease) {
    throw ApiError.forbidden(
      "No active lease found for this tenant to add a bill.",
    );
  }

  const bill = new MonthlyBill({
    billType: input.billType,
    billingCycle: input.billingCycle,
    supplier: input.supplier,
    accountReference: input.accountReference,
    amount: input.amount,
    dueDay: input.dueDay,
    paymentStatus: input.paymentStatus ?? "pending",
    supplierPhone: input.supplierPhone ?? null,
    supplierWebsite: input.supplierWebsite ?? null,
    notes: input.notes ?? null,
    // Auto-resolved from lease
    propertyId: lease.propertyId,
    unitId: lease.unitId,
    tenantId: lease.tenantId,
    landlordId: lease.landlordId,
    isActive: true,
  });

  await bill.save();

  logger.info(
    `Monthly bill created: ${input.billType} — "${input.supplier}" by ${user.role} ${user._id} for tenant ${tenantId}`,
  );

  return bill;
};

// ─── List Bills (Tenant sees own, Landlord sees theirs) ───────────────────────

export const listBills = async (
  query: ListBillsQuery,
  user: AuthUser,
): Promise<ListBillsResult> => {
  const { page, limit } = query;
  const skip = (page - 1) * limit;

  // Scope by role
  const filter: Record<string, unknown> = { isActive: true };

  if (user.role === "tenant") {
    filter.tenantId = user._id;
  } else {
    // landlord
    filter.landlordId = user._id;
  }

  if (query.billType) filter.billType = query.billType;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;

  const [bills, total] = await Promise.all([
    MonthlyBill.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    MonthlyBill.countDocuments(filter),
  ]);

  // Summary via aggregation — accurate across all pages
  const summaryAgg = await MonthlyBill.aggregate([
    { $match: { ...filter } },
    {
      $group: {
        _id: null,
        estimatedMonthlyTotal: { $sum: "$amount" },
        totalBills: { $sum: 1 },
        paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
        pending: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0] },
        },
        overdue: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "overdue"] }, 1, 0] },
        },
      },
    },
  ]);

  const summary: BillSummary =
    summaryAgg.length > 0
      ? {
          estimatedMonthlyTotal:
            Math.round(summaryAgg[0].estimatedMonthlyTotal * 100) / 100,
          totalBills: summaryAgg[0].totalBills,
          paid: summaryAgg[0].paid,
          pending: summaryAgg[0].pending,
          overdue: summaryAgg[0].overdue,
        }
      : {
          estimatedMonthlyTotal: 0,
          totalBills: 0,
          paid: 0,
          pending: 0,
          overdue: 0,
        };

  const meta = buildPaginationMeta(total, page, limit);

  return {
    bills,
    summary,
    total,
    page: meta.page,
    limit: meta.limit,
    totalPages: meta.totalPages,
    hasNextPage: meta.hasNextPage,
    hasPrevPage: meta.hasPrevPage,
  };
};

// ─── Get Bill By ID (Tenant or Landlord) ─────────────────────────────────────

export const getBillById = async (
  billId: string,
  user: AuthUser,
): Promise<IMonthlyBillDocument> => {
  if (!mongoose.isValidObjectId(billId)) {
    throw ApiError.badRequest("Invalid bill ID");
  }

  const bill = await MonthlyBill.findOne({ _id: billId, isActive: true });

  if (!bill) {
    throw ApiError.notFound("Monthly bill not found");
  }

  // Ownership check — must be the tenant who created it OR the landlord of that property
  const userId = user._id.toString();
  if (
    bill.tenantId.toString() !== userId &&
    bill.landlordId.toString() !== userId
  ) {
    throw ApiError.forbidden("Access denied");
  }

  return bill;
};

// ─── Update Bill Fields (Tenant — own bills only) ────────────────────────────

export const updateBill = async (
  billId: string,
  input: UpdateBillInput,
  user: AuthUser,
): Promise<IMonthlyBillDocument> => {
  if (!mongoose.isValidObjectId(billId)) {
    throw ApiError.badRequest("Invalid bill ID");
  }

  const bill = await MonthlyBill.findOne({ _id: billId, isActive: true });

  if (!bill) {
    throw ApiError.notFound("Monthly bill not found");
  }

  // Only the tenant who created the bill can edit it
  if (bill.tenantId.toString() !== user._id.toString()) {
    throw ApiError.forbidden(
      "Access denied — only the tenant who created this bill can edit it",
    );
  }

  if (input.billType !== undefined) bill.billType = input.billType;
  if (input.billingCycle !== undefined) bill.billingCycle = input.billingCycle;
  if (input.supplier !== undefined) bill.supplier = input.supplier;
  if (input.accountReference !== undefined)
    bill.accountReference = input.accountReference;
  if (input.amount !== undefined)
    bill.amount = input.amount;
  if (input.dueDay !== undefined) bill.dueDay = input.dueDay;
  if (input.paymentStatus !== undefined)
    bill.paymentStatus = input.paymentStatus;
  if (input.supplierPhone !== undefined)
    bill.supplierPhone = input.supplierPhone;
  if (input.supplierWebsite !== undefined)
    bill.supplierWebsite = input.supplierWebsite;
  if (input.notes !== undefined) bill.notes = input.notes;

  await bill.save();

  logger.info(`Monthly bill ${billId} updated by tenant ${user._id}`);

  return bill;
};

// ─── Update Payment Status (Landlord or Tenant) ───────────────────────────────

export const updateStatus = async (
  billId: string,
  input: UpdateStatusInput,
  user: AuthUser,
): Promise<IMonthlyBillDocument> => {
  if (!mongoose.isValidObjectId(billId)) {
    throw ApiError.badRequest("Invalid bill ID");
  }

  const bill = await MonthlyBill.findOne({ _id: billId, isActive: true });

  if (!bill) {
    throw ApiError.notFound("Monthly bill not found");
  }

  // Allow landlord OR the tenant of the bill to update the status
  const userId = user._id.toString();
  if (
    bill.landlordId.toString() !== userId &&
    bill.tenantId.toString() !== userId
  ) {
    throw ApiError.forbidden("Access denied to update payment status");
  }

  bill.paymentStatus = input.paymentStatus;
  await bill.save();

  logger.info(
    `Monthly bill ${billId} payment status updated to '${input.paymentStatus}' by ${user.role} ${user._id}`,
  );

  return bill;
};

// ─── Soft Delete (Tenant — own bills only) ────────────────────────────────────

export const softDeleteBill = async (
  billId: string,
  user: AuthUser,
): Promise<void> => {
  if (!mongoose.isValidObjectId(billId)) {
    throw ApiError.badRequest("Invalid bill ID");
  }

  const bill = await MonthlyBill.findOne({ _id: billId, isActive: true });

  if (!bill) {
    throw ApiError.notFound("Monthly bill not found");
  }

  if (bill.tenantId.toString() !== user._id.toString()) {
    throw ApiError.forbidden(
      "Access denied — only the tenant who created this bill can delete it",
    );
  }

  bill.isActive = false;
  await bill.save();

  logger.info(`Monthly bill ${billId} soft-deleted by tenant ${user._id}`);
};
