import type { PaginationMeta, PaginationQuery } from '../types/api.types';

export const getPagination = (query: PaginationQuery) => {
  const page = Math.max(1, parseInt(String(query.page), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit), 10) || 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const buildPaginationMeta = (total: number, page: number, limit: number): PaginationMeta => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});
